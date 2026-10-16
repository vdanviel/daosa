import { DataTypes } from 'sequelize';
import { sequelize } from '../connection/database.js';

const Message = sequelize.define('Message', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  conversation_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  role: { type: DataTypes.ENUM('user', 'assistant', 'system', 'tool'), allowNull: true },
  content: { type: DataTypes.TEXT('medium'), allowNull: true },
  knowledge_chunks: { type: DataTypes.JSON, allowNull: true },
  tokens_used: { type: DataTypes.INTEGER, allowNull: true },
  tool_calls: { type: DataTypes.JSON, allowNull: true },
  latency_ms: { type: DataTypes.INTEGER, allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW }
}, {
  tableName: 'message',
  timestamps: false
});

sequelize.sync();

export { Message };