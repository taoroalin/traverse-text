const cpy = x => JSON.parse(JSON.stringify(x))

/*
Paralel difs are too much work. Switching to simpler single command buffer

["cr"|"dl"|"df"|"mv", ]

*/

const applyDif = (string,difs) => {
  let result = string
  for (let dif of difs) {
    let start = result.length
    if (dif.s !== undefined) start = dif.s
    const end = start + (((dif.d !== undefined) && dif.d.length) || 0)
    result = result.substring(0,start) + (dif.i || "") + result.substring(end)
  }
  console.log(result)
  return result
}

const diff = (string,oldString) => { // todo real diff
  return [{ s: 0,d: oldString,i: string }]
}

let edits = []
let activeEdits = []

const doEdit = (...edit) => {
  const time = Date.now()
  activeEdits.push(edit)
  print(edit)
  console.log(edit)
  const [op,id,p1,p2,p3,p4] = edit
  switch (op) {
    case "dl":
      const parent = store.blox[id].p
      if (parent) {
        store.blox[parent].k = store.blox[parent].k.filter(x => x !== id)
      } else {
        delete store.titles[store.blox[id].s]
      }
      delete store.blox[id]
      break
    case "cr":
      store.blox[id] = {
        ct: time,
        s: ""
      }
      const parentId = p1,idx = p2
      if (parentId) {
        store.blox[id].p = parentId
        if (!store.blox[parentId].k) store.blox[parentId].k = []
        if (idx) {
          store.blox[parentId].k.splice(idx,0,id)
        } else {
          store.blox[parentId].k.push(id)
        }
      }
      break
    case "mv":
      const newParent = p1,nidx = p2,oldParent = p3,oidx = p4
      const block = store.blox[id]
      store.blox[oldParent].k = store.blox[oldParent].k.filter(x => x != id)
      block.p = newParent
      if (!store.blox[newParent].k) store.blox[newParent].k = []
      store.blox[newParent].k.splice(nidx,0,id)
      break
    case "df":
      const df = p1
      const bloc = store.blox[id]
      bloc.et = time
      if (!bloc.p) delete store.titles[bloc.s]
      bloc.s = applyDif(bloc.s,df)
      if (!bloc.p) store.titles[bloc.s] = id
      break
  }
}

const commit = () => {
  edits.push({ id: newUUID(),t: Date.now(),edits: activeEdits })
  activeEdits = []
  debouncedSaveStore()
}
const commitEdit = (...edit) => {
  doEdit(...edit)
  commit()
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
    console.log(event)
  }
}

let saveStoreTimeout = null

const debouncedSaveStore = () => {
  clearTimeout(saveStoreTimeout)
  saveStoreTimeout = setTimeout(saveStore,300)
}

const print = (text) => {
  if (user.logging) {
    console.log(text)
  }
}

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

// I'm using base64 126 bit UUIDs instead because they're less length in JSON and they are more ergonomic to write in markup like ((uuid)) if I ever want to do that
const newUUID = () => { // this is 126 bits, 21xbase64
  let values = new Uint8Array(21)
  crypto.getRandomValues(values)
  let result = ""
  for (let i = 0; i < 21; i++) {
    result += CHARS_64[values[i] % 64]
  }
  return result
}


const macros = {}
macros.nocommit = {
  copyBlock: (oldId,parentId,idx) => {
    const copyBlock = (oldId,parentId,idx) => {
      const newId = newUid()
      const block = store.blox[oldId]
      console.log(`copying block ${block.s}`)
      doEdit("cr",newId,parentId,idx)
      doEdit("df",newId,diff(block.s,""))
      if (block.k) {
        for (let i = 0; i < block.k.length; i++) {
          copyBlock(block.k[i],newId,i)
        }
      }
      return newId
    }
    return copyBlock(oldId,parentId,idx)
  },
  delete: (id) => {
    doEdit("dl",id,cpy(store.blox[id]))
  },
  write: (id,string) => {
    doEdit("df",id,diff(string,store.blox[id].s))
  },
  createPage: (title) => {
    const id = newUid()
    doEdit("cr",id)
    doEdit("df",id,diff(title,""))
  },
  move: (id,parentId,idx) => {
    const bloc = store.blox[id]
    doEdit("mv",id,parentId,idx,bloc.p,store.blox[bloc.p].k.indexOf(id))
  }
}
for (let k in macros.nocommit) {
  macros[k] = (...args) => {
    macros.nocommit[k](...args)
    commit()
  }
}