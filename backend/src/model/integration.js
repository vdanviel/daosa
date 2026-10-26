import { DataTypes } from 'sequelize';
import { sequelize } from '../connection/database.js';
import { User } from './user.js';

const Integration = sequelize.define('Integration', 
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false },
    user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    provider: { type: DataTypes.STRING(50), allowNull: false },
    label: { type: DataTypes.STRING(150), allowNull: true },
    auth_type: {
      type: DataTypes.ENUM('none', 'api_key', 'oauth2', 'basic'),
      allowNull: false,
      defaultValue: 'api_key'
    },
    credentials: { type: DataTypes.TEXT, allowNull: true },
    metadata: { type: DataTypes.JSON, allowNull: true },
    status: {
      type: DataTypes.ENUM('active', 'processing', 'revoked', 'error' ),
      allowNull: false,
      defaultValue: 'active'
    },
    created_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW }
  }, 
  {
    tableName: 'integration',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['user_id', 'provider'] },
      { fields: ['status'] }
    ]
  }
);

Integration.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

User.addHook('beforeDestroy', async (user, options) => {
  await Integration.destroy({
    where: { user_id: user.id },
    transaction: options.transaction
  });
});

User.addHook('beforeBulkDestroy', async (options) => {
  if (options.individualHooks) return;

  const users = await User.findAll({
    where: options.where,
    attributes: ['id'],
    transaction: options.transaction
  });
  const userIds = users.map((user) => user.id);

  if (userIds.length > 0) {
    await Integration.destroy({
      where: { user_id: userIds },
      transaction: options.transaction
    });
  }
});

export { Integration };
