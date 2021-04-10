
let idb = null
{
  let idbOpenRequest = indexedDB.open('microroam', 5)
  idbOpenRequest.onsuccess = (openEvent) => {
    idb = openEvent.target.result
  }

  idbOpenRequest.onupgradeneeded = (event) => {
    /*
    todo handle this, including the case where there are 10+ graphs, in a reliable way. Not worth it to make this performant, best option I think is to transform all these then reload the page. In the future it could convert them lazily, but not for now
    */
    const db = idbOpenRequest.result
    const stores = Array.from(db.objectStoreNames)
    if (!stores.includes("stores")) {
      db.createObjectStore("stores", { keyPath: "graphName" })
    } else {
      idbOpenRequest.onsuccess = () => {
        console.log("new success")
        idb = event.target.result
        const storeStore = db.transaction(["stores"], "readonly").objectStore("stores")
        storeStore.getAll().onsuccess = (allGraphsResult) => {
          const allStores = allGraphsResult.target.result
          console.log(allStores)
          for (let oldStoreContainer of allStores) {
            let graphName = oldStoreContainer.graphName
            let oldStore = JSON.parse(oldStoreContainer.store)
            const roamJSON = oldStoreToRoamJSON[db.version](oldStore)
            const newStore = roamJsonToStore(graphName, roamJSON)
            storeStore.put({ graphName, store: JSON.stringify(newStore) })
          }
          idb.close()
          location.href = location.href
        }
      }
    }
  }
  idbOpenRequest.onerror = (e) => {
    console.log("error")
    console.log(e)
  }
}