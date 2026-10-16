import dotenv from 'dotenv';

dotenv.config();

const values = Object.freeze({
  APP_NAME: process.env.APP_NAME || 'Company',
  CURRENT_ENVIRONMENT: process.env.CURRENT_ENVIRONMENT || 'dev',
  DB_NAME: process.env.DB_NAME || '',
  DB_USER: process.env.DB_USER || '',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_HOST: process.env.DB_HOST || '127.0.0.1',
  DB_PORT: Number(process.env.DB_PORT || 3306),
  DB_DIALECT: process.env.DB_DIALECT || 'mysql',
  JWT_SECRET: process.env.JWT_SECRET,
  MAIL_HOST: process.env.MAIL_HOST,
  MAIL_PORT: process.env.MAIL_PORT,
  MAIL_USERNAME: process.env.MAIL_USERNAME,
  MAIL_PASSWORD: process.env.MAIL_PASSWORD,
  MAIL_FROM_ADDRESS: process.env.MAIL_FROM_ADDRESS,
  MAIL_FROM_NAME: process.env.MAIL_FROM_NAME,
  PORT: Number(process.env.PORT || 3000),
  SESSION_SECRET_PASS: process.env.SESSION_SECRET_PASS,
  SPA_APPLICATION_URL: process.env.SPA_APPLICATION_URL,
  LLM_PROVIDER: process.env.LLM_PROVIDER,
  LLM_BASE_URL: process.env.LLM_BASE_URL,
  LLM_MODEL: process.env.LLM_MODEL
});

class Env {
  static getAppName() { return values.APP_NAME; }
  static getCurrentEnvironment() { return values.CURRENT_ENVIRONMENT; }
  static getDbName() { return values.DB_NAME; }
  static getDbUser() { return values.DB_USER; }
  static getDbPassword() { return values.DB_PASSWORD; }
  static getDbHost() { return values.DB_HOST; }
  static getDbPort() { return values.DB_PORT; }
  static getDbDialect() { return values.DB_DIALECT; }
  static getJwtSecret() { return values.JWT_SECRET; }
  static getMailHost() { return values.MAIL_HOST; }
  static getMailPort() { return values.MAIL_PORT; }
  static getMailUsername() { return values.MAIL_USERNAME; }
  static getMailPassword() { return values.MAIL_PASSWORD; }
  static getMailFromAddress() { return values.MAIL_FROM_ADDRESS; }
  static getMailFromName() { return values.MAIL_FROM_NAME; }
  static getPort() { return values.PORT; }
  static getSessionSecretPass() { return values.SESSION_SECRET_PASS; }
  static getSpaApplicationUrl() { return values.SPA_APPLICATION_URL; }
  static getLlmProvider() { return values.LLM_PROVIDER; }
  static getLlmUrl() { return values.LLM_BASE_URL; }
  static getLlmModel() { return values.LLM_MODEL; }

  static validate() {
    const weakSecrets = [
      ['JWT_SECRET', this.getJwtSecret()],
      ['SESSION_SECRET_PASS', this.getSessionSecretPass()]
    ].filter(([, secret]) => {
      return typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32;
    }).map(([key]) => key);

    if (weakSecrets.length > 0) {
      throw new Error(
        `Invalid environment configuration: ${weakSecrets.join(', ')} must each contain at least 32 bytes of random data.`
      );
    }

    const port = this.getPort();
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('Invalid environment configuration: PORT must be an integer between 1 and 65535.');
    }
  }
}

export default Env;