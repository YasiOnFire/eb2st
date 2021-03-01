import { app, BrowserWindow, nativeTheme, ipcMain } from 'electron'
import { SportsLib } from '@sports-alliance/sports-lib'
import { EventExporterGPX } from '@sports-alliance/sports-lib/lib/events/adapters/exporters/exporter.gpx.js'
import { DOMParser } from 'xmldom'

const path = require('path')
const fs = require('fs')
const domParser = new DOMParser();

try {
  if (process.platform === 'win32' && nativeTheme.shouldUseDarkColors === true) {
    require('fs').unlinkSync(require('path').join(app.getPath('userData'), 'DevTools Extensions'))
  }
} catch (_) { }

/**
 * Set `__statics` path to static files in production;
 * The reason we are setting it here is that the path needs to be evaluated at runtime
 */
if (process.env.PROD) {
  global.__statics = __dirname
}

let mainWindow

function createWindow () {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    width: 1800,
    height: 700,
    useContentSize: true,
    frame: false,
    webPreferences: {
      // Change from /quasar.conf.js > electron > nodeIntegration;
      // More info: https://quasar.dev/quasar-cli/developing-electron-apps/node-integration
      nodeIntegration: process.env.QUASAR_NODE_INTEGRATION,
      nodeIntegrationInWorker: process.env.QUASAR_NODE_INTEGRATION,

      // More info: /quasar-cli/developing-electron-apps/electron-preload-script
      // preload: path.resolve(__dirname, 'electron-preload.js')
    }
  })

  mainWindow.loadURL(process.env.APP_URL)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

ipcMain.on('validate-endo-dir', (event, arg) => {
  try {
    console.log('arg: ', arg);
    const dir = path.dirname(JSON.parse(arg))
    const response = fs.readdirSync(dir)
    if (!response.includes('Workouts') || !response.includes('resources')) {
      event.reply('asynchronous-reply', { error: true, errorMessage: 'invalid endomondo folder', action: 'validate-endo-dir' })
    } else {
      event.reply('asynchronous-reply', { success: true, action: 'validate-endo-dir', dir })
    }
  } catch (error) {
    event.reply('asynchronous-reply', { error: true, errorMessage: 'invalid endomondo folder', action: 'validate-endo-dir' })
    console.error(error)
  }
})

ipcMain.on('read-all-workouts', async (event, dir) => {
  try {
    let response = await fs.readdirSync(`${dir}\\Workouts`)
    response = response.filter(f => f.indexOf('json') > -1)
    let contents = []
    for (const file of response) {
      const content = Object.assign({}, ...JSON.parse(fs.readFileSync(`${dir}\\Workouts\\${file}`, 'utf8')))
      delete content.points
      contents.push({ ...content, file })
    }
    event.reply('asynchronous-reply', { success: true, action: 'read-all-workouts', payload: contents })
  } catch (error) {
    event.reply('asynchronous-reply', { error: true, errorMessage: 'error while ', action: 'read-all-workouts' })
    console.error(error)
  }
})

ipcMain.on('convert-all-workouts', async (event, args) => {
  try {
    const { dir, workoutList } = args
    let response = await fs.readdirSync(`${dir}\\Workouts`)
    response = response.filter(f => f.indexOf('tcx') > -1)
    response = response.filter(f => workoutList.map(w => w.file).includes(f.replace('.tcx', '.json')))
    event.reply('asynchronous-reply', { update: 'Workouts loaded', action: 'convert-all-workouts', payload: response.length })
    let contents = []
    if (!fs.existsSync(`${dir}\\GPX`)){
      fs.mkdirSync(`${dir}\\GPX`);
    } else {

    }
    for await (const file of response) {
      const f = await fs.readFileSync(`${dir}\\Workouts\\${file}`, null)
      SportsLib.importFromTCX(domParser.parseFromString(f.toString(), 'application/xml')).then((evt) => {
        const gpxPromise = new EventExporterGPX().getAsString(evt);
        gpxPromise.then((gpxString) => {
          fs.writeFileSync(`${dir}\\GPX\\${file.replace('.tcx', '.gpx')}`, gpxString, (wError) => {
            if (wError) { console.error(JSON.stringify(wError)); }
          });
          event.reply('asynchronous-reply', { update: 'Workout converted .tcx > .gpx', action: 'convert-all-workouts', payload: `${file.replace('.tcx', '.gpx')}` })
        }).catch((cError) => {
            console.error(JSON.stringify(cError));
        });
      })
    }
    event.reply('asynchronous-reply', { update: 'Process finished', action: 'convert-all-workouts', payload: 'success' })
    event.reply('asynchronous-reply', { success: true, action: 'convert-all-workouts' })

  } catch (error) {
    event.reply('asynchronous-reply', { error: true, errorMessage: JSON.stringify(error), action: 'convert-all-workouts' })
    console.error(error)
  }
})
