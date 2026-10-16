import Env from "../../../util/Env.js";
import { ChatOllama } from "@langchain/ollama";

export default class OllamaProvider {

  async chat(messages, options = {}) {
    const startTime = Date.now();

    const model = new ChatOllama({
      baseUrl: Env.getLlmUrl(),
      model: Env.getLlmModel(),
      temperature: options?.temperature,
      topP: options?.top_p,
      numPredict: options?.num_predict
    });

    console.log(model)

    const formattedMessages = messages.map(({ role, content }) => [
      role === 'user' ? 'human' : role === 'assistant' ? 'ai' : role,
      content
    ]);

    console.log("[OllamaProvider] Requisição enviada:", {
      model: model.model,
      options: {
        temperature: model.temperature,
        topP: model.topP,
        numPredict: model.numPredict
      },
      directive: formattedMessages.find(([role]) => role === 'system')?.[1] ?? null,
      prompt: formattedMessages
    });

    const response = await model.invoke(formattedMessages);
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

}