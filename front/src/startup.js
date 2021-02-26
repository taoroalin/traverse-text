const r = indexedDB.open("microroam",4)// I had this as line 1, saves ~5ms start time, don't now cause I'm lazy
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
        startCommand = ["pageTitle","Welcome to Micro Roam"]
        finishStartupThread()
      }))
    }
  }
}
r.onupgradeneeded = (event) => {
  const db = r.result
  const stores = Array.from(db.objectStoreNames)
  if (!stores.includes("stores"))
    db.createObjectStore("stores",{ keyPath: "graphName" })
}
r.onerror = () => {
  alert(`In order to save your notes between sessions, Micro Roam needs access to IndexedDB. 
      You can allow access by exiting "private browsing" mode, or by using a newer browser, or by changing browser settings`)
}

let store = null
let refs = null
let titles = null
let idb = null

let startCommand = ["dailyNotes"]

let startupThreads = 2
const finishStartupThread = () => {
  if (startupThreads <= 1)
    theresANewStore()
  else
    startupThreads--
}
const theresANewStore = () => {
  user.graphName = store.graphName
  saveUser()
  gotoNoHistory(...startCommand)
  debouncedSaveStore()
}


let commitDebounce = null

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


/* starts all the threads needed to start up immediately on page load while setting user theme quick enough to avoid flashing. Right now those threads are 1:loading data from indexedDB and 2: loading html/css/js.
*/