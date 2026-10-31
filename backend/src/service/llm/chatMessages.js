export function buildChatMessages(agent, history, contextText, userText) {
  const systemPrompt = [agent.objective, agent.description].filter(Boolean).join('\n\n');
  return [
    { role: 'system', content: `SEU OBJETIVO E DESCRIÇÃO: (${systemPrompt}) CONTEXTO: (${contextText})` },
    ...history.slice().reverse().map(({ role, content }) => ({ role, content })),
    { role: 'user', content: userText },
  ];
}
