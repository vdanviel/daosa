import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { Op } from "sequelize";
import { Worker } from "bullmq";
import { queue_names } from "./queue.js";
import { sender } from "../mail/MailSender.js";
import { redisConfig } from "../connection/redis.js";
import { KnowledgeSource } from "../model/knowledgeSource.js";
import { KnowledgeChunk } from "../model/knowledgeChunk.js";
import { extractText } from "../service/knowledge/documentParser.js";
import { chunkText, chunkSpreadsheet, createLlmEmbeddingProvider } from "../service/llm/index.js";
import { qdrant } from "../connection/qdrant.js";
import Env from "../util/Env.js";

//fixed workers
const initEmailWorker = () => {

    const worker = new Worker(
        queue_names.email, 
        async (job) => {
            
            switch (job.name) {
                case "send-welcome-email":
                    return sender.sendUserWelcomeEmail(job.data.email, job.data.name);
                case "send-password-reset-email":
                    return sender.sendPasswordResetEmail(job.data.email, job.data.name, job.data.code);
                case "send-email-change-confirmation":
                    return sender.sendEmailChangeConfirmation(
                        job.data.email,
                        job.data.name,
                        job.data.code,
                        job.data.secret
                    );
                default:
                    throw new Error(`Unknown email job: ${job.name}`);
            }

        },
        {
            connection: redisConfig
        }
    );

    worker.on("error", (error) => {
        console.error("Error on email worker:", error);
    });

    worker.on("failed", (job, err) => {
        console.error(`Error on email job: [ID ${job?.id}]`, err);
    });

    return worker;

}

export function initFixedWorkers(){
    initEmailWorker();
}

//dynamic workers
export const initUploadProcessUserWorker = (userId) => {
    const queueName = `upload-user-${userId}`;

    const embeddingProvider = createLlmEmbeddingProvider();

    const collectionName = Env.getQdrantCollection() || 'daosa';

    const worker = new Worker(
        queueName,
        async (job) => {
            switch (job.name) {

                case "rag-document-upload":

                    const sourceId = job.data?.id;
                    if (!sourceId) throw new Error(`Job ${job.name} recebido sem ID.`);

                    const source = await KnowledgeSource.findByPk(sourceId);
                    if (!source) throw new Error(`KnowledgeSource não encontrado: ${sourceId}`);

                    console.log(`Processando RAG #${job.id} - arquivo: ${source.file_name}`);

                    try {
                        await source.update({ status: 'processing', error_message: null });

                        const rawText = await extractText(source.file_path, source.file_extension);

                        const isSpreadsheet = ['xlsx', 'csv'].includes(source.file_extension);
                        const chunks = isSpreadsheet ? chunkSpreadsheet(rawText) : chunkText(rawText);

                        if (!chunks || chunks.length === 0) throw new Error('Nenhum fragmento gerado.');

                        const duplicateSources = await KnowledgeSource.findAll({
                            where: { agent_id: source.agent_id, file_name: source.file_name, id: { [Op.ne]: source.id } }
                        });

                        const duplicateIds = duplicateSources.map(s => s.id);

                        const sourcesToClean = [...duplicateIds, source.id];

                        const oldChunks = await KnowledgeChunk.findAll(
                            { 
                                where: { 
                                    knowledge_source_id: { 
                                        [Op.in]: sourcesToClean
                                    } 
                                }
                            }
                        );

                        const oldPointIds = oldChunks.map(c => c.qdrant_point_id).filter(Boolean);

                        if (oldPointIds.length > 0) { try { await qdrant.delete(collectionName, { wait: true, points: oldPointIds }); } catch(e) { console.error('Erro ao deletar pontos antigos:', e); } }

                        await KnowledgeChunk.destroy(
                            { 
                                where: { 
                                    knowledge_source_id: {
                                        [Op.in]: sourcesToClean
                                    }
                                }
                            }
                        );

                        if (duplicateIds.length > 0){
                            await KnowledgeSource.destroy(
                                {
                                    where: {
                                        id: {
                                            [Op.in]: duplicateIds
                                        }
                                    }
                                }
                            )
                        };

                        for (let i = 0; i < chunks.length; i += 50) {
                            const batchChunks = chunks.slice(i, i + 10);
                            const embeddings = await embeddingProvider.embedChunks(batchChunks);
                            const points = [];
                            const chunkRecords = [];

                            for (let j = 0; j < batchChunks.length; j++) {
                                const chunkContent = batchChunks[j];
                                const vector = embeddings[j];
                                const pointId = randomUUID();
                                const chunkIndex = i + j;
                                const tokenCount = Math.ceil(chunkContent.length / 4);
                                points.push({ id: pointId, vector: vector, payload: { agent_id: source.agent_id, user_id: source.user_id, source_id: source.id, file_name: source.file_name, chunk_index: chunkIndex, token_count: tokenCount, text: chunkContent } });
                                chunkRecords.push({ knowledge_source_id: source.id, agent_id: source.agent_id, user_id: source.user_id, chunk_index: chunkIndex, token_count: tokenCount, qdrant_point_id: pointId });
                            }

                            await qdrant.upsert(collectionName, { wait: true, points: points });
                            await KnowledgeChunk.bulkCreate(chunkRecords);
                        }

                        await source.update({ status: 'processed', error_message: null });

                        return { source_id: source.id, total_chunks: chunks.length, status: 'processed' };

                    } catch (err) {
                        console.error(`RAG #${job.id} erro [ID: ${source.id}]:`, err);

                        try { 

                            const existingSource = await KnowledgeSource.findByPk(source.id);

                            if (!existingSource) {
                                await qdrant.delete(collectionName,
                                    { 
                                        wait: true,
                                        filter: {
                                            must: [
                                                { 
                                                    key: 'source_id',
                                                    match: { value: source.id }
                                                }
                                            ] } 
                                    }
                                ); 
                            }

                        } catch (cleanupErr) { 
                            console.error('Erro limpar pontos:', cleanupErr);
                        }

                        await source.update({ status: 'failed', error_message: err?.message || 'Erro processamento.' }).catch(() => {});

                        throw err;

                    } finally {
                        if (source?.file_path) await unlink(source.file_path).catch(() => {});
                        console.log(`RAG #${job.id} - arquivo: ${source.file_name} concluído!`);
                    }

                case "image-upload":
                    // PROCESSO DE FOTO: vision/embed de imagem -> Qdrant
                    console.log(`Image upload #${job.id} - implementar vision/model`);

                    break;
                case "video-upload":
                    // PROCESSO DE VÍDEO: transcrever/frames -> Qdrant
                    console.log(`Video upload #${job.id} - implementar transcribe/frames`);

                    break;

                default:
                    throw new Error(`Unknown upload job: ${job.name}`);
            }
        },
        { connection: redisConfig, concurrency: 4 }
    );
    worker.on("error", (error) => console.error(`Worker ${queueName} error:`, error));
    worker.on("failed", (job, err) => console.error(`Worker ${queueName} failed: [#${job?.id}]`, err));
    return worker;
};

