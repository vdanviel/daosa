import { Sequelize } from 'sequelize';
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

  console.log(`Successfully connected to database (${sequelize.config.database}@${sequelize.config.host}:${sequelize.config.port})`);
}

export { sequelize, connectDatabase };
