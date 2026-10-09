import { DataTypes } from 'sequelize';
import { sequelize } from '../../connection/database.js';

const Role = sequelize.define('Role', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  permissions: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  description: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  tableName: 'role',
  timestamps: false
});

async function initializeDefaultRole() {
  await Role.findOrCreate({
    where: { name: 'customer-role' },
    defaults: {
      permissions: ['read:customer', 'write:customer', 'update:customer', 'delete:customer'],
      description: 'Permissões (scope) do cliente padrão. Usado para gerar JWT no sistema web service.',
      status: true
    }
  });
}

export { Role, initializeDefaultRole };