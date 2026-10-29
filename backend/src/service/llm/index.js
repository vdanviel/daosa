import Env from "../../util/Env.js";
import OllamaProvider from "./providers/OllamaProvider.js";
import OpenRouterProvider from "./providers/OpenRouterProvider.js";

export const llmInfo = {
  provider: Env.getLlmProvider(),
  model: Env.getLlmModel()
}

const PROVIDERS = new Map([
  ['ollama', () => new OllamaProvider()],
  ['openrouter', () => new OpenRouterProvider()]
]);

//factory functions (llm/embbeding)
export function createLlmProvider() {
  const providerName = Env.getLlmProvider().trim().toLowerCase();
  const createProvider = PROVIDERS.get(providerName);

  if (!createProvider) {
    throw new Error(`Unsupported LLM provider: ${providerName}`);
  }

  const provider = createProvider();
  //esconde metodos de embedding
  provider.embedChunks = undefined;
  provider.embedText = undefined;

  return provider;
}

export function createLlmEmbeddingProvider() {
  const providerName = Env.getEmbeddingLlmProvider().trim().toLowerCase();
  const createProvider = PROVIDERS.get(providerName);

  if (!createProvider) {
    throw new Error(`Unsupported LLM provider: ${providerName}`);
  }

  const provider = createProvider();
  //esconde metodo de conversa
  provider.chat = undefined;

  return provider;
}

//outras funcoes llms
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

export function chunkText(text, limit = Env.getInputChunkLimit(), overlap = Env.getInputOverlap(), preprocess = false) {
  if (typeof text !== 'string') {
    throw new TypeError('Corpus deve ser um texto.');
  }

  const clean = preprocess ? preprocessCorpus(text) : text.trim();
  if (!clean) return [];

  const numLimit = Number(limit);
  const numOverlap = Number(overlap);

  if (!Number.isInteger(numLimit) || !Number.isInteger(numOverlap) || numLimit <= 0 || numOverlap < 0 || numOverlap >= numLimit) {
    throw new RangeError('Limit deve ser positivo e maior que overlap.');
  }

  const chunks = [];
  const step = numLimit - numOverlap;

  for (let start = 0; start < clean.length; start += step) {
    const chunk = clean.slice(start, start + numLimit).trim();
    if (chunk) chunks.push(chunk);
    if (start + numLimit >= clean.length) break;
  }

  return chunks;
}

export function chunkSpreadsheet(text, limit = Env.getInputChunkLimit(), overlapRows = 2) {
  if (typeof text !== 'string') {
    throw new TypeError('Texto deve ser uma string.');
  }

  const numLimit = Number(limit || 4000);
  const chunks = [];

  // Se houver múltiplas planilhas/sheets demarcadas por "--- sheet ... ---"
  const sheetBlocks = text.split(/(?=^--- sheet \d+)/m).filter((b) => b.trim().length > 0);

  for (const block of sheetBlocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) continue;

    let sheetHeader = '';
    let startLineIdx = 0;
    if (lines[0].startsWith('--- sheet')) {
      sheetHeader = lines[0];
      startLineIdx = 1;
    }

    if (startLineIdx >= lines.length) {
      if (sheetHeader) chunks.push(sheetHeader);
      continue;
    }

    const columnHeader = lines[startLineIdx];
    const baseHeader = sheetHeader ? `${sheetHeader}\n${columnHeader}` : columnHeader;
    const dataLines = lines.slice(startLineIdx + 1);

    if (dataLines.length === 0) {
      chunks.push(baseHeader);
      continue;
    }

    let currentRows = [];
    let currentLen = baseHeader.length + 1;

    for (let r = 0; r < dataLines.length; r++) {
      const row = dataLines[r];
      const rowLen = row.length + 1;

      if (currentLen + rowLen > numLimit && currentRows.length > 0) {
        chunks.push(`${baseHeader}\n${currentRows.join('\n')}`);
        const overlap = currentRows.slice(-Math.min(overlapRows, currentRows.length));
        currentRows = [...overlap, row];
        currentLen = baseHeader.length + 1 + currentRows.join('\n').length;
      } else {
        currentRows.push(row);
        currentLen += rowLen;
      }
    }

    if (currentRows.length > 0) {
      chunks.push(`${baseHeader}\n${currentRows.join('\n')}`);
    }
  }

  return chunks.length > 0 ? chunks : (text.trim() ? [text.trim()] : []);
}