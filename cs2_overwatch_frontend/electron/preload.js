const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  getSettings:  ()           => ipcRenderer.invoke('get-settings'),
  saveSettings: (data)       => ipcRenderer.invoke('save-settings', data),
  saveDemo:     (fileName, buffer) => ipcRenderer.invoke('save-demo', { fileName, buffer }),
  deleteDemo:   (filePath)   => ipcRenderer.invoke('delete-demo', filePath),
  selectFolder: ()           => ipcRenderer.invoke('select-folder'),
})