import Env from "../../../util/Env.js";
import { OpenRouter } from "@openrouter/sdk";

export default class OpenRouterProvider {

  constructor() {

    this.chatClient = new OpenRouter({
      apiKey: Env.getllmApiKey(),
      serverURL: Env.getLlmUrl(),
    });

    this.embeddingClient = new OpenRouter({
      apiKey: Env.getEmbeddingApiKey(),
      serverURL: Env.getEmbeddingLlmUrl(),
    });

  }

  async chat(messages, options = {}) {

    const startTime = Date.now();

    let completion;
    try {
      completion = await this.chatClient.chat.send({
        chatRequest: {
          model: Env.getLlmModel(),
          messages: messages,
          temperature: options?.temperature || 0.7,
          top_p: options?.top_p || 0.9,
          max_tokens: options?.num_predict || 300
        }
      });
    } catch (err) {
      throw new Error(`OpenRouter chat error: ${String(err?.message || err).slice(0, 200)}`);
    }

    const latency_ms = Date.now() - startTime;

    const message = completion.choices?.[0]?.message;
    const content = message?.content || '';
    const toolCalls = message?.toolCalls || message?.tool_calls || null;

    const totalTokens = completion.usage?.totalTokens ?? completion.usage?.total_tokens ?? null;

    return {
      raw: completion,
      content,
      tokens_used: totalTokens,
      tool_calls: toolCalls?.length ? toolCalls : null,
      latency_ms,
    };
  }

  async embedText(text) {

    let response;
    try {
      response = await this.embeddingClient.embeddings.generate({
        requestBody: {
          model: Env.getEmbeddingLlmModel(),
          dimensions: Env.getEmbeddingLlmDimensions(),
          input: typeof text === 'string' ? text : text.join(' '),
        }
      });
    } catch (err) {
      throw new Error(`OpenRouter embed error: ${String(err?.message || err).slice(0, 200)}`);
    }

    return response.data?.[0]?.embedding || [];
  }

  async embedChunks(textChunks = []) {
    return Promise.all(textChunks.map((t) => this.embedText(t)));
  }
}