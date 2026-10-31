import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const variant = process.argv[2];
if (!['preview', 'development'].includes(variant)) {
  throw new Error('Usage: node scripts/buildAndroid.mjs <preview|development>');
}

const root = process.cwd();
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[1] in process.env) continue;
    process.env[match[1]] = match[2].replace(/^("|')(.*)\1$/, '$2');
  }
}

process.env.APP_VARIANT = variant;
process.env.NODE_ENV = variant === 'preview' ? 'production' : 'development';
process.env.ANDROID_HOME ??= '/home/artsiom/Android/Sdk';
process.env.ANDROID_SDK_ROOT ??= process.env.ANDROID_HOME;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('npx', ['expo', 'prebuild', '--platform', 'android', '--clean']);
run('./gradlew', [
  variant === 'preview' ? 'assembleRelease' : 'assembleDebug',
  '-Dorg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=768m',
  '--max-workers=2',
  '-PreactNativeArchitectures=arm64-v8a',
], {
  cwd: path.join(root, 'android'),
});

const buildType = variant === 'preview' ? 'release' : 'debug';
const apk = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', buildType, `app-${buildType}.apk`);
const output = path.join(root, 'artifacts', `mycircle-${variant}.apk`);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.copyFileSync(apk, output);
console.log(`Built ${output}`);
