import { DataTypes } from 'sequelize';
import { sequelize } from '../../connection/database.js';

const Auth = sequelize.define('Auth', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  sub: { type: DataTypes.STRING, allowNull: false },
  ip: { type: DataTypes.STRING, allowNull: true },
  description: { type: DataTypes.STRING, allowNull: true },
  userAgent: { type: DataTypes.STRING, allowNull: true, field: 'user_agent' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  tableName: 'auth',
  timestamps: false
});

sequelize.sync();

export { Auth };