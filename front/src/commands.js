const cpy = x => JSON.parse(JSON.stringify(x))

/*
Paralel difs are too much work. Switching to simpler single command buffer
I feel like I had a specification for diffs, but I seem to have lost it.
{d:string,i:string,s:number}
d: string to delete backwards (keep string instead of length so it's reversible)
i: string to insert forwards
s: position. defaults to end of string

["cr"|"dl"|"df"|"mv", ]

*/

const applyDif = (string,dif) => {
  // not using dif.s||result.length because dif.s could be 0
  let end = string.length
  if (dif.s !== undefined) end = dif.s
  const start = end - (((dif.d !== undefined) && dif.d.length) || 0)
  return string.substring(0,start) + (dif.i || "") + string.substring(end)
}

const unapplyDif = (string,dif) => {
  let start = string.length + (((dif.i !== undefined) && dif.i.length) || 0)
  if (dif.s !== undefined) start = dif.s
  const end = start + (((dif.i !== undefined) && dif.i.length) || 0)
  result = string.substring(0,start) + (dif.d || "") + string.substring(end)
  console.log(dif)
  console.log(`was "${string}" now "${result}"`)
  return result
}

const diff = (string,oldString) => { // todo real diff
  return { d: oldString,i: string }
}

// useless function just for reference
// actually because s defaults to end of string inverse diff only works if you know the store at this state
const inverseDiff = (diff) => {
  const result = {}
  if (diff.s) result.s = diff.s
  else diff.s = -diff.i.length
  if (diff.d) result.i = diff.d
  if (diff.i) result.d = diff.i
  return result
}


let edits = []
let activeEdits = []

const undoEdit = () => {
  const time = Date.now()
  const commit = edits.pop()
  print(commit)
  // console.log(edit)
  for (let edit of commit.edits) {

    const [op,id,p1,p2,p3,p4] = edit
    switch (op) {
      case "cr":
        const parent = store.blox[id].p
        if (parent) {
          store.blox[parent].k = store.blox[parent].k.filter(x => x !== id)
        }
        delete store.blox[id]
        break
      case "dl":
        store.blox[id] = p1
        const parentId = p1.p,idx = p2
        if (parentId) {
          if (!store.blox[parentId].k) store.blox[parentId].k = []
          if (idx) {
            store.blox[parentId].k.splice(idx,0,id)
          } else {
            store.blox[parentId].k.push(id)
          }
        }
        break
      case "mv":
        const oldParent = p1,oidx = p2,newParent = p3,nidx = p4
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
        bloc.s = unapplyDif(bloc.s,df)
        if (!bloc.p) store.titles[bloc.s] = id
        break
    }
  }
}

const doEditCacheStuff = (edit) => {
  const [op,id,p1,p2,p3,p4] = edit
  switch (op) {
    case 'dl':
      if (!p1.p) {
        delete store.titles[p1.s]
      }
      const refsOut = store.forwardRefs[id]
      if (refsOut) {
        for (let ref of refsOut) {
          const backRefs = store.refs[ref]
          if (backRefs.length === 1) {
            delete store.refs[ref]
          } else {
            store.refs[ref] = backRefs.filter(x => x != id)
          }
        }
      }
      const refsIn = store.refs[id]
      if (refsIn) {
        // todo turn refs to dead pages into plaintext
      }
      break
    case 'df':
      break
  }
}

const doEditBlox = (edit,time) => {
  const [op,id,p1,p2,p3,p4] = edit
  switch (op) {
    case "dl":
      const parent = store.blox[id].p
      if (parent) {
        store.blox[parent].k = store.blox[parent].k.filter(x => x !== id)
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
      const newParent = p1,nidx = p2,oldParent = p3
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

const doEdit = (...edit) => {
  const time = Date.now()
  activeEdits.push(edit)
  print(edit)
  // console.log(edit)
  doEditBlox(edit,time)
  doEditCacheStuff(edit)
}

const commit = () => {
  const newId = newUUID()
  edits.push({ id: newId,t: Date.now(),edits: activeEdits })
  store.commitId = newId
  user.settings.commitId = newId
  activeEdits = []
  debouncedSaveStore()
  saveUser()
}
const commitEdit = (...edit) => {
  doEdit(...edit)
  commit()
}

const LOCAL_STORAGE_MAX = 4500000
const saveStore = () => {
  // stringify blox, then stringify rest of store and insert blox string to avoid re-stringifying blox
  const blox = store.blox
  const bloxText = JSON.stringify(blox)
  let fullString = "{"
  for (let key in store) {
    if (key !== 'blox' && store[key] !== undefined)
      fullString += '"' + key + '":' + JSON.stringify(store[key]) + ","
  }
  fullString += '"blox":' + bloxText + '}'
  saveStoreToBasicBitchServer(bloxText)
  try {
    localStorage.setItem('store',fullString)
  } catch (e) {
    // mainly catch localstorage size limit
    localStorage.removeItem('store')
  }
  const transaction = idb.transaction(["stores"],"readwrite")
  const storeStore = transaction.objectStore("stores")
  const req = storeStore.put({
    graphName: store.graphName,
    store: fullString
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
  if (user.settings.commitId !== user.settings.syncCommitId) {
    clearTimeout(saveStoreTimeout)
    saveStoreTimeout = setTimeout(saveStore,300)
  }
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
    // todo make this stop infinite looping when you copy a block into its own children using snapshots when I get those
    const copyBlock = (oldId,parentId,idx) => {
      const newId = newUid()
      const block = store.blox[oldId]
      console.log(`copying block ${block.s}`)
      doEdit("cr",newId,parentId,idx)
      doEdit("df",newId,diff(block.s,""))
      if (block.k) {
        for (let i = 0; i < block.k.length; i++) {
          const kidId = block.k[i]
          copyBlock(kidId,newId,i)
        }
      }
      return newId
    }
    return copyBlock(oldId,parentId,idx)
  },
  delete: (id) => {
    const bloc = store.blox[id]
    let idx = undefined
    if (bloc.p) idx = store.blox[bloc.p].k.indexOf(id)
    doEdit("dl",id,cpy(bloc),idx)
  },
  write: (id,string) => {
    doEdit("df",id,diff(string,store.blox[id].s))
  },
  createPage: (title) => {
    const id = newUid()
    doEdit("cr",id)
    doEdit("df",id,diff(title,""))
    return id
  },
  move: (id,parentId,idx) => {
    const bloc = store.blox[id]
    doEdit("mv",id,parentId,idx,bloc.p,store.blox[bloc.p].k.indexOf(id))
  }
}
for (let k in macros.nocommit) {
  macros[k] = (...args) => {
    const result = macros.nocommit[k](...args)
    commit()
    return result
  }
}