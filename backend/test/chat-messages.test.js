import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

process.env.LLM_PROVIDER = 'ollama';
process.env.EMBEDDING_LLM_PROVIDER = 'ollama';

const { AgentController } = await import('../src/controller/AgentController.js');
const { Agent } = await import('../src/model/agent.js');
const { Conversation } = await import('../src/model/conversation.js');
const { Message } = await import('../src/model/message.js');
const { llmModelClient, llmEmbeddingModel } = await import('../src/connection/llm.js');
const { qdrant } = await import('../src/connection/qdrant.js');
const { buildChatMessages } = await import('../src/service/llm/chatMessages.js');

test('buildChatMessages handles empty history and context without changing input', () => {
  const history = [];
  assert.deepEqual(buildChatMessages({ objective: null, description: '' }, history, '', 'Hello!'), [
    { role: 'system', content: 'SEU OBJETIVO E DESCRIÇÃO: () CONTEXTO: ()' },
    { role: 'user', content: 'Hello!' },
  ]);
  assert.deepEqual(history, []);
});

test('buildChatMessages keeps all 20 selected messages without mutating their order', () => {
  const history = Array.from({ length: 20 }, (_, i) => ({ role: 'user', content: `Message ${20 - i}!` }));
  const messages = buildChatMessages({}, history, '', 'Next?');
  assert.deepEqual(messages.slice(1, -1).map(({ content }) => content),
    Array.from({ length: 20 }, (_, i) => `Message ${i + 1}!`));
  assert.deepEqual(buildChatMessages({}, history, '', 'Next?'), messages);
  assert.equal(history[0].content, 'Message 20!');
});

test('chat sends the latest history in chronological order with original text and separated context', async () => {
  const agent = { id: 1, objective: 'Keep CASE, CASE!', description: 'A question?', status: 'active', model_config: { options: { temperature: 0.4 } }, save: async () => {} };
  const conversation = { id: 3, status: 'open', save: async () => {} };
  const history = [
    { role: 'assistant', content: 'Second: YES!' },
    { role: 'user', content: 'First, First?' },
  ];
  let query;
  let sent;
  let sentOptions;
  mock.method(Agent, 'findOne', async () => agent);
  mock.method(Conversation, 'findOne', async () => conversation);
  mock.method(Message, 'findAll', async (options) => { query = options; return history; });
  mock.method(Message, 'create', async () => ({}));
  mock.method(llmEmbeddingModel, 'embedText', async () => [1]);
  mock.method(qdrant, 'query', async () => ({ points: [{ payload: { text: 'Chunk A.' } }, { payload: { text: 'Chunk B!' } }] }));
  mock.method(llmModelClient, 'chat', async (messages, options) => { sent = messages; sentOptions = options; return { content: 'Done.' }; });
  try {
    await AgentController.chat(1, 2, 3, 'Now, Now?');
    assert.deepEqual(query, { where: { conversation_id: 3 }, order: [['id', 'DESC']], limit: 20 });
    assert.deepEqual(sent, [
      { role: 'system', content: 'SEU OBJETIVO E DESCRIÇÃO: (Keep CASE, CASE!\n\nA question?) CONTEXTO: (Chunk A.\nChunk B!)' },
      { role: 'user', content: 'First, First?' },
      { role: 'assistant', content: 'Second: YES!' },
      { role: 'user', content: 'Now, Now?' },
    ]);
    assert.equal(history[0].content, 'Second: YES!');
    assert.deepEqual(sentOptions, { temperature: 0.4 });
  } finally {
    mock.restoreAll();
  }
});

test('chat propagates a retrieval failure without calling the model', async () => {
  const error = new Error('retrieval failed');
  mock.method(Agent, 'findOne', async () => ({ id: 1, status: 'active', model_config: {} }));
  mock.method(Conversation, 'findOne', async () => ({ id: 3, status: 'open' }));
  mock.method(Message, 'findAll', async () => []);
  mock.method(Message, 'create', async () => ({}));
  mock.method(llmEmbeddingModel, 'embedText', async () => [1]);
  mock.method(qdrant, 'query', async () => { throw error; });
  const chat = mock.method(llmModelClient, 'chat', async () => ({}));
  try {
    await assert.rejects(AgentController.chat(1, 2, 3, 'Hello!'), error);
    assert.equal(chat.mock.calls.length, 0);
  } finally {
    mock.restoreAll();
  }
});
