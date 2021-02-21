const page = (string) => {
  console.log(store.pages[store.pagesByTitle[string]])
}

const log = () => {
  user.logging = true
  saveUser()
  saveWorker.postMessage(["user",user])
}

const nolog = () => {
  user.logging = false
  saveUser()
  saveWorker.postMessage(["user",user])
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

let pingstime
const ping = () => {
  pingstime = performance.now()
  saveWorker.postMessage(["ping",{ hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: { hello: "hello" } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } }])
}

const terminalCommands = {
  blank,reset,test,log,page,nolog,ping,pr
}