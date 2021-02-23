// dumb special API for importing scripts from web worker, but at least it works
importScripts("main-worker-shared.js")
let idb = null
let store = null

// async structure: onmessage, save unless save in progress, else set toSave=true, when save finishes checks toSave, possib saves again

let saving = false
let toSave = false
let user = null

// This needs to be the exact same db version as in index.html, I don't want to have to load another file before accessing indexeddb in index.html, so will have to remain a sync
const dbReq = indexedDB.open("microroam",4)
dbReq.onsuccess = (event) => idb = event.target.result


onmessage = (event) => {
  const operation = event.data[0]
  const data = event.data[1]
  if (operation === "user") { // getting user for logging settings
    user = data
  } else if (operation === "save") {
    store = data
    debouncedSaveStore()
  } else if (operation === "edits") {
    if (store) {

      print(data)
      doEdits(data)
      debouncedSaveStore()
    }
  } else if (operation === "ping") {
    postMessage(["ping",undefined])
  } else {
    print(`saveWorker got weird operation: ${operation}`)
  }
}

const debouncedSaveStore = () => {
  if (saving === false) {
    saveStore()
  } else {
    toSave = true
  }
}

const saveStore = () => {
  toSave = false
  saving = true
  const transaction = idb.transaction(["stores"],"readwrite")
  const storeStore = transaction.objectStore("stores")
  const str = JSON.stringify(store)
  const req = storeStore.put({ graphName: store.graphName,store: str })
  req.onsuccess = () => {
    print("saved")
    if (toSave) saveStore()
    else saving = false
  }
  req.onerror = (event) => {
    print("save error")
  }
}
