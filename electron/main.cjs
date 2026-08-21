const { app, BrowserWindow, dialog, shell } = require('electron');
const { createServer } = require('node:http');
const { execFile, spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { mkdir, readFile, writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');

let pocketBase;
let webServer;
let quitting = false;

if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
  app.setPath('userData', join(process.env.LOCALAPPDATA, 'Dresden Heritage'));
}

function bundledPath(...parts) {
  return join(app.isPackaged ? process.resourcesPath : join(__dirname, '..'), ...parts);
}

async function availablePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolvePort(port));
    });
  });
}

async function ensureUserData() {
  const applicationData = app.getPath('userData');
  const dataRoot = join(applicationData, 'pb_data');
  const credentialsPath = join(applicationData, 'upload-credentials.json');
  await mkdir(applicationData, { recursive: true });
  await mkdir(dataRoot, { recursive: true });

  let credentials;
  try {
    credentials = JSON.parse(await readFile(credentialsPath, 'utf8'));
  } catch {
    credentials = { email: 'demo-upload@localhost.invalid', password: randomBytes(32).toString('base64url') };
    await writeFile(credentialsPath, `${JSON.stringify(credentials)}\n`, { mode: 0o600 });
  }
  return { dataRoot, credentials };
}

async function runPocketBase(binary, args) {
  return new Promise((resolveRun, reject) => {
    execFile(binary, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr.trim() || error.message));
      else resolveRun(stdout);
    });
  });
}

async function waitForPocketBase(url, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (pocketBase?.exitCode !== null) throw new Error('The local database stopped unexpectedly.');
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error('The local database did not start in time.');
}

async function startServices() {
  const { dataRoot, credentials } = await ensureUserData();
  const pocketBaseBinary = bundledPath(app.isPackaged ? 'pocketbase.exe' : 'DataBaseRead/09_Pocketbase-2D-3D/pocketbase.exe');
  const migrationsRoot = bundledPath(app.isPackaged ? 'pb_migrations' : 'DataBaseRead/09_Pocketbase-2D-3D/pb_migrations');
  const pocketBasePort = await availablePort();
  const appPort = await availablePort();
  const pocketBaseAddress = `127.0.0.1:${pocketBasePort}`;

  await runPocketBase(pocketBaseBinary, ['superuser', 'upsert', credentials.email, credentials.password, '--dir', dataRoot]);
  pocketBase = spawn(pocketBaseBinary, [
    'serve', '--dir', dataRoot, '--migrationsDir', migrationsRoot, '--http', pocketBaseAddress,
  ], { windowsHide: true, stdio: 'ignore' });
  await waitForPocketBase(`http://${pocketBaseAddress}`);

  Object.assign(process.env, {
    NODE_ENV: 'production', PORT: String(appPort), POCKETBASE_ADDRESS: pocketBaseAddress,
    POCKETBASE_SUPERUSER_EMAIL: credentials.email, POCKETBASE_SUPERUSER_PASSWORD: credentials.password,
    HERITAGE_ROOT: bundledPath(), HERITAGE_DATA_ROOT: dataRoot, HERITAGE_STATIC_ROOT: bundledPath('dist'),
  });
  const { handleProductionRequest } = await import(pathToFileURL(bundledPath('server.js')).href);
  webServer = createServer(handleProductionRequest);
  await new Promise((resolveListen, reject) => {
    webServer.once('error', reject);
    webServer.listen(appPort, '127.0.0.1', resolveListen);
  });
  return `http://127.0.0.1:${appPort}`;
}

async function createWindow(url) {
  const window = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 650, show: false, autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:\/\//i.test(target)) shell.openExternal(target);
    return { action: 'deny' };
  });
  await window.loadURL(url);
  window.show();
}

function stopServices() {
  if (webServer) webServer.close();
  if (pocketBase?.exitCode === null) pocketBase.kill();
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window) { if (window.isMinimized()) window.restore(); window.focus(); }
  });
  app.whenReady().then(async () => {
    try {
      await createWindow(await startServices());
    } catch (error) {
      dialog.showErrorBox('Dresden Heritage could not start', `${error.message}\n\nYour archive data has not been removed.`);
      app.quit();
    }
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => {
    if (!quitting) { quitting = true; stopServices(); }
  });
}
