import { DataTypes } from 'sequelize';
import { sequelize } from '../connection/database.js';

const __TitleModuleName__ = sequelize.define('__TitleModuleName__', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  value_1: { type: DataTypes.STRING, allowNull: true },
  value_2: { type: DataTypes.STRING, allowNull: true },
  value_3: { type: DataTypes.STRING, allowNull: true },
  status: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  tableName: '__ModuleName__',
  timestamps: false
});

sequelize.sync();

export { __TitleModuleName__ };