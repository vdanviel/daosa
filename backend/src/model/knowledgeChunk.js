import { DataTypes } from 'sequelize';
import { sequelize } from '../connection/database.js';
import { Agent } from './agent.js';
import { KnowledgeSource } from './knowledgeSource.js';
import { User } from './user.js';

const KnowledgeChunk = sequelize.define('KnowledgeChunk', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false },
  knowledge_source_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  agent_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  chunk_index: { type: DataTypes.INTEGER, allowNull: true },
  token_count: { type: DataTypes.INTEGER, allowNull: true },
  qdrant_point_id: { type: DataTypes.CHAR(36), allowNull: true, unique: true },
  created_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW }
}, {
  tableName: 'knowledge_chunk',
  timestamps: false
});

KnowledgeChunk.belongsTo(KnowledgeSource, { foreignKey: 'knowledge_source_id', as: 'source' });
KnowledgeChunk.belongsTo(Agent, { foreignKey: 'agent_id', as: 'agent' });
KnowledgeChunk.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

export { KnowledgeChunk };
