/**
 * FORMULÁRIO DE AGENTE — helpers compartilhados
 * -----------------------------------------------------------------------------
 * Usado na criação (`/dashboard/agents/new`) e na edição (modal da lista).
 * Os três campos `*` são os `agent_opt_*` aceitos por
 * `POST /agent/register` e `PUT /agent/update/{id}`.
 */

export interface AgentForm {
  name: string;
  description: string;
  objective: string;
  /** `channel_id` do canal selecionado — string para permitir "nada selecionado". */
  channelId: string;
  /** Opções do modelo (model_config.options) — strings para permitir campo vazio. */
  temp: string;
  topP: string;
  numPredict: string;
}

/** Limites do formulário (espelham as validações do backend). */
export const AGENT_LIMITS = { name: 30, description: 150, objective: 30 } as const;

export const emptyAgentForm: AgentForm = {
  name: '',
  description: '',
  objective: '',
  channelId: '',
  temp: '',
  topP: '',
  numPredict: '',
};

/** Extrai os números enviáveis ao backend: só envia o que estiver preenchido e válido. */
export const toNumber = (value: unknown) => {
  const raw = String(value ?? '').trim();
  return raw === '' ? undefined : Number(raw);
};

/** Valida antes do envio. Retorna a mensagem de erro ou `null` se estiver válido. */
export function validateAgentForm(
  form: AgentForm,
  opts: { requireChannel?: boolean } = {}
): string | null {
  if (!form.name.trim() || !form.objective.trim()) {
    return 'Nome e objetivo são obrigatórios.';
  }

  // Criação exige canal (o backend valida `channel_id` como obrigatório); edição não.
  if (opts.requireChannel && !form.channelId.trim()) {
    return 'Selecione um canal.';
  }

  const temp = toNumber(form.temp);
  const topP = toNumber(form.topP);
  const numPredict = toNumber(form.numPredict);

  if (temp !== undefined && (Number.isNaN(temp) || temp < 0 || temp > 2)) {
    return 'Temperatura deve ser um número entre 0 e 2.';
  }

  if (topP !== undefined && (Number.isNaN(topP) || topP <= 0 || topP > 1)) {
    return 'Top P deve ser um número entre 0 e 1.';
  }

  if (numPredict !== undefined && (!Number.isInteger(numPredict) || numPredict < 1)) {
    return 'Limite de tokens deve ser um número inteiro maior que zero.';
  }

  return null;
}

/** Corpo enviado ao backend — campos de config só entram quando preenchidos. */
export function agentFormPayload(form: AgentForm) {
  const temp = toNumber(form.temp);
  const topP = toNumber(form.topP);
  const numPredict = toNumber(form.numPredict);
  const channelId = toNumber(form.channelId);

  return {
    name: form.name.trim(),
    description: form.description.trim(),
    objective: form.objective.trim(),
    ...(channelId !== undefined && { channel_id: channelId }),
    ...(temp !== undefined && { agent_opt_temp: temp }),
    ...(topP !== undefined && { agent_opt_top_p: topP }),
    ...(numPredict !== undefined && { agent_opt_num_predict: numPredict }),
  };
}
