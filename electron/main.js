// Desktop mode: boots the same Express server on a free local port,
// stores data in Electron's userData dir, and opens a window auto-logged-in as admin.
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const crypto = require('crypto');
const { gateLicense, registerLicenseIpc } = require('./license-gate');

let win;

app.whenReady().then(async () => {
  if (!(await gateLicense())) return; // quit already requested
  registerLicenseIpc();

  const dataDir = path.join(app.getPath('userData'), 'data');
  const autologinToken = crypto.randomBytes(24).toString('hex');

  const { createApp } = require(path.join(__dirname, '..', 'server', 'app.js'));
  const { runRecurringSweep } = require(path.join(__dirname, '..', 'server', 'recurring.js'));
  const server = createApp({ dataDir, autologinToken, adminPassword: process.env.ADMIN_PASSWORD || 'admin' });

  try {
    runRecurringSweep(server.locals.db);
  } catch (e) {
    console.error('[recurring] boot sweep failed:', e.message);
  }
  const sweepInterval = setInterval(() => {
    try {
      runRecurringSweep(server.locals.db);
    } catch (e) {
      console.error('[recurring] daily sweep failed:', e.message);
    }
  }, 24 * 3600 * 1000);

  // listen on port 0 → OS picks a free port (no collisions with a VPS install)
  const listener = server.listen(0, '127.0.0.1', () => {
    const port = listener.address().port;
    win = new BrowserWindow({
      width: 1360,
      height: 900,
      autoHideMenuBar: true,
      backgroundColor: '#09090b',
      title: 'Ledgerly',
      webPreferences: { contextIsolation: true, nodeIntegration: false }
    });
    win.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });
    win.loadURL(`http://127.0.0.1:${port}/auth/auto?token=${autologinToken}`);
  });

  app.on('window-all-closed', () => {
    clearInterval(sweepInterval);
    listener.close();
    app.quit();
  });
});
