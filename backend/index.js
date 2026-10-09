import express from "express";
import session from 'express-session';
import { version1Router } from "./src/router/version/version1Router.js";
import cors from 'cors';
import dotenv from 'dotenv'
import { errorHandler } from "./src/middleware/errorHandler.js";
import { connectDatabase } from './src/connection/database.js';
import { initializeDefaultRole } from './src/model/access/role.js';
dotenv.config();

const app = express();
const port = 3330

// passa a aplicação para application/json
app.use(express.json());

//configura o session
app.use(session({
  secret: process.env.SESSION_SECRET_PASS,
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false // Deixa `false` para desenvolvimento (sem HTTPS). Em produção, coloque `true` se usar HTTPS.
  }
}));

//configura o cors
var corsOptions = {
  origin: process.env.SPA_APPLICATION_URL,
  optionsSuccessStatus: 200,
  credentials: true
}

//recupera todas as rotas da versão da API...
app.use("/v1", cors(corsOptions), version1Router);

//main
app.get('/', (req, res) => {

  return res.send("API CORENODEJS API");

});

//middleware que lida com os erros nas rotas
app.use(errorHandler);

async function start() {
  try {
    await connectDatabase();
    await initializeDefaultRole();
    app.listen(port, () => {
      console.log(`API is running on ${port} port!`);
    });
  } catch (error) {
    console.error('API startup failed:', error);
    process.exitCode = 1;
  }
}

await start();