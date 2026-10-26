import { DataTypes } from 'sequelize';
import { sequelize } from '../connection/database.js';
import { Agent } from './agent.js';
import { User } from './user.js';

const Conversation = sequelize.define('Conversation', 
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false  },
    agent_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true  },
    user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true  },
    channel_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true  },
    external_user_id: { type: DataTypes.STRING(255), allowNull: true  },
    external_user_name: { type: DataTypes.STRING(255), allowNull: true  },
    status: { type: DataTypes.ENUM('open', 'closed'), allowNull: true, defaultValue: 'open'  },
    started_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW  },
    closed_at: { type: DataTypes.DATE, allowNull: true  },
    last_message_at: { type: DataTypes.DATE, allowNull: true  },
    created_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW  },
    updated_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW  }
  }, 
  {
    tableName: 'conversation',  timestamps: true,  createdAt: 'created_at',  updatedAt: 'updated_at'
  }
);

Conversation.belongsTo(Agent, { foreignKey: 'agent_id', as: 'agent' });
Conversation.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

export { Conversation };