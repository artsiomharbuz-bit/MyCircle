import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const envPath = '.env';
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[1] in process.env) continue;
    process.env[match[1]] = match[2].replace(/^("|')(.*)\1$/, '$2');
  }
}

if (!process.env.SUPABASE_ACCESS_TOKEN) {
  throw new Error('Add SUPABASE_ACCESS_TOKEN to the root .env before deploying the Edge Function.');
}

const projectRef = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const poolerUrl = process.env.APP_DATABASE_POOLER_URL ?? (() => {
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) throw new Error('Set SUPABASE_DB_PASSWORD or APP_DATABASE_POOLER_URL in the root .env.');
  // This project's Supabase database resolves to AWS eu-west-1. Use its
  // shared transaction pooler for serverless Edge Function isolates.
  const user = encodeURIComponent(`postgres.${projectRef}`);
  const secret = encodeURIComponent(password);
  return `postgresql://${user}:${secret}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require`;
})();

// Supabase Edge Functions scale across isolates, so persist the transaction
// pooler URL as a server-side secret instead of using one direct DB connection
// per isolate. Keep credentials out of process arguments and console output.
const secretsFile = path.join(os.tmpdir(), `mycircle-supabase-secrets-${process.pid}.env`);
fs.writeFileSync(secretsFile, `APP_DATABASE_POOLER_URL=${JSON.stringify(poolerUrl)}\n`, { mode: 0o600 });
const secretsResult = spawnSync('npx', [
  '--yes', 'supabase', 'secrets', 'set', '--env-file', secretsFile, '--project-ref', projectRef,
], { stdio: 'inherit', env: process.env });
fs.rmSync(secretsFile, { force: true });
if (secretsResult.error) throw secretsResult.error;
if (secretsResult.status !== 0) process.exit(secretsResult.status ?? 1);

const result = spawnSync('npx', [
  '--yes', 'supabase', 'functions', 'deploy', 'api', '--project-ref', projectRef,
], { stdio: 'inherit', env: process.env });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
