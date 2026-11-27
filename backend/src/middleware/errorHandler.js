import Utils from "../util/Util.js";
import Env from "../util/Env.js";
import { randomUUID } from "node:crypto";
import { putLogObject } from "../connection/aws/s3.js";

export const errorHandler = (err, req, res, next) => {

    //gerando entrada de log para 
    const now = new Date();
    const entry = 
        `
            [${new Date().toISOString().replace("T", " ").slice(0, 19)}]
            ERROR:
                name: ${err.name}
                status: ${err.status}
                message: ${err.message}
            STACK:
                ${err.stack?.replace(/\n/g, "\n        ")}
        `

    //logar em console do servidor
    console.error(entry);
    
    //logar em aws
    //filtro de logs de erro do sistema que não podem logar
    if(
        err.name !== 'Unauthorized'
    ){
        putLogObject({ 
            Key: 
            `
                errors/
                ${now.toISOString().slice(0, 10)}/
                ${err.message}-${randomUUID().slice(0, 8)}.log
            `, 
            Body: entry, 
            ContentType: "text/plain" 
        })
        .catch((s3Err) => console.error("[S3 Log] Falha ao gravar log de erro no S3", s3Err));
    }
    
    //retorna na api
    res.status(err.status || err.statusCode || 500).json({
        type: err.name,
        error: err.message,
        ...(err.code !== undefined && { code: err.code }),
        ...(Utils.getCurrentEnroviment() === "dev" && { stack: err.stack })
    });
};
