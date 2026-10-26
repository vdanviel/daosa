import { DataTypes } from 'sequelize';
import { sequelize } from '../connection/database.js';
import { Agent } from './agent.js';
import { User } from './user.js';

const Client = sequelize.define('Client', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false },
  agent_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  label: { type: DataTypes.STRING(30), allowNull: true },
  identifier: { type: DataTypes.STRING(255), allowNull: true },
  avatar_url: { type: DataTypes.STRING(2000), allowNull: true },
  profile_url: { type: DataTypes.STRING(2000), allowNull: true },
  metadata: { type: DataTypes.JSON, allowNull: true },
  do_not_contact: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  created_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
  deleted_at: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'client',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at',
  paranoid: true,
  indexes: [
    { fields: ['agent_id'] },
    { fields: ['user_id'] }
  ]
});

Client.belongsTo(Agent, { foreignKey: 'agent_id', as: 'agent' });
Client.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

export { Client };