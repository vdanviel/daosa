/**
 * ChannelConfigHelper
 * Gerencia validação, valores padrão (presets/templates) e sanitização
 * do atributo 'config' dos canais de comunicação do Daosa.
 */

export const CHANNEL_TYPES = Object.freeze({
  OWN: 'own',
  WHATSAPP: 'whatsapp',
  TELEGRAM: 'telegram',
  DISCORD: 'discord',
  API: 'api'
});

export const CHANNEL_STATUSES = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive'
});

export const DEFAULT_CONFIGS = Object.freeze({
  [CHANNEL_TYPES.OWN]: {
    title: 'Atendimento Virtual',
    subtitle: 'Assistente Inteligente',
    primary_color: '#4F46E5',
    position: 'bottom-right', // 'bottom-right' | 'bottom-left'
    welcome_message: 'Olá! Como posso ajudar você hoje?',
    placeholder: 'Digite sua mensagem...',
    avatar_url: null,
    collect_user_info: false,
    allowed_domains: ['*']
  },
  [CHANNEL_TYPES.WHATSAPP]: {
    provider: 'evolution', // 'evolution' | 'zapi' | 'meta_cloud' | 'custom'
    phone_number: '',
    instance_name: '',
    api_url: '',
    api_key: '',
    webhook_secret: '',
    auto_reply: true,
    delay_ms: 1000
  },
  [CHANNEL_TYPES.TELEGRAM]: {
    bot_token: '',
    bot_username: '',
    webhook_url: '',
    parse_mode: 'Markdown', // 'Markdown' | 'HTML'
    allowed_updates: ['message', 'callback_query']
  },
  [CHANNEL_TYPES.DISCORD]: {
    bot_token: '',
    client_id: '',
    guild_id: '',
    channel_ids: [],
    command_prefix: '!'
  },
  [CHANNEL_TYPES.API]: {
    webhook_url: '',
    secret_key: '',
    rate_limit: 60, // requisições por minuto
    timeout_ms: 10000,
    headers: {}
  }
});

export const SENSITIVE_KEYS = Object.freeze([
  'api_key',
  'token',
  'bot_token',
  'secret_key',
  'webhook_secret',
  'credentials'
]);

class Helper {

  /**
   * Retorna os tipos válidos de canais suportados.
   */
  getValidTypes() {
    return Object.values(CHANNEL_TYPES);
  }

  /**
   * Retorna os status válidos de canais.
   */
  getValidStatuses() {
    return Object.values(CHANNEL_STATUSES);
  }

  /**
   * Valida se um tipo de canal é suportado.
   */
  isValidType(type) {
    return this.getValidTypes().includes(type);
  }

  /**
   * Retorna a configuração padrão (preset) para um determinado tipo de canal.
   */
  getDefaultConfig(type) {
    if (!this.isValidType(type)) {
      const error = new Error(`Tipo de canal inválido: '${type}'. Tipos suportados: ${this.getValidTypes().join(', ')}`);
      error.status = 400;
      throw error;
    }
    return JSON.parse(JSON.stringify(DEFAULT_CONFIGS[type]));
  }

  /**
   * Retorna metadados e templates de todos os tipos para o frontend montar interfaces dinâmicas.
   */
  getAllTemplates() {
    return {
      [CHANNEL_TYPES.OWN]: {
        label: 'Widget Web (Chat Próprio)',
        description: 'Widget de chat flutuante para incorporar no seu site ou aplicação web.',
        default_config: this.getDefaultConfig(CHANNEL_TYPES.OWN),
        fields: [
          { name: 'title', type: 'string', label: 'Título', default: 'Atendimento Virtual' },
          { name: 'subtitle', type: 'string', label: 'Subtítulo', default: 'Assistente Inteligente' },
          { name: 'primary_color', type: 'color', label: 'Cor Primária', default: '#4F46E5' },
          { name: 'position', type: 'select', label: 'Posição', options: ['bottom-right', 'bottom-left'], default: 'bottom-right' },
          { name: 'welcome_message', type: 'text', label: 'Mensagem de Boas-vindas', default: 'Olá! Como posso ajudar você hoje?' },
          { name: 'placeholder', type: 'string', label: 'Placeholder do Campo', default: 'Digite sua mensagem...' },
          { name: 'avatar_url', type: 'url', label: 'URL do Avatar (opcional)' },
          { name: 'collect_user_info', type: 'boolean', label: 'Coletar nome/e-mail antes do chat', default: false },
          { name: 'allowed_domains', type: 'array', label: 'Domínios permitidos (CORS)', default: ['*'] }
        ]
      },
      [CHANNEL_TYPES.WHATSAPP]: {
        label: 'WhatsApp',
        description: 'Integração com WhatsApp via Evolution API, Z-API, Meta Cloud API ou Webhook próprio.',
        default_config: this.getDefaultConfig(CHANNEL_TYPES.WHATSAPP),
        fields: [
          { name: 'provider', type: 'select', label: 'Provedor', options: ['evolution', 'zapi', 'meta_cloud', 'custom'], default: 'evolution' },
          { name: 'phone_number', type: 'string', label: 'Número de Telefone', placeholder: '+5511999999999' },
          { name: 'instance_name', type: 'string', label: 'Nome da Instância / Session' },
          { name: 'api_url', type: 'url', label: 'URL da API' },
          { name: 'api_key', type: 'password', label: 'Chave de API / Token', sensitive: true },
          { name: 'webhook_secret', type: 'password', label: 'Segredo do Webhook (opcional)', sensitive: true },
          { name: 'auto_reply', type: 'boolean', label: 'Resposta Automática Ativa', default: true },
          { name: 'delay_ms', type: 'number', label: 'Delay de Digitação (ms)', default: 1000 }
        ]
      },
      [CHANNEL_TYPES.TELEGRAM]: {
        label: 'Telegram Bot',
        description: 'Integração com Telegram Bot via BotFather.',
        default_config: this.getDefaultConfig(CHANNEL_TYPES.TELEGRAM),
        fields: [
          { name: 'bot_token', type: 'password', label: 'Bot Token (@BotFather)', sensitive: true, required: true },
          { name: 'bot_username', type: 'string', label: 'Username do Bot (@exemplo_bot)' },
          { name: 'webhook_url', type: 'url', label: 'URL do Webhook (opcional)' },
          { name: 'parse_mode', type: 'select', label: 'Formato de Mensagem', options: ['Markdown', 'HTML'], default: 'Markdown' },
          { name: 'allowed_updates', type: 'array', label: 'Updates Permitidos', default: ['message', 'callback_query'] }
        ]
      },
      [CHANNEL_TYPES.DISCORD]: {
        label: 'Discord Bot',
        description: 'Integração com servidor ou canais do Discord via Bot Application.',
        default_config: this.getDefaultConfig(CHANNEL_TYPES.DISCORD),
        fields: [
          { name: 'bot_token', type: 'password', label: 'Bot Token (Discord Developer Portal)', sensitive: true, required: true },
          { name: 'client_id', type: 'string', label: 'Client / Application ID' },
          { name: 'guild_id', type: 'string', label: 'Guild ID (Servidor - opcional)' },
          { name: 'channel_ids', type: 'array', label: 'IDs dos Canais permitidos (opcional)' },
          { name: 'command_prefix', type: 'string', label: 'Prefixo de Comandos', default: '!' }
        ]
      },
      [CHANNEL_TYPES.API]: {
        label: 'API / Webhook Customizado',
        description: 'Integração direta via REST Webhook com sistemas externos.',
        default_config: this.getDefaultConfig(CHANNEL_TYPES.API),
        fields: [
          { name: 'webhook_url', type: 'url', label: 'URL de Webhook', required: false },
          { name: 'secret_key', type: 'password', label: 'Chave Secreta / Bearer Token', sensitive: true },
          { name: 'rate_limit', type: 'number', label: 'Limite de Requisições / Minuto', default: 60 },
          { name: 'timeout_ms', type: 'number', label: 'Timeout (ms)', default: 10000 },
          { name: 'headers', type: 'object', label: 'Headers HTTP Customizados' }
        ]
      }
    };
  }

  /**
   * Valida o objeto 'config' para o tipo de canal especificado.
   */
  validateConfig(type, config) {
    if (!this.isValidType(type)) {
      const error = new Error(`Tipo de canal inválido: '${type}'. Tipos suportados: ${this.getValidTypes().join(', ')}`);
      error.status = 400;
      throw error;
    }

    if (config !== null && config !== undefined && (typeof config !== 'object' || Array.isArray(config))) {
      const error = new Error("O atributo 'config' deve ser um objeto JSON válido.");
      error.status = 400;
      throw error;
    }

    const cfg = config || {};

    switch (type) {
      case CHANNEL_TYPES.OWN: {
        if (cfg.primary_color && !/^#(?:[0-9a-fA-F]{3}){1,2}$/.test(cfg.primary_color)) {
          const error = new Error("Cor primária inválida. Utilize formato hexadecimal, ex: '#4F46E5'.");
          error.status = 400;
          throw error;
        }
        if (cfg.position && !['bottom-right', 'bottom-left'].includes(cfg.position)) {
          const error = new Error("Posição inválida. Permitido: 'bottom-right' ou 'bottom-left'.");
          error.status = 400;
          throw error;
        }
        if (cfg.allowed_domains && !Array.isArray(cfg.allowed_domains)) {
          const error = new Error("'allowed_domains' deve ser um array de domínios.");
          error.status = 400;
          throw error;
        }
        break;
      }

      case CHANNEL_TYPES.WHATSAPP: {
        if (cfg.provider && !['evolution', 'zapi', 'meta_cloud', 'custom'].includes(cfg.provider)) {
          const error = new Error("Provedor de WhatsApp inválido. Permitidos: 'evolution', 'zapi', 'meta_cloud', 'custom'.");
          error.status = 400;
          throw error;
        }
        if (cfg.api_url && typeof cfg.api_url === 'string' && cfg.api_url.trim() !== '') {
          try {
            new URL(cfg.api_url);
          } catch {
            const error = new Error("URL da API de WhatsApp inválida.");
            error.status = 400;
            throw error;
          }
        }
        if (cfg.delay_ms !== undefined && (!Number.isInteger(cfg.delay_ms) || cfg.delay_ms < 0)) {
          const error = new Error("'delay_ms' deve ser um número inteiro maior ou igual a 0.");
          error.status = 400;
          throw error;
        }
        break;
      }

      case CHANNEL_TYPES.TELEGRAM: {
        if (cfg.bot_token && typeof cfg.bot_token === 'string') {
          const token = cfg.bot_token.trim();
          // Ignora verificação de formato se for o valor mascarado
          if (!this.isMaskedValue(token) && !/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
            const error = new Error("Formato de 'bot_token' do Telegram inválido. Formato esperado: '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ'.");
            error.status = 400;
            throw error;
          }
        }
        if (cfg.parse_mode && !['Markdown', 'HTML'].includes(cfg.parse_mode)) {
          const error = new Error("Parse mode do Telegram inválido. Permitido: 'Markdown' ou 'HTML'.");
          error.status = 400;
          throw error;
        }
        if (cfg.webhook_url && typeof cfg.webhook_url === 'string' && cfg.webhook_url.trim() !== '') {
          try {
            new URL(cfg.webhook_url);
          } catch {
            const error = new Error("URL de webhook do Telegram inválida.");
            error.status = 400;
            throw error;
          }
        }
        break;
      }

      case CHANNEL_TYPES.DISCORD: {
        if (cfg.channel_ids && !Array.isArray(cfg.channel_ids)) {
          const error = new Error("'channel_ids' do Discord deve ser um array de IDs.");
          error.status = 400;
          throw error;
        }
        break;
      }

      case CHANNEL_TYPES.API: {
        if (cfg.webhook_url && typeof cfg.webhook_url === 'string' && cfg.webhook_url.trim() !== '') {
          try {
            new URL(cfg.webhook_url);
          } catch {
            const error = new Error("URL de webhook inválida.");
            error.status = 400;
            throw error;
          }
        }
        if (cfg.rate_limit !== undefined && (!Number.isInteger(cfg.rate_limit) || cfg.rate_limit <= 0)) {
          const error = new Error("'rate_limit' deve ser um inteiro positivo.");
          error.status = 400;
          throw error;
        }
        if (cfg.timeout_ms !== undefined && (!Number.isInteger(cfg.timeout_ms) || cfg.timeout_ms <= 0)) {
          const error = new Error("'timeout_ms' deve ser um inteiro positivo.");
          error.status = 400;
          throw error;
        }
        break;
      }
    }

    return true;
  }

  /**
   * Mescla os campos fornecidos pelo usuário com os defaults seguros do tipo e valida.
   */
  buildConfig(type, inputConfig = {}) {
    this.validateConfig(type, inputConfig);

    const defaultConfig = this.getDefaultConfig(type);
    const userConfig = typeof inputConfig === 'object' && inputConfig !== null ? inputConfig : {};

    return {
      ...defaultConfig,
      ...userConfig
    };
  }

  /**
   * Identifica se uma string de credencial é um valor mascarado retornado anteriormente pela API.
   */
  isMaskedValue(value) {
    if (typeof value !== 'string') return false;
    return value.includes('****') || value === '********';
  }

  /**
   * Preserva segredos originais durante updates caso o cliente tenha enviado
   * o valor mascarado de volta ou omitido o campo sensível.
   */
  mergeForUpdate(currentConfig = {}, newConfig = {}, type) {
    const prev = typeof currentConfig === 'object' && currentConfig !== null ? currentConfig : {};
    const next = typeof newConfig === 'object' && newConfig !== null ? newConfig : {};

    const merged = { ...prev, ...next };

    // Para cada chave sensível, se o cliente reenviou o valor mascarado, mantém o segredo antigo
    for (const key of SENSITIVE_KEYS) {
      if (this.isMaskedValue(next[key]) && prev[key]) {
        merged[key] = prev[key];
      }
    }

    this.validateConfig(type, merged);
    return merged;
  }

  /**
   * Mascara dados sensíveis da configuração para não expor credenciais em respostas da API.
   */
  maskSensitive(config, type) {
    if (!config || typeof config !== 'object') return config;

    const masked = JSON.parse(JSON.stringify(config));

    for (const key of SENSITIVE_KEYS) {
      if (typeof masked[key] === 'string' && masked[key].trim() !== '') {
        const val = masked[key].trim();
        if (val.length > 8) {
          masked[key] = `${val.slice(0, 4)}****${val.slice(-4)}`;
        } else {
          masked[key] = '********';
        }
        masked[`has_${key}`] = true;
      } else if (masked[key] !== undefined) {
        masked[`has_${key}`] = false;
      }
    }

    return masked;
  }
}

const channelConfigHelper = new Helper();
export { channelConfigHelper };
