import { DataTypes } from 'sequelize';
import { sequelize } from '../../connection/database.js';

const PersonalAccessToken = sequelize.define('PersonalAccessToken', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  tokenable_type: { type: DataTypes.STRING, allowNull: true },
  tokenable_id: { type: DataTypes.STRING(36), allowNull: true },
  name: { type: DataTypes.STRING, allowNull: true },
  secret: { type: DataTypes.STRING, allowNull: true },
  token: { type: DataTypes.STRING, allowNull: true },
  abilities: { type: DataTypes.JSON, allowNull: true },
  last_used_at: { type: DataTypes.DATE, allowNull: true },
  expires_at: { type: DataTypes.DATE, allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  tableName: 'personal_access_token',
  timestamps: false
});

sequelize.sync();

export { PersonalAccessToken };