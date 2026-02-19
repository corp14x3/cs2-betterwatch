const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { Menu } = require('electron')
const isDev = !app.isPackaged

const CREDS_PATH = path.join(app.getPath('userData'), 'creds.json')

ipcMain.handle('save-credentials', (_, { email, password }) => {
  fs.writeFileSync(CREDS_PATH, JSON.stringify({ email, password }))
  return true
})

ipcMain.handle('get-credentials', () => {
  try { return JSON.parse(fs.readFileSync(CREDS_PATH, 'utf-8')) }
  catch { return null }
})

ipcMain.handle('clear-credentials', () => {
  if (fs.existsSync(CREDS_PATH)) fs.unlinkSync(CREDS_PATH)
  return true
})



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

  // F12 ile DevTools aç/kapat
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      if (win.webContents.isDevToolsOpened()) {
        win.webContents.closeDevTools()
      } else {
        win.webContents.openDevTools()
      }
    }
  })
}

app.whenReady().then(() => {
  const { session } = require('electron')

  // Cookie'lerin localhost'a gönderilmesine izin ver
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    callback({ requestHeaders: { ...details.requestHeaders } })
  })

  // HTTPS cookie'leri Electron'da çalıştır
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders }
    if (headers['set-cookie']) {
      headers['set-cookie'] = headers['set-cookie'].map(cookie => {
        if (!cookie.includes('SameSite')) {
          cookie += '; SameSite=None; Secure'
        }
        return cookie
      })
    }
    callback({ responseHeaders: headers })
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
  fs.writeFileSync(filePath, Buffer.from(buffer))  // main.js'te Buffer kullanmak güvenli
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