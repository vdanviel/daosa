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
    logging: false
  }
);

async function connectDatabase() {
  await sequelize.authenticate();
  await sequelize.sync();
  console.log('Successfully connected to database.');
}

export { sequelize, connectDatabase };