import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import Env from "../../util/Env.js";

export const s3 = new S3Client({ region: Env.getAwsRegion() });

export async function putLogObject({ Key, Body, ContentType }) {
    return await s3.send(new PutObjectCommand({ Bucket: "logs-555744195302-us-east-2-an", Key, Body, ContentType }));
}
