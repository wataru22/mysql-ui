const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('mysqlUiDesktop', {
  isElectron: true,
  platform: process.platform,
})
