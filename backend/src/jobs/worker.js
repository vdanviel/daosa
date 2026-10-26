import { Worker } from "bullmq";
import { queue_names } from "./queue.js";
import { sender } from "../mail/MailSender.js";
import { redisConfig } from "../connection/redis.js";

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

const initRagProcessWorker = () => {

    const worker = new Worker(
        queue_names.rag, 
        async (job) => {
            
            //achar knowledge_source pelo id (O KNOELEGE SOURCE DEVE SER REGISTRADO ANTES)

 
            const text = job.data.fileData.content;

            //chunking

            //limpar knowlegde source/chunks do mysql e chunks do qdrant antigos iguais

            //Embed em lotes + upsert no Qdrant + registro de metadado no MySQL




        },
        {
            connection: redisConfig
        }
    );

    return worker;


}

export function initWorkers(){
    initEmailWorker();
}