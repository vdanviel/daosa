import Env from "../../../util/Env.js";
import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
export default class OllamaProvider {

  constructor(){

    this.ollamaEmbedding = new OllamaEmbeddings({
        model: Env.getEmbeddingLlmModel(),
        dimensions: Env.getEmbeddingLlmDimensions(),
        baseUrl: Env.getEmbeddingLlmUrl()
    });

  }

  async chat(messages, options = {}) {
    const startTime = Date.now();

    const ollamaLlm = new ChatOllama({
      baseUrl: Env.getLlmUrl(),
      model: Env.getLlmModel(),
      temperature: options?.temperature,
      topP: options?.top_p,
      numPredict: options?.num_predict
    });

    const formattedMessages = messages.map(({ role, content }) => [
      role === 'user' ? 'human' : role === 'assistant' ? 'ai' : role,
      content
    ]);

    console.log("[OllamaProvider] Requisição enviada:", {
      model: ollamaLlm.model,
      options: {
        temperature: ollamaLlm.temperature,
        topP: ollamaLlm.topP,
        numPredict: ollamaLlm.numPredict
      },
      directive: formattedMessages.find(([role]) => role === 'system')?.[1] ?? null,
      prompt: formattedMessages
    });

    const response = await ollamaLlm.invoke(formattedMessages);
    const latency_ms = Date.now() - startTime;

    // Extrai tokens utilizados (LangChain usage_metadata ou response_metadata do Ollama)
    const promptTokens = response.response_metadata?.prompt_eval_count || 0;
    const evalTokens = response.response_metadata?.eval_count || 0;
    const totalTokens = response.usage_metadata?.total_tokens || (promptTokens + evalTokens) || null;

    // Normaliza chamadas de tools (se houver)
    const tool_calls = response.tool_calls?.length ? response.tool_calls : null;

    // Garante que o conteúdo seja retornado como string
    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    return {
      content: content,
      tokens_used: totalTokens,
      tool_calls: tool_calls,
      latency_ms: latency_ms,
      raw: response || null
    };
  }

  //embed varios textos
  async embedChunks(textChunks = []) {

    if (textChunks.length <= 0) return []

    return this.ollamaEmbedding.embedDocuments(textChunks);

  }

  //embed um texto
  async embedText(text) {

    return this.ollamaEmbedding.embedQuery(text);

  }


}