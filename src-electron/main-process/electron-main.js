import { app, BrowserWindow, nativeTheme, ipcMain } from 'electron'
import { SportsLib } from '@sports-alliance/sports-lib'
import { EventExporterGPX } from '@sports-alliance/sports-lib/lib/events/adapters/exporters/exporter.gpx.js'
import { DOMParser } from 'xmldom'

// const puppeteer = require('puppeteer')
const path = require('path')
const fs = require('fs')
const domParser = new DOMParser()

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
    const { dir, workoutList, login, passwd } = args
    let response = await fs.readdirSync(`${dir}\\Workouts`)
    response = response.filter(f => f.indexOf('tcx') > -1)
    response = response.filter(f => workoutList.map(w => w.file).includes(f.replace('.tcx', '.json')))
    const responseGPX = []
    event.reply('asynchronous-reply', { update: 'Workouts loaded', action: 'convert-all-workouts', payload: response.length })
    let contents = []
    if (!fs.existsSync(`${dir}\\GPX`)){
      fs.mkdirSync(`${dir}\\GPX`);
    }
    const fileBuffers = []
    for await (const file of response) {
      const f = await fs.readFileSync(`${dir}\\Workouts\\${file}`, null)
      SportsLib.importFromTCX(domParser.parseFromString(f.toString(), 'application/xml')).then((evt) => {
        const gpxPromise = new EventExporterGPX().getAsString(evt);
        gpxPromise.then((gpxString) => {
          fs.writeFileSync(`${dir}\\GPX\\${file.replace('.tcx', '.gpx')}`, gpxString, (wError) => {
            if (wError) { console.error(JSON.stringify(wError)); }
          });
          // responseGPX.push(`${dir}\\GPX\\${file.replace('.tcx', '.gpx')}`)
          const gpx = fs.readFileSync(`${dir}\\GPX\\${file.replace('.tcx', '.gpx')}`, null)
          fileBuffers.push(gpx.toString('base64'))
          event.reply('asynchronous-reply', { update: 'Workout converted .tcx > .gpx', action: 'convert-all-workouts', payload: `${file.replace('.tcx', '.gpx')}` })
        }).catch((cError) => {
          console.error(JSON.stringify(cError));
        });
      })
    }
    event.reply('asynchronous-reply', { update: 'Process finished', action: 'convert-all-workouts', payload: 'success' })
    event.reply('asynchronous-reply', { success: true, action: 'convert-all-workouts' })
    // const firstFileBuffer = await fs.readFileSync(responseGPX[0], null)

    console.log('fileBuffers: ', fileBuffers.length);
    const win = new BrowserWindow({
      show: true,
      // modal: true,
      // skipTaskbar: true,
      // frame: false,
      webPreferences: {
        nodeIntegration: false,
        devTools: true
        // preload: true
        // webSecurity: false
      }
    })
    win.loadURL('https://www.sports-tracker.com/login')
    await win.webContents.on('did-finish-load', async (event, result) => {
      
      await win.webContents.executeJavaScript(`
        const init = async () => {
          // helper wait for selector function
          const wait = async (selector) => {
            while(!document.querySelector(selector)) {
              await new Promise(r => setTimeout(r, 1500));
            }
          }
          const waitFor = async (seconds) => {
            await new Promise(r => setTimeout(r, seconds * 1000));
          }

          document.querySelector('.username').value = '${login}'
          document.querySelector('.password').value = '${passwd}'
          document.querySelector('.submit').dispatchEvent(new Event('click'))

          await wait('.add-workout')
          document.querySelector('.add-workout').dispatchEvent(new Event('click'))

          await wait('.import-button')
          document.querySelector('.import-button').dispatchEvent(new Event('click'))

          await wait('[type="file"]')
          const dt = new DataTransfer()
          const x = [${fileBuffers.map(d => `'${d}'`)}];
          for (const item of x) {
            const response = await fetch('data:application/gpx+xml;base64,' + item);
            const file = new File([await response.blob()], 'yasio.gpx', {type: 'application/gpx+xml'});
            dt.items.add(file);
          }
          document.querySelector('[type="file"]').files = dt.files;

          setTimeout(async () => {
            document.querySelector('[type="file"]').dispatchEvent(new Event('change', { bubbles: true }));

            await waitFor(2);
            await wait('.save-button');
            
            await waitFor(2);
            await wait('.select-sharing');
            [...document.querySelectorAll('.select-sharing')].forEach(s => { if (s) s.value = "string:Friends"});
            
            await waitFor(2);
            await wait('.select-activity');
            [...document.querySelectorAll('.select-activity')].forEach(s => { if (s) s.value = "object:309"});
            [...document.querySelectorAll('[selected-date]')].forEach(el => {
              console.log(el)
              console.log(el.closest('ul'))
              console.log(el.attributes['selected-date'].value)
              })

            // document.querySelector('.save-button').dispatchEvent(new Event('click'))
          }, 2000)
        }
        init()
      `)
      // console.log('zalogowano');
      // win.webContents.once('did-navigate', () => {
      //   console.log("1Main view logs this no problem....", win.webContents.getURL());
      //   win.webContents.once('dom-ready', () => {
      //         console.log("Main view logs this no problem....", win.webContents.getURL());
      //         // document.querySelector('.add-workout').dispatchEvent(new Event('click'))
      //         //     win.webContents.executeJavaScript(`
      //         //     `)
      //   })
      // })
    })

    // const browser = await puppeteer.launch({
    //   headless: false,
    //   args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox']
    // });
    // const page = await browser.newPage();
    // await page.goto('https://www.sports-tracker.com/login', {
    //   waitUntil: 'networkidle2',
    // })
    // await page.type('.username', login)
    // await page.type('.password', passwd)
    // await page.click('.submit')
  } catch (error) {
    event.reply('asynchronous-reply', { error: true, errorMessage: JSON.stringify(error), action: 'convert-all-workouts' })
    console.error(error)
  }
})
