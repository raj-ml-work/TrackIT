import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pgUrl = process.env.PG_URL || process.env.DATABASE_URL;
if (!pgUrl) {
  console.error('PG_URL is required to apply the schema.');
  process.exit(1);
}

const schemaPath = path.resolve(__dirname, '..', '..', 'database', 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

const client = new Client({ connectionString: pgUrl });

try {
  await client.connect();
  await client.query(schemaSql);
  console.log('Schema applied successfully.');
} catch (error) {
  console.error('Failed to apply schema:', error.message);
  process.exit(1);
} finally {
  await client.end();
}
