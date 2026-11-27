import { DataTypes } from 'sequelize';
import { sequelize } from '../connection/database.js';

const Channel = sequelize.define('Channel', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('own', 'whatsapp', 'telegram', 'discord'),
    allowNull: false,
    defaultValue: 'own'
  },
  icon_url: {
    type: DataTypes.STRING(2000),
    allowNull: true
  },
  /*
    Exemplo de estrutura para config:
    - own: { title, subtitle, welcome_message, placeholder, allowed_domains }
    - whatsapp: { provider, phone_number, instance_name, api_url, api_key, webhook_secret, auto_reply, delay_ms }
    - telegram: { bot_token, bot_username, webhook_url, parse_mode, allowed_updates }
    - discord: { bot_token, client_id, guild_id, channel_ids, command_prefix }
    - api: { webhook_url, secret_key, rate_limit, timeout_ms, headers }
  */
  config: {
    type: DataTypes.JSON,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'channel',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

/**
 * Garante que um canal padrão exista, atualizando-o quando já estiver cadastrado.
 * Idempotente: não duplica o canal a cada reinício do servidor.
 */
async function ensureChannel({ name, type, icon_url, config }) {
  const existing = await Channel.findOne({ where: { type } });
  if (existing) {
    await existing.update({ name, icon_url, config });
    return false;
  }
  await Channel.create({ name, type, icon_url, config });
  return true;
}

/**
 * Cria automaticamente os registros de canais padrão (plataforma, WhatsApp, Discord) assim que a tabela for sincronizada. Não duplica canais existentes.
 */
async function initializeChannels() {
  const createdOwn = await ensureChannel({
    name: 'Plataforma',
    type: 'own',
    icon_url: '/public/images/icon-own-chat.png',
    config: {
      title: 'Atendimento Virtual',
      subtitle: 'Assistente Inteligente',
      welcome_message: 'Olá! Como posso ajudar você hoje?',
      placeholder: 'Digite sua mensagem...',
      collect_user_info: false,
      allowed_domains: ['*']
    }
  });

  if (createdOwn) console.log('Canal padrão da plataforma (own) criado com sucesso.');

  const createdWhatsapp = await ensureChannel({
    name: 'WhatsApp',
    type: 'whatsapp',
    icon_url: '/public/images/whatsapp-logo.png',
    config: {
      unlink_message: 'Serviço indisponível, contate nosso time ou tente novamente mais tarde.',
      error_message: 'Ocorreu um erro inesperado. Por favor, tente novamente em instantes.',
      auto_reply: 'Recebemos sua mensagem e retornaremos em breve.'
    }
  });

  if (createdWhatsapp) console.log('Canal padrão do WhatsApp criado com sucesso.');

  const createdDiscord = await ensureChannel({
    name: 'Discord',
    type: 'discord',
    icon_url: '/public/images/discord-logo.png',
    config: {
      unlink_message: 'Serviço indisponível, contate nosso time ou tente novamente mais tarde.',
      error_message: 'Ocorreu um erro inesperado. Por favor, tente novamente em instantes.',
      auto_reply: 'Recebemos sua mensagem e retornaremos em breve.'
    }
  });

  if (createdDiscord) console.log('Canal padrão do Discord criado com sucesso.');
}

export { Channel, initializeChannels };