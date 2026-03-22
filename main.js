const { app, BrowserWindow } = require("electron");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: true,
    kiosk: true,
    autoHideMenuBar: true,
    backgroundColor: "#0a0315",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile("index.html");

  //mainWindow.webContents.openDevTools({ mode: "detach" });
}

app.commandLine.appendSwitch("use-fake-ui-for-media-stream");

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});