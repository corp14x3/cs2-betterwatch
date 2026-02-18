const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { Menu } = require('electron')
const isDev = !app.isPackaged

function createWindow() {
  Menu.setApplicationMenu(null)
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      session: require('electron').session.defaultSession,
    },
    frame: true,
    title: 'CS2 BetterWatch',
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
  shell.openExternal(url)
  return { action: 'deny' }
  })
  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(app.getAppPath(), 'dist/index.html'))
  }
    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.log('Load failed:', errorCode, errorDescription)
  })
  
  win.webContents.on('did-finish-load', () => {
    console.log('Loaded successfully')
  })
}

app.whenReady().then(() => {
  // Cookie'lerin localhost'a gönderilmesine izin ver
  const { session } = require('electron')
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    callback({ requestHeaders: { ...details.requestHeaders } })
  })
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── Replays path kaydet/oku ───────────────────────────────────────────────────

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json')

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

function saveSettings(data) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2))
}

ipcMain.handle('get-settings', () => loadSettings())

ipcMain.handle('save-settings', (_, data) => {
  saveSettings({ ...loadSettings(), ...data })
  return true
})

// ── Demo dosyasını replays klasörüne kaydet ───────────────────────────────────

ipcMain.handle('save-demo', async (_, { fileName, buffer }) => {
  const settings = loadSettings()
  const replaysPath = settings.replaysPath

  if (!replaysPath) throw new Error('Replays path ayarlanmamış')
  if (!fs.existsSync(replaysPath)) throw new Error('Replays klasörü bulunamadı')

  const filePath = path.join(replaysPath, fileName)
  fs.writeFileSync(filePath, Buffer.from(buffer))
  return filePath
})

// ── Demo dosyasını sil ────────────────────────────────────────────────────────

ipcMain.handle('delete-demo', (_, filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
    return true
  }
  return false
})

// ── Klasör seç dialog ─────────────────────────────────────────────────────────

const { dialog } = require('electron')

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  if (!result.canceled) return result.filePaths[0]
  return null
})