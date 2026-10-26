import { createLlmProvider, createLlmEmbeddingProvider, preprocessCorpus, llmInfo } from "../service/llm/index.js";

export { llmInfo, preprocessCorpus };

export const llmModelClient = createLlmProvider();

export const llmEmbeddingModel = createLlmEmbeddingProvider();