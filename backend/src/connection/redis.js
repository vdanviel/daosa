import IORedis from 'ioredis';
import Env from '../util/Env.js';

export const redisConfig = {
    host: Env.getRedisHostname(),
    port: Number(Env.getRedisPort()),
    password: Env.getRedisPassword(),
}

export const redis = new IORedis(redisConfig);