import fs from 'node:fs';
import cors from 'cors';
import express from 'express';
import session from 'express-session';
import swaggerUi from 'swagger-ui-express';
import { connectDatabase } from './src/connection/database.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { initializeDefaultRole } from './src/model/access/role.js';
import { initializeDefaultChannel } from './src/model/channel.js';
import { version1Router } from './src/router/version/version1Router.js';
import Env from './src/util/Env.js';

Env.validate();

const app = express();
const port = Env.getPort();

// Configura o parser antes das rotas para disponibilizar req.body.
app.use(express.json());

// Disponibiliza a documentação gerada em /api-docs.
const swaggerFile = new URL('./swagger-output.json', import.meta.url);
const swaggerDocument = JSON.parse(fs.readFileSync(swaggerFile, 'utf8'));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Mantém a sessão da aplicação entre as requisições.
app.use(session({
  secret: Env.getSessionSecretPass(),
  resave: false,
  saveUninitialized: true,
  cookie: {
    // Em produção com HTTPS, configure secure como true.
    secure: false
  }
}));

// Restringe o acesso à API à origem configurada para o frontend.
const corsOptions = {
  origin: Env.getSpaApplicationUrl(),
  optionsSuccessStatus: 200,
  credentials: true
};

// Registra as rotas da versão 1 da API.
app.use("/v1", cors(corsOptions), version1Router);

// Rota simples para verificar se a API está respondendo.
app.get('/', (req, res) => {
  
  return res.send("API CORENODEJS API");
});

// O tratador de erros deve ser registrado depois das rotas.
app.use(errorHandler);

// Prepara as dependências antes de começar a aceitar requisições.
async function start() {
  try {
    await connectDatabase();
    await initializeDefaultRole();
    await initializeDefaultChannel();
    app.listen(port, () => {
      console.log(`API is running on ${port} port!`);
    });
  } catch (error) {
    console.error('API startup failed:', error);
    process.exitCode = 1;
  }
}

// Inicia a API
await start();