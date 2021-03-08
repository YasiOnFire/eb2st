<template>
  <q-layout view="hHh lpr fFf">
    <menu-bar />
    <q-page-container>
      <router-view />
    </q-page-container>

    <q-inner-loading :showing="loading" dark>
      <q-spinner-gears size="50px" color="primary" />
    </q-inner-loading>
  </q-layout>
</template>

<script>
import MenuBar from '../components/MenuBar'
import { mapGetters, mapMutations } from 'vuex'

export default {
  name: 'MainLayout',
  components: { MenuBar },
  computed: {
    ...mapGetters('main', ['loading'])
  },
  methods: {
    ...mapMutations('main', ['setLoading'])
  },
  mounted() {
    this.setLoading(false)
  }
}
</script>

<style lang="scss">
.q-page-container {
  min-height: calc(100vh - 32px) !important;
  padding-top: 32px;
}
.q-inner-loading--dark {
  z-index: 9999;
  position: fixed;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, .9) !important;
}
.q-page {
  min-height: calc(100vh - 32px) !important;
}
</style>
