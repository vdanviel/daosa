import { DataTypes } from 'sequelize';
import { sequelize } from '../connection/database.js';
import { Channel } from './channel.js';

const Agent = sequelize.define('Agent', {
  id: { 
    type: DataTypes.BIGINT.UNSIGNED, 
    primaryKey: true, 
    autoIncrement: true,
    allowNull: false
  },
  user_id: { 
    type: DataTypes.BIGINT.UNSIGNED, 
    allowNull: true 
  },
  name: { 
    type: DataTypes.STRING(30), 
    allowNull: true 
  },
  description: { 
    type: DataTypes.TEXT, 
    allowNull: true,
  },
  objective: { 
    type: DataTypes.STRING(30), 
    allowNull: true 
  },
  channel_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  status: { 
    // Assumindo alguns valores comuns para o enum além de 'draft'
    type: DataTypes.ENUM('draft', 'active', 'archived'), 
    allowNull: true, 
    defaultValue: 'draft' 
  },

  /*
    {
      "provider": "ollama",
      "model": "llama3.2",
      "options": {
        "temperature": 0.7,
        "top_p": 0.9,
        "num_predict": 2048
      },
      used_at: date
    }
  */
  model_config: { 
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
  },
  deleted_at: { 
    type: DataTypes.DATE, 
    allowNull: true 
  }
}, {
  tableName: 'agent',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at',
  paranoid: true // Ativa o Soft Delete usando o campo deleted_at
});

Agent.belongsTo(Channel, {
  foreignKey: 'channel_id',
  as: 'channel',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

export { Agent };