/**
 * ARQUIVO CENTRAL DE ENDPOINTS
 * -----------------------------------------------------------------------------
 * Toda chamada HTTP do SPA passa por aqui. Nada de fetch direto em componentes.
 *
 *   api.user.login({ email, password })
 *   api.agent.chat(1, { message, channel_id: 1 })
 *   api.message.byConversation(42, { page: 1 })
 */

import { Env } from './env';

/** Relativo por padrão: passa pelo proxy do Next (`app/api/[...path]`). */
const baseUriPath = (Env.get('API_BASE_URL') || '/api').replace(/\/+$/, '') + '/v1';

export interface User {
  id: string;
  name: string;
  email: string;
  [key: string]: any;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  quantity: number;
  totalPages: number;
}

/** Linha de agente nos agregados da visão geral. */
export interface DashboardAgent {
  id: number;
  name: string;
  objective: string | null;
  status: string;
  conversations: number;
  open_conversations: number;
  messages: number;
}

/** Resposta de `GET /user/dashboard` — tudo que a visão geral precisa. */
export interface DashboardStats {
  agents: { total: number; active: number; draft: number; archived: number };
  conversations: { total: number; open: number; closed: number };
  messages: { total: number };
  by_agent: DashboardAgent[];
}

/** Erro de qualquer chamada. `status` 0 = falha de rede. */
export class ApiError extends Error {
  status: number;
  body: any;
  /** Código de negócio do backend (ex.: `REAUTH_GOOGLE_ACCOUNT`). */
  code?: string;

  constructor(status: number, body: any) {
    super(
      body?.message ||
        body?.error ||
        body?.jwt_missing ||
        body?.jwt_invalid ||
        (Array.isArray(body?.missing)
          ? body.missing
              .map((m: any) => {
                const field = m.param ?? m.field ?? m.path;
                return field ? `${field}: ${m.msg}` : String(m.msg ?? '');
              })
              .join('; ')
          : `HTTP ${status}`)
    );
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.code = body?.code;
  }
}

/**
 * Verdadeiro quando o backend recusou porque a integração Google expirou
 * (refresh token venceu ou foi revogado). O caminho é sempre o mesmo: mandar o
 * usuário para `POST /google/consent-screen`, que atualiza o integration existente.
 */
export function needsGoogleReauth(err: unknown): boolean {
  return err instanceof ApiError && err.code === 'REAUTH_GOOGLE_ACCOUNT';
}

async function request<T = any>(
  method: string,
  path: string,
  opts: { body?: any; query?: Record<string, any>; auth?: boolean } = {}
): Promise<T> {
  let url = `${baseUriPath}${path}`;

  if (opts.query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== '') qs.append(k, String(v));
    }
    if (qs.toString()) url += `?${qs}`;
  }

  const token =
    opts.auth === false || typeof window === 'undefined'
      ? null
      : localStorage.getItem('auth_token');

  const isFormData = opts.body instanceof FormData;
  const res = await fetch(url, {
    method,
    headers: {
      // FormData: o próprio fetch do browser monta o multipart boundary.
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...(opts.body !== undefined && { body: isFormData ? opts.body : JSON.stringify(opts.body) }),
  });

  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));

  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

const get = <T = any>(path: Parameters<typeof request>[1], opts?: Parameters<typeof request>[2]) => request<T>('GET', path, opts);

const post = <T = any>(path: Parameters<typeof request>[1], body?: any, opts?: Parameters<typeof request>[2]) => request<T>('POST', path, { ...opts, body });

const put = <T = any>(path: Parameters<typeof request>[1], body?: any, opts?: Parameters<typeof request>[2]) => request<T>('PUT', path, { ...opts, body });

const patch = <T = any>(path: Parameters<typeof request>[1], body?: any, opts?: Parameters<typeof request>[2]) => request<T>('PATCH', path, { ...opts, body });

const del = <T = any>(path: Parameters<typeof request>[1], opts?: Parameters<typeof request>[2]) => request<T>('DELETE', path, opts);

/* ------------------------------- USER ------------------------------------- */

class UserApi {
  me = () => get<User>('/user/me');
  all = (query?: any) => get<Paginated<User>>('/user/all', { query });
  /** Agregados da tela de visão geral (agentes, conversas e mensagens). */
  dashboard = () => get<DashboardStats>('/user/dashboard');
  byId = (id: string) => get<User>(`/user/${id}`, { auth: false });

  register = (body: any) => post<User>('/user/register', body, { auth: false });
  login = (body: { email: string; password: string }) =>
    post<{ access_token: string; user: User }>('/user/login', body, { auth: false });

  update = (body: any) => put<User>('/user/update', body);
  changeEmailMail = (body: any) => post('/user/change-email/mail', body);
  changeEmail = (body: any) => patch('/user/change-email', body);
  forgotPasswordMail = (body: any) => post('/user/forgot-password/mail', body, { auth: false });
  updatePassword = (body: any) => patch('/user/update-password', body, { auth: false });
  toggleStatus = () => patch('/user/toggle-status');
}

/* ------------------------------- TOKEN ------------------------------------ */

class TokenApi {
  verifyCode = (code: string) => get(`/token/code/verify/${code}`, { auth: false });
  verifySecret = (secret: string) => get(`/token/secret/verify/${secret}`, { auth: false });
}

/* ------------------------------- CHANNEL ---------------------------------- */

/** Linha de `GET /channel/all` (sem paginação). */
export interface Channel {
  id: number;
  name: string;
  type: string;
  icon_url: string | null;
  [key: string]: any;
}

class ChannelApi {
  /** Canais de comunicação disponíveis para associar a um agente. */
  all = () => get<Channel[]>('/channel/all');
}

/* ----------------------------- INTEGRATION -------------------------------- */

/** Credencial devolvida por `GET /integration/user/credentials/`. */
export interface IntegrationCredential {
  /** Access token do provedor (`null` quando não há integração). */
  access: string | null;
}

/** Linha de `GET /integration/user/all` (sem credenciais/metadados).
 * O backend identifica o usuário pelo token JWT, não pelo id no caminho. */
export interface IntegrationRecord {
  id: number;
  user_id: string;
  provider: string;
  label: string | null;
  auth_type: string;
  /** `active` | `processing` | `revoked` | `expired` | `error` */
  status: string;
  [key: string]: any;
}

class IntegrationApi {
  /** Integrações do usuário (sem segredos). */
  all = () => get<IntegrationRecord[]>('/integration/user/all');

  /** Credencial do usuário para um provider (google → `{ access }` ou `null`).
   *
   * Pode lançar `ApiError` com `code === 'REAUTH_GOOGLE_ACCOUNT'` quando a
   * integração expirou — nesse caso o fluxo é refazer o consentimento. */
  credentials = (provider: string) =>
    get<IntegrationCredential | null>(`/integration/user/credentials`, {
      query: {
        "provider": provider
      }    
    });

  /** Integração de um provider específico (`null` quando não existe). */
  byProvider = (provider: string) =>
    get<IntegrationRecord | null>(`/integration/user`, { query: { provider } });

  /** Deletar uma integration de um provider de um usuário especifico */
  deleteByProvider = (provider: string) => del(`/integration/user/delete`, {
    query: {
      "provider": provider
    }
  })
}

/* -------------------------------- GOOGLE ---------------------------------- */

class GoogleApi {
  /** Gera o link do consentimento OAuth; devolve `{ g_consent_link }`. */
  consentScreen = (body: any) => post<{ g_consent_link: string }>('/google/consent-screen', body);
}

/* ------------------------------- WHATSAPP --------------------------------- */

class WhatsappApi {
  /** Prepara a conexão e devolve o `connect_code` de uso único (ver `whatsappRouter`). */
  connect = () => post<{ connect_code: string }>('/whatsapp/connect');

  /** Troca o `code` do Embedded Signup pelos assets e ativa a integração. */
  callback = (body: { connect_code: string; code: string; waba_id: string; phone_number_id: string }) =>
    post<{ waba_id: string; phone_number_id: string; display_phone_number: string | null }>(
      '/whatsapp/callback',
      body
    );
}

/* -------------------------------- DISCORD --------------------------------- */

class DiscordApi {
  /** Prepara a conexão e devolve o link de consentimento do Discord OAuth2.
   * Aceita os dados de texto do agente (`agent_*`) para retornar no callback. */
  connect = (body: {
    return_path: string;
    agent_name?: string;
    agent_objective?: string;
    agent_description?: string;
    agent_temp?: string;
    agent_top_p?: string;
    agent_token_limit?: string;
  }) => post<{ d_consent_link: string }>('/discord/connect', body);
}

/* ------------------------------- AGENT ------------------------------------ */

class AgentApi {
  chat = (id: number, body: any) => post(`/agent/${id}/chat`, body);
  register = (body: any) => post(`/agent/register`, body);
  all = (query?: any) => get(`/agent/all`, { query });
  /** Conversas de um agente específico (GET /agent/conversation/{id}/all). */
  conversations = (id: number, query?: any) =>
    get<Paginated<any>>(`/agent/conversation/${id}/all`, { query });
  byId = (id: number) => get(`/agent/${id}`);
  update = (id: number, body: any) => put(`/agent/update/${id}`, body);
  toggleStatus = (id: number, status: string) => patch(`/agent/toggle-status/${id}`, { status });
  remove = (id: number) => del(`/agent/delete/${id}`);
  /**
   * Envia arquivos locais para indexação RAG — `POST /agent/{id}/knowledge/upload`
   * (multipart, field `files`). Cada arquivo vira uma `knowledge_source` (`pending`)
   * e entra na fila do worker de embeddings.
   */
  uploadKnowledge = (id: number, files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    return post(`/agent/${id}/knowledge/upload`, formData);
  };
}

/* ------------------------------- SOURCE ----------------------------------- */

class SourceApi {
  /** Fontes/knowledge sources de um agente — `GET /source/agent/{id}/knowledge`. */
  knowledge = (agentId: number) => get<any>(`/source/agent/${agentId}/knowledge`);
  /** Detalhe de uma source (com chunks) — `GET /source/knowledge/{source_id}`. */
  byId = (sourceId: number) => get<any>(`/source/knowledge/${sourceId}`);
  limits = () => get<any>('/source/limits');
  delete = (sourceId: number) => del<any>(`/source/knowledge/${sourceId}`);
}

/* ---------------------------- CONVERSATION -------------------------------- */

class ConversationApi {
  register = (body: any) => post('/conversation/register', body);
  all = (query?: any) => get('/conversation/all', { query });
  byId = (id: number) => get(`/conversation/${id}`);
  toggleStatus = (id: number, status: string) =>
    patch(`/conversation/toggle-status/${id}`, { status });
  remove = (id: number) => del(`/conversation/delete/${id}`);
}

/* ------------------------------- MESSAGE ---------------------------------- */

class MessageApi {
  register = (body: any) => post('/message/register', body);
  all = (query?: any) => get('/message/all', { query });
  byConversation = (conversationId: number, query?: any) =>
    get(`/message/conversation/${conversationId}`, { query });
  byId = (id: number) => get(`/message/${id}`);
  update = (id: number, body: any) => put(`/message/update/${id}`, body);
  remove = (id: number) => del(`/message/delete/${id}`);
}

/* --------------------------- CLIENTE CENTRAL ------------------------------ */

export class Api {
  user = new UserApi();
  token = new TokenApi();
  agent = new AgentApi();
  channel = new ChannelApi();
  conversation = new ConversationApi();
  message = new MessageApi();
  integration = new IntegrationApi();
  google = new GoogleApi();
  whatsapp = new WhatsappApi();
  discord = new DiscordApi();
  source = new SourceApi();

  get basePath() {
    return baseUriPath;
  }

  get baseUrl(){
    return Env.get('API_BASE_URL')
  }

}

/** Instância única — use este objeto em todo o SPA. */
export const api = new Api();
