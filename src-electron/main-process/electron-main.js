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
  
  mainWindow.maximize()
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
      delete content.message
      const x = new Date(content.start_time)
      content.timestamp = +(x.setHours(x.getHours() + 2))
      content.sporttracker = 'Running'
      contents.push({ ...content, file })
    }
    contents = contents.filter(c => c.distance_km !== 0)
    event.reply('asynchronous-reply', { success: true, action: 'read-all-workouts', payload: contents })
  } catch (error) {
    event.reply('asynchronous-reply', { error: true, errorMessage: 'error while ', action: 'read-all-workouts' })
    console.error(error)
  }
})

ipcMain.on('convert-all-workouts', async (event, args) => {
  try {
    const { dir, workoutList, login, passwd } = JSON.parse(args)
    let response = await fs.readdirSync(`${dir}\\Workouts`)
    response = response.filter(f => f.indexOf('tcx') > -1)
    response = response.filter(f => workoutList.map(w => w.file).includes(f.replace('.tcx', '.json')))
    event.reply('asynchronous-reply', { update: 'Workouts loaded', action: 'convert-all-workouts', payload: response.length })

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
          const gpx = fs.readFileSync(`${dir}\\GPX\\${file.replace('.tcx', '.gpx')}`, null)
          fileBuffers.push(gpx.toString('base64'))
          event.reply('asynchronous-reply', { update: 'Workout converted .tcx > .gpx', action: 'convert-all-workouts', payload: `${file.replace('.tcx', '.gpx')}` })
        }).catch((cError) => {
          console.error(JSON.stringify(cError));
        });
      })
    }
    event.reply('asynchronous-reply', { update: 'Converting process finished', action: 'convert-all-workouts', payload: 'success' })
    event.reply('asynchronous-reply', { success: true, action: 'convert-all-workouts' })

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
    event.reply('asynchronous-reply', { update: 'Start batch importing', action: 'convert-all-workouts', payload: 'success' })
    
    await win.webContents.on('did-finish-load', async (evt, result) => {

      win.webContents.executeJavaScript(`
        const init = async () => {
          const wait = async (selector) => {
            while(!document.querySelector(selector)) {
              await new Promise(r => setTimeout(r, 1500));
            }
          }
          const waitFor = async (seconds) => {
            await new Promise(r => setTimeout(r, seconds * 1000));
          }
          const payload = JSON.parse('${JSON.stringify(workoutList)}');
          if (document.querySelector('.username') && document.querySelector('.password')) {
            document.querySelector('.username').value = '${login}';
            document.querySelector('.password').value = '${passwd}';
            document.querySelector('.submit').dispatchEvent(new Event('click'));
          }

          await wait('.add-workout');
          document.querySelector('.add-workout').dispatchEvent(new Event('click'));

          await wait('.import-button');
          document.querySelector('.import-button').dispatchEvent(new Event('click'));

          await wait('[type="file"]');
          const dt = new DataTransfer();
          const x = [${fileBuffers.map(d => `'${d}'`)}];
          for (const item of x) {
            const response = await fetch('data:application/gpx+xml;base64,' + item);
            const file = new File([await response.blob()], 'yasio.gpx', {type: 'application/gpx+xml'});
            dt.items.add(file);
          }
          document.querySelector('[type="file"]').files = dt.files;
          await waitFor(2);

          document.querySelector('[type="file"]').dispatchEvent(new Event('change', { bubbles: true }));
          
          await waitFor(2);
          await wait('.save-button');

          await waitFor(2);
          await wait('.select-sharing');
          [...document.querySelectorAll('.select-sharing')].forEach(s => {
            if (s) { 
              s.querySelector('option[selected]').remove();
              s.querySelector('option[value="string:Friends"]')?.setAttribute('selected', 'selected');
            }
          });
          await waitFor(1);
          document.querySelectorAll('.select-sharing').forEach(e => e.dispatchEvent(new Event('input', { bubbles: true })));
          document.querySelectorAll('.select-sharing').forEach(e => e.dispatchEvent(new Event('change', { bubbles: true })));
          
          await waitFor(2);
          await wait('.select-activity');
          [...document.querySelectorAll('[selected-date]')].forEach(el => {
            const parent = el.closest('ul');
            console.log('parent: ', parent);

            if (payload.find(f => f.timestamp == el.attributes['selected-date'].value)) {
              if (parent && parent.querySelector('.select-activity') && parent.querySelector('.select-activity') !== null) {
                const newVal = payload.find(f => f.timestamp == el.attributes['selected-date'].value).sporttracker;
                console.log('newVal: ', newVal);
                parent.querySelector('.select-activity option[selected]').remove();
                parent.querySelector('.select-activity option[label="'+newVal+'"]')?.setAttribute('selected', 'selected');
              }
            }
          })
          document.querySelectorAll('.select-activity').forEach(e => e.dispatchEvent(new Event('input', { bubbles: true })));
          document.querySelectorAll('.select-activity').forEach(e => e.dispatchEvent(new Event('change', { bubbles: true })));

          await waitFor(1);
          document.querySelector('.save-button').dispatchEvent(new Event('click'));
          //await waitFor(2);
          console.log('done');
        }
        init();
      `).then(() => {
        event.reply('asynchronous-reply', { part: true, action: 'convert-all-workouts', payload: 'success' })
        setTimeout(() => {
          win.destroy()
        }, 2000)
      }).catch(err => {
        event.reply('asynchronous-reply', { error: true, errorMessage: JSON.stringify(err), action: 'convert-all-workouts' })
        console.error(err)
      })
    })

  } catch (error) {
    event.reply('asynchronous-reply', { error: true, errorMessage: JSON.stringify(error), action: 'convert-all-workouts' })
    console.error(error)
  }
})
