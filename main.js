// Modules to control application life and create native browser window
const {shell, app, BrowserWindow, globalShortcut, ipcMain } = require('electron')
const path = require('path')
const XORDecipher = require('./XOR.js')
var events = require('events');

var mainWindow = null;

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 600,
    minWidth : 1100,
    minHeight : 600,
    maxWidth : 1100,
    maxWidth : 600,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true
    }
  });

  mainWindow.setMenu(null)

  // DEV RELOAD
  globalShortcut.register('f5', function() {
		mainWindow.reload()
	})
	globalShortcut.register('CommandOrControl+R', function() {
		mainWindow.reload()
	})

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

ipcMain.on('openFolder', async function(event, arg){
  shell.openItem(arg)
});

//TOTAL DECRYPTION
ipcMain.on('decryption', async function(event, arg){
    var completed = 0;
    var full = 0;
  XORDecipher.events.on("decrypted-one", function(){
    completed++;
  });
  XORDecipher.events.on("progressLength", function(e){
    full = e.progressLength;
  });
  var interval = setInterval(function(){
    if(full){
      mainWindow.webContents.send("progressPercent", Math.floor(completed*100/full));
    }else{
      mainWindow.webContents.send("progressPercent", 0);
    }
  }, 500);
  var decryptedPossibilities = await XORDecipher.decryptFile(arg);
  clearInterval(interval);

  XORDecipher.events = new events.EventEmitter();

  event.sender.send("results", {solutions : decryptedPossibilities, action : "decryption"});
});

//WITH KEY
ipcMain.on('decrypt-with-key', async function(event, arg){
  var decryption = await XORDecipher.decryptFileWithKey(arg.file, arg.key);

  event.sender.send("results", {solutions : [decryption], action : "decrypt-with-key"});
});

//ANALYZE BLOCKS
ipcMain.on('analyze-blocks', async function(event, arg){
  var completed = 0;
  var full = 0;
  await XORDecipher.events.on("analyzed-one", function(){
    completed++;
    if(full){
      mainWindow.webContents.send("progressPercent", Math.floor(completed*100/full));
    }else{
      mainWindow.webContents.send("progressPercent", 0);
    }
  });
  await XORDecipher.events.on("progressLength", function(e){
    full = e.progressLength;
  });

  XORDecipher.analyzeBlocks(arg).then(sol => {
    XORDecipher.events = new events.EventEmitter();
    event.sender.send("results", {solutions : sol, action : "analyze-blocks"});
  });
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
