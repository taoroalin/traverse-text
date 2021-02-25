const r = indexedDB.open("microroam",4)// I had this as line 1, saves ~5ms start time, don't now cause I'm lazy
// This needs to be the exact same db version as in worker.js
const blankUser = { graphName: "default",theme: "light",topBar: "visible",logging: false,spellcheck: false }
let user = blankUser
const storedUser = localStorage.getItem("user")
if (storedUser) user = JSON.parse(storedUser)
let w = false // flag for whether either code or data loaded
let store = null
let idb = null
let startCommand = ["dailyNotes"]

const theresANewStore = () => {
  user.graphName = store.graphName
  saveUser()
  gotoNoHistory(...startCommand)
  setTimeout(() => saveWorker.postMessage(["save",store]),0)
}

r.onsuccess = (e1) => {
  idb = e1.target.result
  idb.transaction(["stores"],"readonly").objectStore("stores").get(user.graphName).onsuccess = (e) => {
    if (e.target.result) {
      store = JSON.parse(e.target.result.store)
      if (w) {
        theresANewStore()
      } else
        w = true
    } else {
      console.log("adding default graph")
      fetch("./default-store.json").then(text => text.json().then(json => {
        store = json
        user.graphName = json.graphName
        startCommand = ["pageTitle","Welcome to Micro Roam"]
        if (w) {
          theresANewStore()
        } else
          w = true
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
r.onerror = (event) => {
  alert(`In order to save your notes between sessions, Micro Roam needs access to IndexedDB. 
      You can allow access by exiting "private browsing" mode, or by using a newer browser, or by changing browser settings`)
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

let saveWorker = null

let lastEventTime = Date.now()

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
  if (saveWorker) saveWorker.postMessage(["user",user])
}
saveUser()


/* This inline script is all about opening a connection to IndexedDB and setting the user's theme ASAP. This allows IndexedDB to run in parallel with main script compilation, and avoids layout thrashing
What happens is:
1: IndexedDB Open request sent.
2: Add onsuccess listener to request (if the request somehow succeeds before then, it fails). Then get user settings from localstorage, which tells you which graph to get out of indexeddb once the idb request succeeds (if request succeeds first, it loads default graph). Then set body class to user's color theme (which is why this script is in the html body) quickly so they don't see the screen flash the wrong color. Then add upgradeneeded, onerror listeners, then initialize global variables
Onsuccess handler: sets store, then checks whether last script has finished loading, if it has, start rendering. That script also checks whether data loded, and triggers render if data is loaded
*/