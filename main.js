const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { fork } = require('child_process');
const path = require('path');
const http = require('http');
const net = require('net');
const { autoUpdater } = require('electron-updater');

// Configure autoUpdater
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('update-available', () => {
  if (mainWindow) mainWindow.webContents.send('update-message', 'Downloading update...');
});

autoUpdater.on('update-not-available', () => {
  if (mainWindow) mainWindow.webContents.send('update-message', 'App is up to date.');
});

autoUpdater.on('update-downloaded', () => {
  if (mainWindow) mainWindow.webContents.send('update-message', 'Update ready to install!');
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: 'The update has finished downloading. Do you want to restart and install it now?',
    buttons: ['Restart Now', 'Later']
  }).then((returnValue) => {
    if (returnValue.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

autoUpdater.on('error', (err) => {
  console.error('Auto-updater error:', err);
  if (mainWindow) mainWindow.webContents.send('update-message', 'Error checking for updates.');
});

ipcMain.on('check-for-updates', () => {
  if (mainWindow) mainWindow.webContents.send('update-message', 'Checking for updates...');
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  } else {
    setTimeout(() => {
      if (mainWindow) mainWindow.webContents.send('update-message', 'Cannot update in dev mode.');
    }, 1500);
  }
});

let mainWindow;
let serverProcess;

function getFreePort(callback) {
  const srv = net.createServer(function(sock) {
    sock.end('Hello world\n');
  });
  srv.listen(0, function() {
    const port = srv.address().port;
    srv.close(function() {
      callback(port);
    });
  });
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Market Minds Scanner',
    autoHideMenuBar: true
  });
  mainWindow.loadURL('http://localhost:' + port);
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

function checkServerReady(url, timeout, cb) {
  const start = Date.now();
  const interval = setInterval(() => {
    if (Date.now() - start > timeout) {
      clearInterval(interval);
      cb(new Error('Timeout waiting for server'));
      return;
    }
    http.get(url, (res) => {
      clearInterval(interval);
      cb();
    }).on('error', () => {
      // Still waiting
    });
  }, 500);
}

app.on('ready', () => {
  // Try to load a .env file located right next to the .exe for easy configuration
  const fs = require('fs');
  const exeDir = path.dirname(process.execPath);
  const envPath = path.join(exeDir, '.env');
  let externalEnv = {};
  
  if (fs.existsSync(envPath)) {
    try {
      const dotenv = require(path.join(__dirname, 'server', 'node_modules', 'dotenv'));
      externalEnv = dotenv.parse(fs.readFileSync(envPath));
      console.log('Loaded external .env from:', envPath);
    } catch (e) {
      console.error('Failed to load external .env:', e);
    }
  }

  getFreePort((port) => {
    // In packaged app, files are under resources/app/
    // In dev, they are relative to __dirname
    const isPackaged = app.isPackaged;
    const appRoot = isPackaged ? path.join(process.resourcesPath, 'app') : __dirname;
    const serverPath = path.join(appRoot, 'server', 'dist', 'index.js');
    const serverCwd = path.join(appRoot, 'server');
    
    console.log('[main] isPackaged:', isPackaged);
    console.log('[main] serverPath:', serverPath);
    console.log('[main] serverCwd:', serverCwd);
    console.log('[main] exists:', fs.existsSync(serverPath));

    let serverErrorOutput = '';
    
    serverProcess = fork(serverPath, [], {
      cwd: serverCwd,
      env: { ...process.env, ...externalEnv, PORT: port.toString(), NODE_ENV: 'production', ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });

    if (serverProcess.stdout) {
      serverProcess.stdout.on('data', (data) => {
        console.log(`[server] ${data.toString()}`);
      });
    }
    
    if (serverProcess.stderr) {
      serverProcess.stderr.on('data', (data) => {
        const msg = data.toString();
        console.error(`[server-error] ${msg}`);
        serverErrorOutput += msg;
      });
    }

    serverProcess.on('exit', (code) => {
      console.log(`[server] exited with code ${code}`);
    });

    checkServerReady('http://localhost:' + port, 15000, (err) => {
      if (err) {
        console.error('Server failed to bind to ' + port, err);
        const { dialog } = require('electron');
        dialog.showErrorBox(
          'Server Error', 
          `The local scanner server failed to start.\n\nError Details:\n${serverErrorOutput || 'No error output captured. The process may have hung.'}`
        );
        app.quit();
        return;
      }
      createWindow(port);
      
      // Check for updates after the window is created
      if (app.isPackaged) {
        autoUpdater.checkForUpdatesAndNotify();
      }
    });
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
