
import { Queue } from "bullmq";
import { redisConfig } from "../connection/redis.js";

const queue_names = {
    email: "email-queue",
    upload: "upload-user"
}

const emailQueue = new Queue(queue_names.email, { connection: redisConfig });
const getUserQueue = (userId) => { return new Queue(`${queue_names.upload}-${userId}`, { connection: redisConfig }); };

export { emailQueue, getUserQueue, queue_names };
