let idb = null
const dbReq = indexedDB.open("microroam",1)
dbReq.onsuccess = (event) => {
  idb = event.target.result
}
onmessage = (event) => {
  const operation = event.data[0]
  const data = event.data[1]
  if (operation === "save") {
    const transaction = idb.transaction(["graphs"],"readwrite")
    const store = transaction.objectStore("graphs")
    const req = store.put({ graphName: data.graphName,graph: JSON.stringify(data) })
    req.onsuccess = (event) => {
      console.log("success")
    }
    req.onerror = (event) => {
      console.log("save error")
      console.log(event)
    }
  }
}