importScripts("main-worker-shared.js") // dumb special API for importing scripts from web worker, but at least it works

let idb = null
let store = null
let saveTimeout = null
let user = null

const dbReq = indexedDB.open("microroam",1)
dbReq.onsuccess = (event) => idb = event.target.result


onmessage = (event) => {
  const operation = event.data[0]
  const data = event.data[1]
  if (operation === "user") {
    user = data
  } else if (operation === "save") {
    store = data
    debouncedSaveStore()
  } else if (operation === "command") {
    commands[data[0]](...data.slice(1))
    debouncedSaveStore()
    print(`ran command ${JSON.stringify(data)}`)
  } else {
    print(`saveWorker got weird operation: ${operation}`)
  }
}

const debouncedSaveStore = () => {
  clearTimeout(saveTimeout)
  saveTimeout = setTimeout(saveStore,500)
}

const saveStore = () => {
  const transaction = idb.transaction(["stores"],"readwrite")
  const storeStore = transaction.objectStore("stores")
  const str = JSON.stringify(store)
  const req = storeStore.put({ graphName: store.graphName,store: str })
  req.onsuccess = () => {
    print("saved")
  }
  req.onerror = (event) => {
    print("save error")
  }
}
