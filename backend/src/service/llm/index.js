import Env from "../../util/Env.js";
import OllamaProvider from "./providers/OllamaProvider.js";

export const llmInfo = {
  provider: Env.getLlmProvider(),
  model: Env.getLlmModel()
}

const PROVIDERS = new Map([
  ['ollama', () => new OllamaProvider()]
]);

export function createLlmProvider() {
  const providerName = Env.getLlmProvider().trim().toLowerCase();
  const createProvider = PROVIDERS.get(providerName);

  if (!createProvider) {
    throw new Error(`Unsupported LLM provider: ${providerName}`);
  }

  return createProvider();
}

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