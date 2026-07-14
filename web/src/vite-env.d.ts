/// <reference types="vite/client" />

interface MysqlUiDesktop {
  isElectron: boolean
  platform: string
}

interface Window {
  mysqlUiDesktop?: MysqlUiDesktop
}
