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
    where: { name: 'user-role' },
    defaults: {
      permissions: ['read:user', 'write:user', 'update:user', 'delete:user'],
      description: 'Permissões (scope) padrão de usuário para gerar JWT.',
      status: true
    }
  });
}

export { Role, initializeDefaultRole };