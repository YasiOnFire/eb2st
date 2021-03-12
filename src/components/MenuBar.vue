<template>
  <q-bar
      class="bg-secondary text-white q-electron-drag full-width"
    >
    <q-icon name="eva-flash-outline" class="q-mr-sm" />
    <small>
      EndomondoBackup2SportsTracker Importer
    </small>

    <q-space />

    <q-separator vertical />
    <q-btn
      class="q-electron-drag--exception q-pr-sm"
      href="https://github.com/YasiOnFire/eb2st"
      type="a"
      target="_blank"
      dense
      flat
      stretch
      label="GitHub"
      icon="eva-github-outline"
    >
      <q-tooltip>
        Open app source code
      </q-tooltip>
    </q-btn>
    <q-separator vertical />
    <q-btn
      class="q-electron-drag--exception q-pr-sm"
      href="https://yasio.pl"
      type="a"
      target="_blank"
      dense
      flat
      stretch
      label="yasio.pl"
      icon="eva-person-outline"
    >
      <q-tooltip>
        Visit https://yasio.pl
      </q-tooltip>
    </q-btn>
    <q-separator vertical />
    <q-btn
      class="q-electron-drag--exception"
      @click="minimize()"
      dense
      stretch
      flat
      icon="minimize"
    />
    <q-separator vertical />
    <q-btn
      @click="toggleSize()"
      dense
      flat
      stretch
      class="q-electron-drag--exception"
      :icon="isMaximized ? 'filter_none' : 'crop_square'"
    />
      <q-separator vertical />

    <q-btn
      @click="closeWindow"
      class="q-electron-drag--exception"
      dense
      flat
      stretch
      icon="close"
    />
  </q-bar>
</template>

<script>
export default {
  data () {
    return {
      isMaximized: false,
      remote: null
    }
  },
  methods: {
    closeWindow () {
      const window = this.remote.BrowserWindow.getFocusedWindow()
      window.close()
    },
    minimize () {
      this.remote.BrowserWindow.getFocusedWindow().minimize()
    },
    toggleSize () {
      const window = this.remote.BrowserWindow.getFocusedWindow()
      if (window.isMaximized()) {
        this.isMaximized = false
        window.unmaximize()
      } else {
        this.isMaximized = true
        window.maximize()
      }
    }
  },
  mounted () {
    if (this.$q.platform.is.electron) {
      // eslint-disable-next-line no-undef
      const { remote } = require('electron')
      this.remote = remote
    }
  }
}
</script>
<style lang="scss">
.q-electron-drag {
  position: fixed;
  z-index: 9999;
  small {
    font-size: 50%;
  }
}
</style>
