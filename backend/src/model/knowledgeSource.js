import { DataTypes } from 'sequelize';
import { sequelize } from '../connection/database.js';
import { Agent } from './agent.js';
import { User } from './user.js';

const KnowledgeSource = sequelize.define('KnowledgeSource', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false },
  agent_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  type: { type: DataTypes.ENUM('file', 'url', 'text', 'video', 'image'), allowNull: true },
  title: { type: DataTypes.STRING(500), allowNull: true },
  file_name: { type: DataTypes.STRING(500), allowNull: true },
  file_path: { type: DataTypes.STRING(1000), allowNull: true },
  file_mime: { type: DataTypes.STRING(100), allowNull: true },
  file_size: { type: DataTypes.BIGINT, allowNull: true },
  file_extension: DataTypes.ENUM('docx', 'md', 'xlsx', 'csv', 'txt', 'pdf', 'png', 'jpg', 'jpeg', 'webp', 'mp4', 'mkv'),
  url: { type: DataTypes.STRING(2000), allowNull: true },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'processed', 'failed'),
    allowNull: true,
    defaultValue: 'pending'
  },
  error_message: { type: DataTypes.TEXT, allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW }
}, {
  tableName: 'knowledge_source',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

KnowledgeSource.belongsTo(Agent, { foreignKey: 'agent_id', as: 'agent' });
KnowledgeSource.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

export { KnowledgeSource };
