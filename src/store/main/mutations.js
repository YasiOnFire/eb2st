export const setLoading = (state, payload) => (state.loading = payload)
export const setEndoDir = (state, payload) => (state.endoDir = payload)
export const setEndoData = (state, payload) => (state.endoData = payload)
export const setSport = (state, payload) => {
  const { value, file } = payload
  state.endoData.find(e => e.file === file).sporttracker = value
}
