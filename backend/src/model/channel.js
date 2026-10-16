import { DataTypes } from 'sequelize';
import { sequelize } from '../connection/database.js';
import { channelConfigHelper, CHANNEL_TYPES } from '../helper/ChannelConfigHelper.js';

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
    type: DataTypes.ENUM('own', 'whatsapp', 'telegram', 'discord', 'api'),
    allowNull: false,
    defaultValue: 'own'
  },
  /*
    Exemplo de estrutura para config:
    - own: { title, subtitle, primary_color, position, welcome_message, placeholder, avatar_url, collect_user_info, allowed_domains }
    - whatsapp: { provider, phone_number, instance_name, api_url, api_key, webhook_secret, auto_reply, delay_ms }
    - telegram: { bot_token, bot_username, webhook_url, parse_mode, allowed_updates }
    - discord: { bot_token, client_id, guild_id, channel_ids, command_prefix }
    - api: { webhook_url, secret_key, rate_limit, timeout_ms, headers }
  */
  config: {
    type: DataTypes.JSON,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    allowNull: false,
    defaultValue: 'active'
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
  try {
    const defaultConfig = channelConfigHelper.getDefaultConfig(CHANNEL_TYPES.OWN);

    const channelById = await Channel.findByPk(1);

    if (!channelById) {
      await Channel.create({
        id: 1,
        name: 'Plataforma Daosa (Web Chat)',
        type: CHANNEL_TYPES.OWN,
        config: defaultConfig,
        status: 'active'
      });
      console.log('Canal padrão da plataforma (own) criado com sucesso (ID: 1).');
      return;
    }

    if (channelById.type !== CHANNEL_TYPES.OWN) {
      const existingOwn = await Channel.findOne({
        where: { type: CHANNEL_TYPES.OWN, user_id: null }
      });

      if (!existingOwn) {
        await Channel.create({
          name: 'Plataforma Daosa (Web Chat)',
          type: CHANNEL_TYPES.OWN,
          config: defaultConfig,
          status: 'active'
        });
        console.log('Canal padrão da plataforma (own) criado com sucesso.');
      }
    }
  } catch (error) {
    console.error('Aviso ao inicializar canal padrão (own):', error.message);
  }
}

// Cria automaticamente o registro do canal 'own' logo após o sync
sequelize.sync().then(() => {
  initializeDefaultChannel().catch(() => {});
}).catch(() => {});

export { Channel, initializeDefaultChannel };