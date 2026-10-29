import express from "express";

//rotas
import { userRouter } from "../userRouter.js";
import { agentRouter } from "../agentRouter.js";
import { KnowledgeSourceRouter } from "../knowledgeSourceRouter.js";
import { ConversationRouter } from "../conversationRouter.js";
import { MessageRouter } from "../messageRouter.js";
import { GoogleRouter } from "../googleRouter.js";
import { ChannelRouter } from "../channelRouter.js";
import { IntegrationRouter } from "../integrationRouter.js";

import { personalAccessTokenRouter } from "../access/personalAccessTokenRouter.js";

const version1Router = express.Router();

version1Router.use(`/user`, userRouter);
version1Router.use(`/token`, personalAccessTokenRouter);
version1Router.use('/agent', agentRouter);
version1Router.use('/source', KnowledgeSourceRouter);
version1Router.use('/conversation', ConversationRouter);
version1Router.use('/message', MessageRouter);
version1Router.use('/google', GoogleRouter);
version1Router.use('/channel', ChannelRouter);
version1Router.use('/integration', IntegrationRouter);


export {version1Router};