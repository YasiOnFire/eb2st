<template>
  <q-page class="flex flex-stretch">
    <q-stepper
      v-model="step"
      ref="stepper"
      dark
      class="bg-dark full-width borderless"
      active-color="accent"
      done-color="positive"
      animated
    >
      <q-step
        :name="1"
        title="Setup Endomondo Backup"
        icon="eva-cloud-upload-outline"
        :done="step > 1"
      >
        Select your endomondo backup folder.
        <q-file
          filled
          v-model="endoFolder"
          dark
          class="q-my-md"
          label="browse..."
          color="white"
          webkitdirectory
          directory
          :error="errors.file"
          :error-message="errorsMsg.file"
          :loaders="loaders.file"
          :disable="loaders.file"
          @input="checkFolder"
        >
          <template v-slot:append>
            <q-icon name="attach_file" />
          </template>
        </q-file>
        <q-banner inline-actions rounded class="bg-amber-10  text-white" dense>
          <small><strong>HINT:</strong> The backup folder must contain <code>Workouts</code> and <code>resources</code> folders</small>
        </q-banner>
      </q-step>

      <q-step
        :name="2"
        title="Configure"
        icon="eva-settings-outline"
        class="q-pa-none"
        :done="step > 2"
      >
        <q-table
          class="q-mb-none q-pb-none sticky-header-table-alt"
          flat
          dark
          dense
          selection="multiple"
          :rows-per-page-options="[0]"
          :selected.sync="selectedWorkouts"
          :pagination="{
            rowsPerPage: 100
          }"
          :data="edata"
          row-key="file"
          :columns="[
            {
              name: 'idx',
              required: true,
              label: '#',
              align: 'right',
              field: 'idx',
              format: val => `${val}`,
              sortable: true
            }, {
              name: 'created_date',
              required: true,
              label: 'Date',
              align: 'left',
              field: 'created_date',
              format: val => `${val}`,
              sortable: true
            },
            {
              name: 'sport',
              required: true,
              label: 'Endomondo sport type',
              align: 'center',
              field: 'sport',
              format: val => `${val}`,
              sortable: true
            },
            {
              name: 'sporttracker',
              required: true,
              label: 'Assigned Sport-Tracker type',
              align: 'center',
              field: 'sporttracker',
              sortable: false
            },
            {
              name: 'distance_km',
              required: true,
              label: 'Distance',
              align: 'left',
              field: 'distance_km',
              format: val => `${val.toFixed(2)} km`,
              sortable: true
            },
            {
              name: 'calories_kcal',
              required: true,
              label: 'Calories',
              align: 'center',
              field: 'calories_kcal',
              format: val => `${val}`,
              sortable: true
            },
            {
              name: 'pictures',
              label: 'Photos',
              align: 'center',
              field: row => row.pictures ? row.pictures.length : 0,
              format: val => `${val}`,
              sortable: true
            },
          ]"
        >
          <template v-slot:body-cell-sporttracker="props">
            <q-td :props="props">
              <q-select
                :value="props.row.sporttracker"
                :options="typeMap"
                dense
                filled
                dark
                emit-value
                map-options
                @input="mapSportChange($event, props.row.file)"
              />
            </q-td>
          </template>
        </q-table>
        <q-separator dark></q-separator>
      </q-step>

      <q-step
        :name="3"
        title="Setup Sports-Tracker"
        icon="eva-link-outline"
        :done="step > 3"
      >
        Sports-tracker setup:
        <q-input filled v-model="login" label="Login" dark color="white" class="q-my-md" />
        <q-input filled v-model="passwd" label="Password" dark color="white" class="q-my-md" />
        <q-banner inline-actions rounded class="bg-orange text-white">
          Your credentials are not stored anywhere, they are only used to login to your sports-tracker account and import created GPX files, and assign photos to them.
        </q-banner>

      </q-step>

      <q-step
        :name="4"
        title="Import"
        icon="eva-cloud-upload-outline"
      >
        <q-input
          v-model="code"
          ref="codeForm"
          filled
          dark
          readonly
          type="textarea"
          class="full-width full-height"
        />
      </q-step>

      <template v-slot:navigation>
        <q-stepper-navigation>
          <q-btn size="lg" v-if="step > 1 && step < 4" flat color="deep-orange" @click="step--" label="Back" class="q-mr-md" />
          <q-btn size="lg" v-if="step === 4" flat color="deep-orange" @click="step = 1" :disabled="loaders.button" label="Start Over" class="q-mr-md" />
          <q-btn size="lg" :disabled="invalidStep || loaders.button" :loading="loaders.button" @click="nextStep" color="primary" :label="step === 4 ? 'Restart process' : 'Continue'" />
        </q-stepper-navigation>
      </template>
    </q-stepper>
  </q-page>
</template>

<script>
import 'dotenv/config'
import { mapMutations, mapGetters } from 'vuex'
import { typeMap } from '../assets/type-map'

export default {
  name: 'PageIndex',
  data () {
    return {
      edata: [],
      typeMap,
      selectedWorkouts: [],
      step: 1,
      endoFolder: null,
      login: process.env.VUE_DEFAULT_LOGIN || '',
      passwd: process.env.VUE_DEFAULT_PASSWD || '',
      code: 'Process started...\nThis might take a few minutes, the window may appear as frozen but unitl the loader is spinning the process is working.\nAs sports-tracker allows only 10 imports at once, this will import the workouts in batches of 10.\nAfter workout import, photo upload will begin.\n\n',
      errors: {
        file: false
      },
      errorsMsg: {
        file: 'this is not a valid Endomondo Backup folder'
      },
      valid: {
        file: false
      },
      loaders: {
        file: false,
        button: false
      },
      ipcRenderer: null,
      toProcess: [],
      currIndex: 0
    }
  },
  watch: {
    step(newVal, oldVal) {
      if (newVal === 2) {
        this.getEndoWorkouts()
      }
      if (newVal === 4) {
        this.loaders.button = true
        // this.generate()
        this.prepareList()
      }
    }
  },
  computed: {
    ...mapGetters('main', ['endoDir']),
    invalidStep() {
      let result = true
      if (this.step === 1 && this.errors.file) {
        result = true
      }
      if (this.step === 1 && this.valid.file) {
        result = false
      }
      if (this.step === 2 && this.selectedWorkouts.length === 0) {
        result = true
      }
      if (this.step === 2 && this.selectedWorkouts.length > 0) {
        result = false
      }
      if (this.step === 3 && this.login.trim() !== '' && this.passwd.trim() !== '') {
        result = false
      }
      if (this.step === 4) {
        result = false
      }
      return result
    },
  },
  methods: {
    ...mapMutations('main', ['setLoading', 'setEndoDir', 'setEndoData', 'setSport']),
    mapSportChange(value, file) {
      this.setSport({value, file})
    },
    getEndoWorkouts() {
      this.setLoading(true)
      this.ipcRenderer.send('read-all-workouts', this.endoDir)
    },
    prepareList() {
      this.toProcess = []
      let part = []
      this.selectedWorkouts?.forEach((el, idx) => {
        if (idx % 10 === 0 && idx !== 0) {
          this.toProcess.push(part)
          part = []
        }
        part.push(el)
      })
      this.toProcess.push(part)
      this.currIndex = 0
      this.generate()
    },
    generate() {
      if (this.currIndex < this.toProcess.length) {
        this.setLoading(true)
        
        this.ipcRenderer.send('convert-all-workouts', JSON.stringify({
          dir: this.endoDir,
          login: this.login,
          passwd: this.passwd,
          workoutList: this.toProcess[this.currIndex]
        }))
      } else {
        setTimeout(() => {
          this.currIndex = 0
          this.toProcess = this.selectedWorkouts.filter(w => w.pictures && w.key).map(el => {
            const pictures = el.pictures.flat()
            return {
              ...el,
              pictures: pictures.filter(p => p.picture).map(k => k.picture.flat()).flat().map(l => l.url)
            }
          })
          this.uploadPhotos()
        }, 2000)
      }
    },
    uploadPhotos() {
      if (this.currIndex < this.toProcess.length) {
        this.ipcRenderer.send('upload-photos', JSON.stringify({
          dir: this.endoDir,
          login: this.login,
          passwd: this.passwd,
          workout: this.toProcess[this.currIndex]
        }))
      } else {
        this.setLoading(false)
        this.code += `\nProcess finished. Check your sports-tracker profile.`
        this.loaders.button = false
      }
    },
    nextStep() {
      if (!this.invalidStep) {
        if (this.step < 4) {
          this.step++
        } else {
          this.loaders.button = true
          this.prepareList()
        }
      }
    },
    checkFolder(e) {
      this.loaders.file = true
      this.ipcRenderer.send('validate-endo-dir', JSON.stringify(e.path))
    },
    handleIpc(event, arg) {
      if (arg.action && arg.action === 'read-all-workouts') {
        if (arg.success) {
          this.setLoading(false)
          this.edata = arg.payload.map((el, idx) => {
            return {
              ...el,
              idx: idx + 1,
              sporttracker: typeMap.find(t => t.label.toLowerCase() === el.sport.replace('_', ' ').toLowerCase()) ? typeMap.find(t => t.label.toLowerCase() === el.sport.replace('_', ' ').toLowerCase()).value : 'Running'
            }
          })
          this.setEndoData(this.edata)
        }
      }
      if (arg.action && arg.action === 'validate-endo-dir') {
        this.loaders.file = false
        if (arg.error) {
          this.errors.file = true
          this.errorsMsg.file = arg.errorMessage
        } else if (arg.success) {
          this.errors.file = false
          this.errorsMsg.file = ''
          this.valid.file = true
          this.setEndoDir(arg.dir)
          this.nextStep()
        }
      }
      if (arg.action && arg.action === 'convert-all-workouts') {
        if (arg.update) {
          this.setLoading(false)
          this.code += `\n${arg.update} - ${JSON.stringify(arg.payload)}`
        }
        if (arg.part) {
          this.code += `\nPart: ${this.currIndex + 1} finished importing`
          this.currIndex++
          console.log('arg.payload: ', arg.payload);
          arg.payload.forEach(el => {
            if (this.edata.find(d => d.timestamp == el.timestamp)) {
              this.edata.find(d => d.timestamp == el.timestamp).key = el.key
            }
            if (this.selectedWorkouts.find(d => d.timestamp == el.timestamp)) {
              this.selectedWorkouts.find(d => d.timestamp == el.timestamp).key = el.key
            }
          })
          this.setEndoData(this.edata)
          this.generate()
        }
      }
      if (arg.action && arg.action === 'upload-photos') {
        if (arg.update) {
          this.code += `\n${arg.update} - ${JSON.stringify(arg.payload)}`
        }
        if (arg.part) {
          this.code += `\nPart: ${this.currIndex + 1} uploaded`
          this.currIndex++
          this.uploadPhotos()
        }
        if (arg.success) {
          this.setLoading(false)
          this.loaders.button = false
        }
      }
      setTimeout(() => {
        document.querySelector('textarea')?.scrollTo(0, 99999999)
      }, 200)
    }
  },
  mounted() {
    this.ipcRenderer = require('electron').ipcRenderer
    this.ipcRenderer.on('asynchronous-reply', (event, arg) => { this.handleIpc(event, arg) })
  }
}
</script>

<style lang="scss">
.borderless {
  border: none !important;
}
.q-stepper__content {
  min-height: 200px;
}
.q-stepper__nav {
  position: fixed;
  bottom: 0px;
  right: 15px;
}
textarea {
  height: calc(100vh - 250px);
  line-height: 1 !important;
  font-family: 'Consolas', 'Courier New', Courier, monospace;
}
.sticky-header-table-alt {
  height: calc(100vh - 200px);
  overflow-y: auto;
    thead tr th {
      position: sticky;
      background: #151516;
      z-index: 1;
    }
    thead tr:first-child th {
      top: 0;
    }

    &.q-table--loading thead tr:last-child th {
      top: 48px;
    }
  }

  .q-pa-none {
    .q-stepper__step-inner {
      padding: 0 !important;
    }
  }
</style>
