import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const idx = trimmed.indexOf('=');
    if (idx === -1) {
      continue;
    }
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function run(scriptName) {
  const scriptPath = path.resolve(__dirname, scriptName);
  const result = spawnSync(process.execPath, [scriptPath], {
    stdio: 'inherit',
    env: process.env
  });

  process.exit(result.status ?? 1);
}

loadEnv(path.resolve(ROOT_DIR, '.env'));
loadEnv(path.resolve(__dirname, '.env'));
loadEnv(path.resolve(ROOT_DIR, 'server', '.env'));

const target = process.env.MIGRATION_TARGET;
if (target === 'supabase') {
  run('migrate_supabase.js');
} else if (target === 'local') {
  run('migrate_local_db.js');
} else if (process.env.VITE_API_URL) {
  run('migrate_local_db.js');
} else {
  run('migrate_supabase.js');
}
