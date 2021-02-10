let idb = null
let store = null

const dbReq = indexedDB.open("microroam",1)
dbReq.onsuccess = (event) => {
  idb = event.target.result
}

onmessage = (event) => {
  const operation = event.data[0]
  const data = event.data[1]
  if (operation === "save") {
    store = data
    saveStore()
  } else if (operation === "change") {
    console.log("change")
    for (let i = 0; i < data.length - 1; i++) {
      databaseChange(data[i],false)
    }
    databaseChange(data[data.length - 1],false,true)
    saveDatabase()
  } else if (operation === "undo") {
    databaseUndo(database)
    saveDatabase()
  }
}

const saveStore = () => {
  const transaction = idb.transaction(["stores"],"readwrite")
  const storeStore = transaction.objectStore("stores")
  const str = JSON.stringify(store)
  const req = storeStore.put({ graphName: store.graphName,store: str })
  req.onsuccess = () => console.log("save success")
  req.onerror = (event) => {
    console.log("save error")
    console.log(event)
  }
}