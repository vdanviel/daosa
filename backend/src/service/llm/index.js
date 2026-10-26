import Env from "../../util/Env.js";
import OllamaProvider from "./providers/OllamaProvider.js";

export const llmInfo = {
  provider: Env.getLlmProvider(),
  model: Env.getLlmModel()
}

const PROVIDERS = new Map([
  ['ollama', () => new OllamaProvider()]
]);

//factory functions (llm/embbeding)
export function createLlmProvider() {
  const providerName = Env.getLlmProvider().trim().toLowerCase();
  const createProvider = PROVIDERS.get(providerName);

  if (!createProvider) {
    throw new Error(`Unsupported LLM provider: ${providerName}`);
  }

  //esconde metodos de embedding
  createProvider().embedChunks = undefined;
  createProvider().embedText = undefined;

  return createProvider();
}

export function createLlmEmbeddingProvider() {
  const providerName = Env.getEmbeddingLlmProvider().trim().toLowerCase();
  const createProvider = PROVIDERS.get(providerName);

  if (!createProvider) {
    throw new Error(`Unsupported LLM provider: ${providerName}`);
  }

  //esconde metodo de conversa
  createProvider().chat = undefined;

  return createProvider();
}

//others functions to llms
export function preprocessCorpus(corpus) {
  if (typeof corpus !== 'string') {
    throw new TypeError('Corpus deve ser um texto.');
  }

  const seenTokens = new Set();
  const tokens = corpus
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .toLowerCase()
    .trim()
    .split(/\s+/u);

  return tokens.filter((token) => {
    if (!token || seenTokens.has(token)) {
      return false;
    }

    seenTokens.add(token);
    return true;
  }).join(' ');
}

export function chunkText(text, limit = Env.getInputChunkLimit(), overlap = Env.getInputOverlap()) {
  const clean = preprocessCorpus(text);
  if (!clean) return [];

  if (!Number.isInteger(limit) || !Number.isInteger(overlap) || limit <= 0 || overlap < 0 || overlap >= limit) {
    throw new RangeError('Limit deve ser positivo e maior que overlap.');
  }

  const chunks = [];
  const step = limit - overlap;

  for (let start = 0; start < clean.length; start += step) {
    const chunk = clean.slice(start, start + limit).trim();
    if (chunk) chunks.push(chunk);
    if (start + limit >= clean.length) break;
  }

  return chunks;
}