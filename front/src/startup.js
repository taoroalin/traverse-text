let usingLocalStore = true

let print
{
  let serverLogInProgress = ""
  let debouncedSendServerLog = intervalize(() => {
    fetch(`${apiUrl}/log`, { method: 'POST', body: serverLogInProgress })
    serverLogInProgress = ""
  },
    10000)
  print = (string) => {
    serverLogInProgress += string
    debouncedSendServerLog()
  }
}


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
  if (user.h && user.s.commitId !== graphMetadata[user.s.graphName].syncCommitId)
    debouncedSaveStore()
}

const invalidateStores = () => {
  const r = indexedDB.deleteDatabase("microroam")
  console.error(`Local replica invalid. Resetting from server`)
  user.s.commitId = undefined
  graphMetadata[user.s.graphName].syncCommitId = undefined
  localStorage.setItem("user", JSON.stringify(user))
  localStorage.removeItem('store')
  window.location.href = window.location.href
}

const invalidateUser = () => {
  localStorage.clear()
  const r = indexedDB.deleteDatabase("microroam")
  window.location.href = window.location.href
}

if (userText) {
  user = JSON.parse(userText)
  if (user.h) {
    const headers = { h: user.h }
    if (graphMetadata[user.s.graphName].syncCommitId) headers.commitid = graphMetadata[user.s.graphName].syncCommitId
    let reqUrl = `${apiUrl}/get/${user.s.graphName}`
    fetch(reqUrl, { method: 'POST', headers }).then(async (res) => {
      if (res.status === 304) {
        console.log(`already up to date`)
        return
      }
      if (res.status !== 200) {
        console.log(`STORE NOT ON SERVER`)
        return
      }
      console.log(`server on commit ${res.headers.get('commitid')} local on commit ${graphMetadata[user.s.graphName].syncCommitId}`)
      usingLocalStore = false
      res.json().then(blox => {
        console.log('got blox')
        const oldStartFn = startFn
        startFn = () => {
          store = hydrateFromBlox(user.s.graphName, blox)
          graphMetadata[user.s.graphName].syncCommitId = res.headers.get('commitid')
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
      invalidateStores()
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
                  invalidateStores()
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
  user = { s: { graphName: "default", theme: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "light", topBar: "visible", logging: false, spellcheck: false, editingSpotlight: true } }
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

