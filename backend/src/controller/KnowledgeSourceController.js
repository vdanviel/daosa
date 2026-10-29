import { unlink } from 'node:fs/promises';
import { initUploadProcessUserWorker } from '../jobs/worker.js';
import { getUserQueue } from '../jobs/queue.js';
import { qdrant } from '../connection/qdrant.js';
import { Agent } from '../model/agent.js';
import { KnowledgeChunk } from '../model/knowledgeChunk.js';
import { KnowledgeSource } from '../model/knowledgeSource.js';
import { extensionOf } from '../service/knowledge/documentParser.js';
import Env from '../util/Env.js';

class Controller {

	/**
	 * Registers each uploaded file as a `pending` knowledge source and queues
	 * it for indexing. Extraction, chunking and embeddings happen in the RAG
	 * worker (src/jobs/worker.js); until it runs the source stays `pending`.
	 */
	async upload(agent_id, user_id, files = []) {

		if (files.length === 0) {
			throw Object.assign(new Error('No file received.'), { status: 400 });
		}

		const agent = await Agent.findOne({ where: { id: agent_id, user_id } });

		if (!agent) {
			await Promise.all(files.map((file) => unlink(file.path).catch(() => {})));
			throw Object.assign(new Error('Agent not found.'), { status: 404 });
		}

		const sources = [];

		for (const file of files) {

			// Check duplicado: mesmo arquivo já existe?
			const existing = await KnowledgeSource.findOne({
				where: { agent_id: agent.id, file_name: file.originalname, user_id:user_id }
			});

			if (existing) {
				console.log('Arquivo duplicado ignorado:', file.originalname);
				continue;
			}

			const source = await KnowledgeSource.create({
				agent_id: agent.id,
				user_id: user_id,
				type: 'file',
				title: file.originalname,
				file_name: file.originalname,
				file_path: file.path,
				file_mime: file.mimetype,
				file_size: file.size,
				file_extension: extensionOf(file.originalname),
				status: 'pending'
			});

			//worker começa a escutar...
			initUploadProcessUserWorker(user_id);

			if (['docx', 'md', 'xlsx', 'csv', 'txt', 'pdf'].includes(extensionOf(file.originalname))) {
				await getUserQueue(user_id).add('rag-document-upload', source.get());
			}

			if (['png', 'jpg', 'jpeg', 'webp'].includes(extensionOf(file.originalname))) {
				await getUserQueue(user_id).add('image-upload', source.get());
			}

			if (['mp4', 'mkv'].includes(extensionOf(file.originalname))) {
				await getUserQueue(user_id).add('video-upload', source.get());
			}


			sources.push(source);
		}

		return sources;
	}

	async deleteById(source_id, user_id) {
		const source = await KnowledgeSource.findOne({
			where: { id: source_id, user_id }
		});

		if (!source) {
			throw Object.assign(new Error('Knowledge source not found.'), { status: 404 });
		}

		const collectionName = Env.getQdrantCollection() || 'daosa';
		const { exists } = await qdrant.collectionExists(collectionName);

		if (exists) {
			await qdrant.delete(collectionName, {
				wait: true,
				filter: {
					must: [{ key: 'source_id', match: { value: source.id } }]
				}
			});
		}

		await KnowledgeSource.sequelize.transaction(async (transaction) => {
			await KnowledgeChunk.destroy({
				where: { knowledge_source_id: source.id },
				transaction
			});
			await source.destroy({ transaction });
		});

		// Remove vectors that an already-running indexing job may have added during the SQL deletion.
		const { exists: collectionStillExists } = await qdrant.collectionExists(collectionName);
		if (collectionStillExists) {
			await qdrant.delete(collectionName, {
				wait: true,
				filter: {
					must: [{ key: 'source_id', match: { value: source.id } }]
				}
			});
		}

		if (source.file_path) {
			try {
				await unlink(source.file_path);
			} catch (error) {
				if (error.code !== 'ENOENT') throw error;
			}
		}

		return { message: 'Knowledge source and chunks permanently deleted.' };
	}

	//retorna informações sobre o source e sobre todos seus chunks
	async findById(source_id, user_id) {
		const source = await KnowledgeSource.findOne({
			where: { id: source_id, user_id }
		});

		if (!source) {
			throw Object.assign(new Error('Knowledge source not found.'), { status: 404 });
		}

		const chunks = await KnowledgeChunk.findAll({
			where: {
				knowledge_source_id: source.id,
				agent_id: source.agent_id,
				user_id
			},
			order: [['chunk_index', 'ASC'], ['id', 'ASC']]
		});

		return {
			...source.toJSON(),
			chunks
		};
	}

	//acha todos os sources
	async findAllByAgent(agent_id, user_id) {

		const agent = await Agent.findOne({ where: { id: agent_id, user_id } });

		if (!agent) {
			throw Object.assign(new Error('Agent not found.'), { status: 404 });
		}

		const sources = await KnowledgeSource.findAll({
			where: { agent_id: agent.id },
			order: [['created_at', 'DESC'], ['id', 'DESC']]
		});

		return {
			data: sources,
			total: sources.length,
			quantity: sources.length
		};
	}

}

const KnowledgeController = new Controller();
export { KnowledgeController };
