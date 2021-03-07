const log = () => {
  user.logging = true
  saveUser()
}

const nolog = () => {
  user.logging = false
  saveUser()
}

const flash = benchmarkRenderAll

const reset = () => {
  localStorage.removeItem("user")
  const r = indexedDB.deleteDatabase("microroam")
  window.location.href = window.location.href
}

const blank = (name = "default") => {
  store = blankStore()
  store.graphName = name
  user = { settings: { graphName: "default",theme: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "light",topBar: "visible",logging: false,spellcheck: false } }
  user.graphName = name
  saveUser()
  debouncedSaveStore()
  goto("dailyNotes")
}

const pr = () => {
  console.log(JSON.stringify(store))
}

const downloadBinary = () => {
  const buffer = storeToBinary()
  const data = new Blob([buffer],{ type: 'application/x-micro-roam' })
  const url = URL.createObjectURL(data)
  const button = document.createElement("a")
  button.setAttribute('href',url)
  button.setAttribute('download',`${store.graphName}.mrm`)
  button.click()
}

const loadGraphminerNotes = () => {
  fetch("./graphminer-store.json").then(text => text.json().then(json => {
    store = json
    user.graphName = store.graphName
    saveUser()
    start()
    debouncedSaveStore()
  }))
}

const taonotes = loadGraphminerNotes

const terminalCommands = {
  blank,reset,flash,log,page,nolog,pr,taonotes,downloadBinary
}