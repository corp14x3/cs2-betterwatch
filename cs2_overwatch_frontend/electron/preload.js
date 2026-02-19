const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  getSettings:   ()              => ipcRenderer.invoke('get-settings'),
  saveSettings:  (data)          => ipcRenderer.invoke('save-settings', data),
  saveDemo: (fileName, buffer) => ipcRenderer.invoke('save-demo', { fileName, buffer }),
  deleteDemo:    (filePath)      => ipcRenderer.invoke('delete-demo', filePath),
  selectFolder:  ()              => ipcRenderer.invoke('select-folder'),
  saveCredentials: (email, password) => ipcRenderer.invoke('save-credentials', { email, password }),
  getCredentials:  ()            => ipcRenderer.invoke('get-credentials'),
  clearCredentials: ()           => ipcRenderer.invoke('clear-credentials'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
})