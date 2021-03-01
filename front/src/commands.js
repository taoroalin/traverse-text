const cpy = x => JSON.parse(JSON.stringify(x))

/*

OLD Edit format: {delete:[[...keys]],write:[[...keys,value]], add:[[...keys, value]], subtract:[[...keys, value]], insert: [[...keys, value, idx]]}

edit:{s:start,d:delete,i:insert,a:append}

The fox jumped over the lazy dog
The fox didn't jump over the lazy dogs
{"s":8,"i":"didn't "},{"s":20,"d":"ed"},{"i":"s"}

diff:[edit]
Diff format: s:start, d:delete text, i:insert text
Start defaults to 0

// this dif format is meant to be compressible. Every change is its own diff, but the difs can be merged into the same format

{id, t, df:{blocId:diff},mv:{blocId:[np, nidx,op, oidx]},cr:{blocId:[pid,idx]},dl:{blocId:bloc}}

okay, this shows that it can be practical to store diffs as json

difs are serial, not paralel
*/

const applyDif = (string,difs) => {
  let result = string
  for (let dif in difs) {
    const start = dif.s || result.length
    const end = start + ((dif.d && dif.d.length) || 0)
    result = result.substring(0,start) + (dif.i || "") + result.substring(end)
  }
  return result
}

const diff = (string,oldString) => { // todo real diff
  return { d: oldString,i: string }
}

const doEdit = (edit) => {
  print(edit)

  for (let id in edit.dl || []) {
    const parent = store.blox[id].p
    if (parent) {
      store.blox[parent].k = store.box[parent].k.filter(x => x !== id)
    } else {
      delete store.titles[store.blox[id].s]
    }
    delete store.blox[id]
  }

  // make all blocks first before adding children so parents don't have to be declared before children
  for (let blocId in edit.cr || []) {
    store.blox[blocId] = {
      ct: edit.t,
      s: ""
    }
  }
  for (let blocId in edit.cr || []) {
    const [parentId,idx] = edit.cr[blocId]
    if (parentId) {
      store.blox[blocId].p = parentId
      if (!store.blox[parentId].k) store.blox[parentId].k = []
      if (idx) {
        store.blox[parentId].k.splice(idx,0,blocId)
      } else {
        store.blox[parentId].k.push(blocId)
      }
    }
  }

  for (let id in edit.mv || []) {
    const [np,nidx,op,oidx] = edit.mv[id]
    const block = store.blox[id]
    store.blox[op].k = store.blox[op].k.filter(x => x != id)
    block.p = np
    if (!store.blox[np].k) store.blox[np].k = []
    store.blox[np].k.splice(nidx,0,id)
  }

  for (let id in edit.df) {
    const df = edit.df[id]
    const bloc = store.blox[id]
    bloc.et = edit.t
    bloc.s = applyDif(bloc.s,df)
  }
}

const saveStore = () => {
  const transaction = idb.transaction(["stores"],"readwrite")
  const storeStore = transaction.objectStore("stores")
  const str = JSON.stringify(store)
  const req = storeStore.put({
    graphName: store.graphName,
    store: str
  })
  req.onsuccess = () => {
    console.log("saved")
  }
  req.onerror = (event) => {
    console.log("save error")
    console.log(error)
  }
}

let saveStoreTimeout = null

const debouncedSaveStore = () => {
  clearTimeout(saveStoreTimeout)
  saveStoreTimeout = setTimeout(saveStore,500)
}

const print = (text) => {
  if (user.logging) {
    console.log(text)
  }
}

// idk whether this is "random enough"
// it is highly performance inneficient but i don't need to call this many times
const CHARS_64 = "-_0123456789abcdefghijklmnopqrstuvwxyzABCDEFJHIJKLMNOPQRSTUVWXYZ"
const CHARS_16 = "0123456789ABCDEF"
const newUid = () => {
  let values = new Uint8Array(9)
  let result
  do {
    crypto.getRandomValues(values)
    result = ""
    for (let i = 0; i < 9; i++) {
      result += CHARS_64[values[i] % 64]
    }
  } while (store.blox[result] !== undefined)
  return result
}

// I'm using base64 126 bit UUIDs instead because they're less length in JSON and they are more ergonomic to write in ((uuid)) if I ever want to do that
const newUUID = () => { // this is 126 bits, 21xbase64
  let values = new Uint8Array(21)
  crypto.getRandomValues(values)
  let result = ""
  for (let i = 0; i < 21; i++) {
    result += CHARS_64[values[i] % 64]
  }
  return result
}


let edits = []
let activeEdits = []

const commands = {
  deleteBlock: (blockId) => {
    const edit = { dl: {} }
    edit.dl[blockId] = cpy(store.blox[blockId])
    return { edit,returns: undefined }
  },

  moveBlock: (blockId,parentId,idx) => {
    const edit = { mv: {} }
    const oldParent = store.blox[blockId].p
    const oldIdx = store.blox[oldParent].k.indexOf(blockId)
    edit.mv[blockId] = [parentId,idx,oldParent,oldIdx]
    return { edit,returns: undefined }
  },

  // writeBlock takes link title list to avoid recomputation. couples this with renderBlockBody
  writeBloc: (blocId,string) => {
    const edit = { df: {} }
    const block = store.blox[blocId]
    const oldString = block.s
    edit.df[blocId] = diff(string,oldString)
    return { edit,returns: undefined }
  },

  createBlock: (parentId,idx) => {
    const blockId = newUid()
    const edit = { cr: {} }
    edit.cr[blockId] = [parentId,idx]
    return {
      edit,
      returns: blockId
    }
  },

  createPage: (pageTitle) => {
    const pageId = newUid()
    const edit = { cr: {},df: {} }
    edit.cr[pageId] = []
    edit.df[pageId] = { i: pageTitle }
    return { edit,returns: pageId }
  },

  copyBlock: (blockId,newId,parentId,idx) => {
    const edit = { cr: {},df: {} }
    const copyBlock = (oldId,newId,parentId,idx) => {
      const block = store.blox[oldId]
      edit.cr[newId] = [parentId,idx]
      edit.df[newId] = { i: block.s }
      if (block.k) {
        let i = 0
        for (let child of block.k) {
          const newChildId = newUid()
          copyBlock(child,newChildId,newId,i)
          i++
        }
      }
    }
    copyBlock(blockId,newId,parentId,idx)
    return {
      edit,
      returns: newId
    }
  }

}

const queCommand = (...command) => {
  print(command)
  const { edit,returns } = commands[command[0]](...command.slice(1))
  edit.t = Date.now()
  activeEdits.push(edit)
  return returns
}

const commit = () => {
  if (activeEdits.length > 0) {

    for (let edit of activeEdits) {
      doEdit(edit)
    }
    activeEdits = []
    // saveWorker.postMessage(["edits",edits])
    debouncedSaveStore()
  } else {
    throw new Error(`tried to commit empty command buffer`)
  }
}

const runCommand = (...command) => {
  const returns = queCommand(...command)
  commit()
  return returns
}