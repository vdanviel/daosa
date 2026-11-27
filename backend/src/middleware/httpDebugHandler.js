import Env from "../util/Env.js";
import { randomUUID } from "node:crypto";
import { putLogObject } from "../connection/aws/s3.js";

// Substitui os segmentos `:param` do caminho da rota pelos valores reais de req.params.
const interpolateParams = (path, params) =>
    path.split("/").map((segment) => {
        const match = segment.match(/^:([^/?}]+)/);
        if (!match) return segment;

        const value = params?.[match[1]];
        return value === undefined || value === "" ? segment : encodeURIComponent(String(value));
    }).join("/");

export const httpDebugHandler = (req, res, next) => {

    const now = new Date();
    const timestamp = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")} ${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}:${String(now.getUTCSeconds()).padStart(2, "0")}`;

    let responseBody = "";

    // Captura o endpoint no momento do dispatch, quando req.baseUrl ainda está completo.
    let route;
    let endpoint;
    let routeParams = {};
    Object.defineProperty(req, "route", {
        configurable: true,
        get: () => route,
        set: (value) => {
            route = value;
            endpoint = `${req.baseUrl}${value.path}`;
            
            // No Express 5 o req.route é atribuído antes e depois de req.params ser preenchido,
            // então acumulamos os params para garantir os valores reais da chamada.
            routeParams = { ...routeParams, ...req.params };
        }
    });

    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    res.json = function (body) {
        responseBody = typeof body === "object" ? JSON.stringify(body) : String(body);
        return originalJson(body);
    };

    res.send = function (body) {
        responseBody = typeof body === "object" ? JSON.stringify(body) : String(body);
        return originalSend(body);
    };

    res.on("finish", () => {

        // Requisições sem rota registrada (arquivos estáticos e 404) são ignoradas.
        if (!endpoint) return;

        const entry =
            `
            [${timestamp}]
            REQUEST:
                host: ${req.hostname}${req.originalUrl.split("?")[0]}
                method: ${req.method}
                ip: ${req.ip}
                body: ${JSON.stringify(req.body ?? "")}
            RESPONSE:
                status: ${res.statusCode}
                body: ${responseBody}
            `;

        if (Env.getDebug() === "true") {
            const endpointName = interpolateParams(endpoint, routeParams).replace(/^\//, "").replace(/\//g, ".") || "root";
            putLogObject({
                Key: `http/${now.toISOString().slice(0, 10)}/${endpointName}.${randomUUID().slice(0, 8)}.log`,
                Body: entry,
                ContentType: "text/plain"
            })
                .catch((s3Err) => console.error("[S3 Log] Falha ao gravar log de erro no S3", s3Err));
        }

    });

    next();
};
