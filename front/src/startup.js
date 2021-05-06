let idb = null
let store = null
let otherStores = {}
let r

const setActiveStore = (inputStore) => {
  store = inputStore
  otherStores[inputStore.graphName] = store
}

let meta = {}
{
  let metaText = localStorage.getItem('meta')
  if (metaText) meta = JSON.parse(metaText)
}

const nodeJsServerUrl = location.protocol + "//" + location.hostname + ":8756"

//~frontskip
document.title = "Local Traverse Text"
//~

let user
let userText = localStorage.getItem("user")
let usingLocalStore = true

let dataLoaded = false
let scriptsLoaded = false
const setDataLoaded = () => {
  if (scriptsLoaded)
    start()
  dataLoaded = true
}

const start = () => {
  saveUser()
  renderSessionState()
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
    let reqUrl = `${nodeJsServerUrl}/get/${user.s.graphName}`
    fetch(reqUrl, { method: 'POST', headers: headers }).then(async (res) => {
      if (res.status === 304) {
        console.log(`already up to date`)
        return
      }
      if (res.status !== 200) {
        console.log(`STORE NOT ON SERVER`)
        return
      }
      console.log(`server on commit ${res.headers.get('commitid')} local on commit ${user.s.syncCommitId}`)
      usingLocalStore = false
      res.json().then(blox => {
        console.log('got blox')
        setActiveStore(hydrateFromBlox(user.s.graphName, blox))
        user.s.syncCommitId = res.headers.get('commitid')
        setDataLoaded()
      })
    })
  }

  const lsStore = localStorage.getItem('store')
  if (lsStore) {
    try {
      setActiveStore(JSON.parse(lsStore))
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
                  setActiveStore(JSON.parse(e.target.result.store))
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
  user = { s: { graphName: "default", theme: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? "purple" : "light", topBar: "visible", logging: false, spellcheck: false, editingSpotlight: true } }
  fetch("./default-store.json").then(text => {
    text.json().then(json => {
      setActiveStore(json)
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
        setActiveStore(e.target.result.store)
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
}

const urlToSessionState = (url) => {
  url = decodeURI(url)
  const theSessionState = { scroll: 0, isFocused: false, position: 0, block: undefined, page: undefined }
  theSessionState.pageFrame = "dailyNotes"
  theSessionState.graphName = user.s.graphName

  const queries = url.matchAll(/([a-zA-Z0-9\-_]+)=([a-zA-Z0-9\-_]+)/g)
  for (let query of queries) {
    theSessionState[query[1]] = query[2]
    if (query[1] === 'focusId') theSessionState.isFocused = true
  }

  const paths = Array.from(url.matchAll(/(?:\/([a-zA-Z0-9_ \-]+))/g))
  if (paths.length <= 2) {
    return theSessionState
  }
  theSessionState.graphName = paths[0][1]
  theSessionState.pageFrame = paths[1][1]
  if (theSessionState.pageFrame === 'pageTitle') {
    theSessionState.page = paths[2][1]
  }
  if (theSessionState.pageFrame === 'block') {
    theSessionState.block = paths[2][1]
  }

  return theSessionState
}

// Cursor info. Raw info stored in JSON, DOM elements cached in lots of random vars
console.log(location.pathname)
let sessionState = urlToSessionState(location.hash)
console.log(sessionState)