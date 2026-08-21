import { spawn } from 'node:child_process';
import { access, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pocketBaseRoot = join(root, 'DataBaseRead', '09_Pocketbase-2D-3D');
const mode = process.argv[2] === 'dev' ? 'dev' : 'production';
const defaultBinary = join(pocketBaseRoot, process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase');
const pocketBaseBinary = resolve(process.env.POCKETBASE_BIN || defaultBinary);
const pocketBaseAddress = process.env.POCKETBASE_ADDRESS || '127.0.0.1:8090';
const healthUrl = `http://${pocketBaseAddress}/api/health`;
const demoCredentialsPath = join(root, '.demo-upload-credentials.json');
const children = new Set();
let stopping = false;

async function requirePocketBase() {
  try {
    await access(pocketBaseBinary, constants.X_OK);
  } catch {
    throw new Error(
      `PocketBase executable not found at ${pocketBaseBinary}. `
      + 'Place the executable there or set POCKETBASE_BIN to its absolute path.',
    );
  }
}

async function configureDemoUploads() {
  if (process.env.DEMO_UPLOADS === '0' || process.env.POCKETBASE_UPLOAD_TOKEN
    || (process.env.POCKETBASE_SUPERUSER_EMAIL && process.env.POCKETBASE_SUPERUSER_PASSWORD)) return;
  let credentials;
  try {
    credentials = JSON.parse(await readFile(demoCredentialsPath, 'utf8'));
  } catch {
    credentials = {
      email: 'demo-upload@localhost.invalid',
      password: randomBytes(32).toString('base64url'),
    };
    await writeFile(demoCredentialsPath, `${JSON.stringify(credentials)}\n`, { mode: 0o600 });
  }
  process.env.POCKETBASE_SUPERUSER_EMAIL = credentials.email;
  process.env.POCKETBASE_SUPERUSER_PASSWORD = credentials.password;
  process.env.DEMO_UPLOAD_PROVISION = '1';
}

function start(command, args, options = {}) {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit', ...options });
  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
}

async function waitUntilReady(child, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`PocketBase stopped with exit code ${child.exitCode}.`);
    try {
      const response = await fetch(healthUrl);
      if (response.ok) return;
    } catch {
      // The service is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`PocketBase did not become ready at ${healthUrl}.`);
}

function stop(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill(signal);
  }
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('exit', () => stop());

try {
  await requirePocketBase();
  await configureDemoUploads();
  const pocketBase = start(pocketBaseBinary, [
    'serve',
    '--dir', join(pocketBaseRoot, 'pb_data'),
    '--migrationsDir', join(pocketBaseRoot, 'pb_migrations'),
    '--http', pocketBaseAddress,
  ]);
  await waitUntilReady(pocketBase);
  console.log(`PocketBase ready at http://${pocketBaseAddress}`);

  const app = mode === 'dev'
    ? start(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js')])
    : start(process.execPath, [join(root, 'server.js')], {
      env: { ...process.env, NODE_ENV: 'production' },
    });
  pocketBase.once('exit', (code) => {
    if (!stopping) {
      console.error(`PocketBase stopped unexpectedly with exit code ${code ?? 1}.`);
      app.kill('SIGTERM');
    }
  });

  const exitCode = await new Promise((resolveExit) => app.once('exit', (code) => resolveExit(code ?? 1)));
  stop();
  process.exitCode = exitCode;
} catch (error) {
  console.error(error.message);
  stop();
  process.exitCode = 1;
}
