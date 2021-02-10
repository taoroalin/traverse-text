// Commands -------------------------------------------------------------------------

const blockOrPageFromId = (id) => {
  return store.blocks[id] || store.pages[id]
}

const insertBlock = (blockId,newParentId,idx) => {
  const block = store.blocks[blockId]
  block.parent = newParentId
  const newParent = blockOrPageFromId(newParentId)
  console.log(newParent)
  newParent.children = newParent.children || []
  const newParentOldChildren = newParent.children
  if (idx !== undefined) {
    newParent.children = newParentOldChildren.slice(0,idx)
    newParent.children.push(blockId)
    newParent.children.push(...newParentOldChildren.slice(idx))
  } else {
    newParent.children.push(blockId)
  }
  // todo make this not duplicate refs
  const curRefs = store.blocks[blockId].refs
  if (curRefs) store.blocks[blockId].refs = curRefs.map(x => x) // make sure to copy because these are mutable!!!!
}

// Commands
const commands = {
  deleteBlock: (blockId) => {
    const backRefs = store.blocks[blockId].backRefs
    for (let ref in backRefs) {
      if (store.blocks[ref].refs)
        store.blocks[ref].refs = store.blocks[ref].refs.filter(x => x !== blockId)
      if (store.blocks[ref][":block/refs"])
        store.blocks[ref][":block/refs"] = store.blocks[ref][":block/refs"].filter(x => x !== blockId)
    }
    if (store.blocks[blockId].parent.children) {
      store.blocks[blockId].parent.children = store.blocks[blockId].parent.children.filter(x => x !== blockId)
    }
    delete store.blocks[blockId]
  },

  moveBlock: (blockId,newParentId,idx) => {
    const block = store.blocks[blockId]
    const parent = blockOrPageFromId(block.parent)
    parent.children = parent.children.filter(x => x != blockId)
    insertBlock(blockId,newParentId,idx)
  },

  writeBlock: (blockId,string) => {
    store.blocks[blockId].string = string
  },

  // gonna add more fields later
  // the new id is in the change so it can be serialized deterministically
  createBlock: (blockId,parentId,idx) => {
    store.blocks[blockId] = { string: "",parent: parentId,":create/time": Date.now(),children: [],backRefs: [] }
    insertBlock(blockId,parentId,idx)
  },

  createPage: (pageId,pageTitle) => {
    store.pages[pageId] = { title: pageTitle,children: [],":create/time": Date.now(),backRefs: [] }
    store.pagesByTitle[pageTitle] = pageId
  }
}

const runCommand = (...command) => {
  saveWorker.postMessage(["command",command])
  commands[command[0]](...command.slice(1))
}
// Worker -------------------------------------------------------------------------

let idb = null
let store = null
let saveTimeout = null

const dbReq = indexedDB.open("microroam",1)
dbReq.onsuccess = (event) => {
  idb = event.target.result
}

onmessage = (event) => {
  const operation = event.data[0]
  const data = event.data[1]
  if (operation === "save") {
    store = data
    debouncedSaveStore()
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
  } else if (operation === "command") {
    commands[data[0]](...data.slice(1))
    debouncedSaveStore()
    console.log(`ran command ${JSON.stringify(data)}`)
  } else {
    console.log(`saveWorker got weird operation: ${operation}`)
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
  req.onsuccess = () => console.log("save success")
  req.onerror = (event) => {
    console.log("save error")
    console.log(event)
  }
}
