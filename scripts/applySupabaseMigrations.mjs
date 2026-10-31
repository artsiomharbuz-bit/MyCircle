import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.trim().startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^(["'])(.*)\1$/, '$2')];
    })
);

const databasePassword = env.SUPABASE_DB_PASSWORD;
const databaseUrl = env.APP_DATABASE_POOLER_URL ?? env.SUPABASE_DB_URL;
const projectUrl = env.EXPO_PUBLIC_SUPABASE_URL;
if ((!databasePassword && !databaseUrl) || !projectUrl) {
  throw new Error('Set SUPABASE_DB_PASSWORD (or APP_DATABASE_POOLER_URL) and EXPO_PUBLIC_SUPABASE_URL in the root .env file.');
}

const projectRef = new URL(projectUrl).hostname.split('.')[0];
const migrationDirectory = path.join('supabase', 'migrations');
const migrations = fs.readdirSync(migrationDirectory).filter((file) => file.endsWith('.sql')).sort();
const client = new pg.Client({
  ...(databaseUrl
    ? { connectionString: databaseUrl }
    : {
        host: `db.${projectRef}.supabase.co`,
        port: 5432,
        user: 'postgres',
        database: 'postgres',
        password: databasePassword,
      }),
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  for (const migration of migrations) {
    await client.query('begin');
    try {
      await client.query(fs.readFileSync(path.join(migrationDirectory, migration), 'utf8'));
      await client.query('commit');
      console.log(`Applied ${migration}`);
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  }
} finally {
  await client.end().catch(() => {});
}
