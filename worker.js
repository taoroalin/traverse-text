const saveDatabase = (database) => {
  let idb = null
  const IdbRequest = indexedDB.open("microroam",1)
  IdbRequest.onerror = (event) => {
    console.log(event.target.errorCode)
    alert(`In order to save your notes between sessions, Micro Roam needs access to IndexedDB`)
  }
  IdbRequest.onsuccess = (event) => {
    idb = event.target.result
    console.log(event.target.result)
    loadDatabase(graphName)
  }
  IdbRequest.onupgradeneeded = (event) => {
    const db = event.target.result
    db.createObjectStore("graphs",{ keyPath: "graphName" })
  }

  const transaction = idb.transaction(["graphs"],"readwrite")
  const store = transaction.objectStore("graphs")
  const req = store.put(database)
  req.onsuccess = (event) => {
    console.log("stored database")
  }
  req.onerror = (event) => {
    console.log(event)
  }
}