let store = null
let idb = null
console.log("v5")
const r = indexedDB.open("microroam",5)// I had this as line 1, saves ~5ms start time, don't now cause I'm lazy
const blankUser = { graphName: "default",theme: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "light",topBar: "visible",logging: false,spellcheck: false }
let user = blankUser
const storedUser = localStorage.getItem("user")
if (storedUser) user = JSON.parse(storedUser)

const topBar = document.getElementById("top-bar")
const topBarHiddenHitbox = document.getElementById("top-bar-hidden-hitbox")

const showTopBar = () => {
  topBar.style.marginTop = "0px"
  topBarHiddenHitbox.style.display = "none"
}
const hideTopBar = () => {
  topBar.style.marginTop = "-46px"
  topBarHiddenHitbox.style.display = "block"
}
const saveUser = () => {
  document.body.className = user.theme
  if (user.topBar === "visible") showTopBar()
  else hideTopBar()
  localStorage.setItem("user",JSON.stringify(user))
}
saveUser()

r.onsuccess = (e1) => {
  console.log("normal success")
  idb = e1.target.result
  idb.transaction(["stores"],"readonly").objectStore("stores").get(user.graphName).onsuccess = (e) => {
    if (e.target.result) {
      store = JSON.parse(e.target.result.store)
      finishStartupThread()
    } else {
      console.log("adding default graph")
      fetch("./default-store.json").then(text => text.json().then(json => {
        store = json
        user.graphName = json.graphName
        startFn = () => gotoNoHistory("pageTitle","Welcome to Micro Roam")
        finishStartupThread()
      }))
    }
  }
}
r.onupgradeneeded = (event) => {
  console.log(
    "upgradeneeded`"
  )
  const db = r.result
  const stores = Array.from(db.objectStoreNames)
  if (!stores.includes("stores")) {
    db.createObjectStore("stores",{ keyPath: "graphName" })
  } else {
    console.log(event)
    console.log(db)

    r.onsuccess = () => {
      console.log("new success")
      idb = event.target.result
      const storeStore = db.transaction(["stores"],"readonly").objectStore("stores")
      storeStore.get(user.graphName).onsuccess = (e) => {
        store = e.target.result.store
        const roamJSON = oldStoreToRoamJSON[db.version](store)
        roamJsonToStore(user.graphName,roamJSON)
        saveStore()
        finishStartupThread()
      }
    }
  }
}
r.onerror = (e) => {
  console.log("error")
  console.log(e)
  alert(`In order to save your notes between sessions, Micro Roam needs access to IndexedDB. 
      You can allow access by exiting "private browsing" mode, or by using a newer browser, or by changing browser settings`)
}


let startFn = () => gotoNoHistory("dailyNotes")

let startupThreads = 2
const finishStartupThread = () => {
  if (startupThreads <= 1)
    start()
  else
    startupThreads--
}
const start = () => {
  user.graphName = store.graphName
  saveUser()
  startFn()
  debouncedSaveStore()
}


let editingTemplateExpander = null

let editingLink = null
let editingTitle = null
let focusNode = null
let focusOffset = null

let focusBlock = null

let focusSuggestion = null

let sessionState = { pageFrame: "dailyNotes",focusId: null,scroll: 0,position: null }

let dragSelectStartBlock = null
let dragSelect = null

let clipboardData = null