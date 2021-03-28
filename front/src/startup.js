let idb = null
let store = null
let r

const basicBitchServerUrl = "http://localhost:3000"

let user
let userText = localStorage.getItem("user")
let usingLocalStore = true

let startFn = () => gotoNoHistory("dailyNotes")

let dataLoaded = false
let scriptsLoaded = false
const setDataLoaded = () => {
  if (scriptsLoaded)
    start()
  dataLoaded = true
}

const start = () => {
  saveUser()
  startFn()
  if (user.h && user.s.commitId !== user.s.syncCommitId)
    debouncedSaveStore()
}

const invalidateLocal = () => {
  const r = indexedDB.deleteDatabase("microroam")
  console.error(`Local replica invalid. Resetting from server`)
  user.s.commitId = undefined
  user.s.syncCommitId = undefined
  localStorage.setItem("user", JSON.stringify(user))
  localStorage.removeItem('store')
  window.location.href = window.location.href
}

if (userText) {
  user = JSON.parse(userText)
  if (user.h) {
    const headers = new Headers()
    headers.set('h', user.h)
    if (user.s.syncCommitId) headers.set('commitid', user.s.syncCommitId)
    let reqUrl = `${basicBitchServerUrl}/get/${user.s.graphName}`
    fetch(reqUrl, { method: 'POST', headers: headers }).then(async (res) => {
      if (res.status === 304) {
        console.log(`already up to date`)
        return
      }
      if (res.status !== 200) {
        console.log(`STORE NOT ON SERVER`)
        return
      }
      console.lot(`server on commit ${res.getHeader('commitid')} local on commit ${user.s.syncCommitId}`)
      usingLocalStore = false
      user.s.syncCommitId = res.headers.get('commitid')
      res.json().then(blox => {
        console.log('got blox')
        const oldStartFn = startFn
        startFn = () => {
          hydrateFromBlox(user.s.graphName, blox)
          oldStartFn()
        }
        setDataLoaded()
      })
    })
  }

  const lsStore = localStorage.getItem('store')
  if (lsStore) {
    try {
      store = JSON.parse(lsStore)
      setDataLoaded()
    } catch (e) {
      invalidateLocal()
    }
    r = indexedDB.open("microroam", 5)
    r.onsuccess = (e1) => idb = e1.target.result
  } else {
    r = indexedDB.open("microroam", 5)
    r.onsuccess = (e1) => {
      console.log("normal success")
      idb = e1.target.result
      if (usingLocalStore === true) {
        try {
          idb.transaction(["stores"], "readonly").objectStore("stores").get(user.graphName).onsuccess = (e) => {
            if (usingLocalStore === true) {
              if (e.target.result) {
                try {
                  store = JSON.parse(e.target.result.store)
                  setDataLoaded()
                } catch (e) {
                  invalidateLocal()
                }
              } else {
                console.log("adding default graph")

              }
            }
          }
        } catch (e) {

        }
      }
    }
  }
} else {
  user = { s: { graphName: "default", theme: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "light", topBar: "visible", logging: false, spellcheck: false } }
  fetch("./default-store.json").then(text => {
    text.json().then(json => {
      store = json
      startFn = () => gotoNoHistory("pageTitle", "Welcome to Micro Roam")
      setDataLoaded()
    })
  })
  r = indexedDB.open("microroam", 5)
  r.onsuccess = (e1) => idb = e1.target.result
}

r.onupgradeneeded = (event) => {
  console.log("upgradeneeded")
  const db = r.result
  const stores = Array.from(db.objectStoreNames)
  if (!stores.includes("stores")) {
    db.createObjectStore("stores", { keyPath: "graphName" })
  } else {
    console.log(event)
    console.log(db)

    r.onsuccess = () => {
      console.log("new success")
      idb = event.target.result
      const storeStore = db.transaction(["stores"], "readonly").objectStore("stores")
      storeStore.get(user.s.graphName).onsuccess = (e) => {
        store = e.target.result.store
        const roamJSON = oldStoreToRoamJSON[db.version](store)
        roamJsonToStore(user.s.graphName, roamJSON)
        saveStore()
        setDataLoaded()
      }
    }
  }
}
r.onerror = (e) => {
  console.log("error")
  console.log(e)
  alert(`In order to save your notes between sessions, Micro Roam needs access to IndexedDB. \nYou can allow access by exiting "private browsing" mode, or by using a newer browser, or by changing browser settings`)
}