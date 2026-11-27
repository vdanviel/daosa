import { version1Router } from '../../src/router/version/version1Router.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import express from "express";
import session from 'express-session';
import { initializeChannels } from "../../src/model/channel.js";
import { ensureQdrantCollections } from "../../src/connection/qdrant.js";
import { initFixedWorkers } from "../../src/jobs/worker.js";
import Env from "../../src/util/Env.js";
import cors from "cors";
import { connectDatabase } from "../../src/connection/database.js";

Env.validate();

//configrua expres...
const app = express();

app.use(express.json());

app.use(session({
    secret: Env.getSessionSecretPass(),
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false
    }
}));

const corsOptions = {
  origin: Env.getSpaApplicationUrl(),
  optionsSuccessStatus: 200,
  credentials: true
};

//inicializa as rotas...
app.use("/v1", cors(corsOptions), version1Router);

app.get('/', (req, res) => {
  
  return res.send("API CORENODEJS API");
});

//middlewares...
app.use(errorHandler);

async function start(){

    await connectDatabase();
    await initializeChannels();
    await ensureQdrantCollections();
    initFixedWorkers()

}

await start();

export { app };