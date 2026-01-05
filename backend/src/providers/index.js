import { createSqliteProvider } from './sqlite.js';
import { createPostgresProvider } from './postgres.js';

export const getProvider = async (config) => {
  if (config.dbProvider === 'sqlite') {
    return createSqliteProvider(config);
  }

  if (config.dbProvider === 'postgres') {
    return createPostgresProvider(config);
  }

  throw new Error(`Unsupported DB_PROVIDER: ${config.dbProvider}`);
};
