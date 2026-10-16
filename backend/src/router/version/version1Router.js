import express from "express";

//rotas
import { userRouter } from "../userRouter.js";
import { agentRouter } from "../agentRouter.js";
import { ConversationRouter } from "../conversationRouter.js";
import { MessageRouter } from "../messageRouter.js";

import { personalAccessTokenRouter } from "../access/personalAccessTokenRouter.js";

const version1Router = express.Router();

version1Router.use(`/user`, userRouter);
version1Router.use(`/token`, personalAccessTokenRouter);
version1Router.use('/agent', agentRouter);
version1Router.use('/conversation', ConversationRouter);
version1Router.use('/message', MessageRouter);

export {version1Router};