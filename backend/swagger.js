import swaggerAutogen from "swagger-autogen";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

const doc = {
  openapi: "3.0.0",
  info: { title: "Daosa API", version: "1.0.0" },
  servers: [{ url: "/v1" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
    }
  }
};

const outputFile = path.join(currentDirectory, "swagger-output.json");
const routes = [path.join(currentDirectory, "src/router/version/version1Router.js")];

const autogen = swaggerAutogen({ openapi: "3.0.0", writeOutputFile: false });

autogen(outputFile, routes, doc).then(({ data }) => {
    
    Object.values(data.paths).forEach(pathItem => {
        Object.values(pathItem).forEach(operation => {
            
            const params = operation.parameters || [];
            const authIndex = params.findIndex(p => p.name?.toLowerCase() === 'authorization');

            if (authIndex !== -1) {
                operation.parameters.splice(authIndex, 1);
                operation.security = [{ bearerAuth: [] }];
            }
        });
    });

    // 3. Salva o arquivo JSON limpo e corrigido
    fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
    console.log("Documentação do Swagger gerada e formatada com sucesso!");
});