const page = (string) => {
  console.log(store.pages[store.pagesByTitle[string]])
}

const log = () => {
  user.logging = true
  saveUser()
}

const nolog = () => {
  user.logging = false
  saveUser()
}

const test = () => {
  const testScriptNode = document.createElement("script")
  testScriptNode.src = "test.js"
  document.body.appendChild(testScriptNode)
}

const reset = () => {
  const r = indexedDB.deleteDatabase("microroam")
  localStorage.removeItem("user")
  window.location.href = window.location.href
}

const blank = () => {
  store = blankStore()
  user = blankUser
  saveUser()
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

const terminalCommands = {
  blank,reset,test,log,page,nolog,pr,downloadBinary
}

const loadGraphminerNotes = () => {
  fetch("./graphminer-store.json").then(text => text.json().then(json => {
    store = json
    user.graphName = store.graphName
    saveUser()
    theresANewStore()
    debouncedSaveStore()
  }))
}