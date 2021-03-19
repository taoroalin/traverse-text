const canWriteBloc = (blocId) => { // todo implement readonly blocs
  return true
}

/*
Paralel difs are too much work. Switching to simpler single command buffer
I feel like I had a specification for diffs, but I seem to have lost it.
{d:string,i:string,s:number}
d: string to delete backwards (keep string instead of length so it's reversible)
i: string to insert forwards
s: position. defaults to end of string

["cr"|"dl"|"df"|"mv", ]

*/

const isSynced = () => user.s.commitId === user.s.syncCommitId

const diff = (string, oldString) => { // todo real diff
  return { d: oldString, i: string }
}

let edits = []
let editsSessionStates = []
let activeEdits = []

const undoEditCacheStuff = (edit) => {
  const [op, id, p1, p2, p3, p4] = edit
  console.log(edit)
  switch (op) {
    case 'cr':
      if (p1 === undefined) {
        delete store.titles[p1.s]
      }
      break
    case 'df':
      setLinks(id)
      const bloc = store.blox[id]
      if (bloc.p === undefined) {
        const oldString = applyDif(bloc.s, p1) // this work could be deduplicated, but AAAAGGGGHHHH there's already so much coupling to deduplicate work!
        delete store.titles[oldString]
        store.titles[bloc.s] = id
      }
      break
  }
}

const undo = () => {
  const commit = edits.pop()
  sessionState = editsSessionStates.pop()
  for (let i = commit.edits.length - 1; i >= 0; i--) {
    const edit = commit.edits[i]
    undoEdit(edit, store.blox)
    undoEditCacheStuff(edit)
  }
}

const doEditCacheStuff = (edit) => {
  const [op, id, p1, p2, p3, p4] = edit
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
      setLinks(id)
      const bloc = store.blox[id]
      if (bloc.p === undefined) {
        const oldString = unapplyDif(bloc.s, p1) // this work could be deduplicated, but AAAAGGGGHHHH there's already so much coupling to deduplicate work!
        delete store.titles[oldString]
        store.titles[bloc.s] = id
      }
      break
  }
}

const doEdit = (...edit) => {
  const time = intToBase64(Date.now())
  activeEdits.push(edit)
  print(edit)
  // console.log(edit)
  doEditBlox(edit, store.blox, time)
  doEditCacheStuff(edit)
}

const commit = () => {
  const newId = newUUID()
  edits.push({ id: newId, t: intToBase64(Date.now()), edits: activeEdits })
  editsSessionStates.push(cpy(sessionState))
  store.commitId = newId
  user.s.commitId = newId
  activeEdits = []
  setTimeout(() => {
    debouncedSaveStore()
    saveUser()
  }, 0)
}
const commitEdit = (...edit) => {
  doEdit(...edit)
  commit()
}

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
  saveStoreStringLocal(fullString)
}

const saveStoreIncremental = () => {
  syncEditsWithBasicBitchServer()
  saveStoreStringLocal(JSON.stringify(store))
}

const saveStoreStringLocal = (string) => {
  try {
    localStorage.setItem('store', string)
  } catch (e) {
    // mainly catch localstorage size limit
    localStorage.removeItem('store')
  }
  const transaction = idb.transaction(["stores"], "readwrite")
  const storeStore = transaction.objectStore("stores")
  const req = storeStore.put({
    graphName: store.graphName,
    store: string
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
  if (user.s.commitId !== user.s.syncCommitId) {
    clearTimeout(saveStoreTimeout)
    saveStoreTimeout = setTimeout(saveStore, 300)
  }
}

const print = (text) => {
  if (user.s.logging) {
    console.log(text)
  }
}

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
  copyBlock: (oldId, parentId, idx) => {
    // todo make this stop infinite looping when you copy a block into its own children using snapshots when I get those
    const copyBlock = (oldId, parentId, idx) => {
      const newId = newUid()
      const block = store.blox[oldId]
      doEdit("cr", newId, parentId, idx)
      doEdit("df", newId, diff(block.s, ""))
      if (block.k) {
        for (let i = 0; i < block.k.length; i++) {
          const kidId = block.k[i]
          copyBlock(kidId, newId, i)
        }
      }
      return newId
    }
    return copyBlock(oldId, parentId, idx)
  },
  delete: (id) => {
    const bloc = store.blox[id]
    let idx = undefined
    if (bloc.p) idx = store.blox[bloc.p].k.indexOf(id)
    doEdit("dl", id, cpy(bloc), idx)
  },
  write: (id, string) => {
    doEdit("df", id, diff(string, store.blox[id].s))
  },
  writePageTitle: (id, string) => {
    const oldString = store.blox[id].s
    // create page first so that changing the backrefs will reference existing page instead of making new page
    doEdit("df", id, diff(string, oldString))
    for (let ref of store.refs[id] || []) {
      const bloc = store.blox[ref]
      const oldBlocString = bloc.s
      const newBlocString = bloc.s.replaceAll(oldString, string)
      console.log(oldBlocString)
      console.log(newBlocString)
      doEdit("df", ref, diff(newBlocString, oldBlocString))
    }
  },
  createPage: (title) => {
    const id = newUid()
    doEdit("cr", id)
    doEdit("df", id, diff(title, ""))
    return id
  },
  move: (id, parentId, idx) => {
    const bloc = store.blox[id]
    doEdit("mv", id, parentId, idx, bloc.p, store.blox[bloc.p].k.indexOf(id))
  }
}
for (let k in macros.nocommit) {
  macros[k] = (...args) => {
    const result = macros.nocommit[k](...args)
    commit()
    return result
  }
}
