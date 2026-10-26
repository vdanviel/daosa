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
 * Cria automaticamente o registro do canal 'own' (canal nativo da plataforma)
 * assim que a tabela for sincronizada.
 */
async function initializeDefaultChannel() {
  const existingOwnChannel = await Channel.findOne({ where: { type: 'own' } });
  
  if (existingOwnChannel) return;

  await Channel.create({
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
  console.log('Canal padrão da plataforma (own) criado com sucesso.');
}

export { Channel, initializeDefaultChannel };