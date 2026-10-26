
import { Queue } from "bullmq";
import { redisConfig } from "../connection/redis.js";

const queue_names = {
    email: "email-queue",
    rag: "rag-queue"
}

const emailQueue = new Queue(queue_names.email, { connection: redisConfig });
const ragQueue = new Queue(queue_names.rag, { connection: redisConfig })

export { emailQueue, ragQueue, queue_names };
