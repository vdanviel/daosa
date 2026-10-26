import { DataTypes, Sequelize } from 'sequelize';
import Env from '../util/Env.js';

const sequelize = new Sequelize(
  Env.getDbName(),
  Env.getDbUser(),
  Env.getDbPassword(),
  {
    host: Env.getDbHost(),
    port: Env.getDbPort(),
    dialect: Env.getDbDialect(),
    logging: false,
    timezone: '-03:00'
  }
);

async function connectDatabase() {
  await sequelize.authenticate();
  await sequelize.sync();
  const queryInterface = sequelize.getQueryInterface();
  const channelColumns = await queryInterface.describeTable('channel');
  if (!channelColumns.icon_url) {
    await queryInterface.addColumn('channel', 'icon_url', {
      type: DataTypes.STRING(2000),
      allowNull: true
    });
  }
  console.log('Successfully connected to database.');
}

export { sequelize, connectDatabase };