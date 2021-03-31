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

let undoCommitList = []
let undoCommitSessionStateList = []
let undoCommitInProgress = []

let masterCommitList = []
let masterCommitInProgress = []


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
      setLinks(store, id)
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
  const commit = undoCommitList.pop()
  sessionState = undoCommitSessionStateList.pop()
  for (let i = commit.edits.length - 1; i >= 0; i--) {
    const edit = commit.edits[i]
    undoEditBlox(edit, store.blox)
    undoEditCacheStuff(edit)
  }
}

const doEditCacheStuff = (edit, includeInnerOuter = false) => {
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
      setLinks(store, id, includeInnerOuter)
      const bloc = store.blox[id]
      if (bloc.p === undefined) {
        const oldString = unapplyDif(bloc.s, p1) // this work could be deduplicated, but AAAAGGGGHHHH there's already so much coupling to deduplicate work!
        delete store.titles[oldString]
        if (store.titles[bloc.s] !== undefined) {
          console.error(`duplicate block title ${bloc.s}`)
          return
        }
        store.titles[bloc.s] = id
      }
      break
  }
}

const doEdit = (...edit) => {
  const time = intToBase64(Date.now())
  undoCommitInProgress.push(edit)
  masterCommitInProgress.push(edit)
  print(edit)
  // console.log(edit)
  doEditBlox(edit, store.blox, time)
  doEditCacheStuff(edit)
}

const commit = () => {
  const newId = newUUID()
  undoCommitList.push({ id: newId, t: intToBase64(Date.now()), edits: undoCommitInProgress })
  undoCommitSessionStateList.push(cpy(sessionState))
  user.s.commitId = newId
  undoCommitInProgress = []
  setTimeout(() => {
    debouncedSaveStore()
    saveUserJustLocalStorage()
  }, 0)
}

const commitEdit = (...edit) => {
  doEdit(...edit)
  commit()
}

const saveStore = (force = false) => {
  // stringify blox, then stringify rest of store and insert blox string to avoid re-stringifying blox
  const blox = store.blox
  const bloxText = JSON.stringify(blox)
  let fullString = "{"
  for (let key in store) {
    if (key !== 'blox' && store[key] !== undefined)
      fullString += '"' + key + '":' + JSON.stringify(store[key]) + ","
  }
  fullString += '"blox":' + bloxText + '}'
  saveStoreToBasicBitchServer(bloxText, force)
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
    console.error(`Local Storage Failure: ${e}`)
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
    saveStoreTimeout = setTimeout(saveStoreIncremental, 300)
  }
}

const print = (text) => {
  if (user.s.logging) {
    console.log(text)
  }
}

// @inprogress
// originally I wanted to just collect changes done on each id individually and consolidate them, but the fact that {i:"a"} operates on the end and {i:"a", p:1} operates from the beginning means you can't consolidate between end and middle changes without knowing starting or ending configuration. could be fixed by indexing everthing from the end
// todo index diffs from the end instead of the beginning to make it consistent with end-default
// also moving blocks changes the idx of other children, which means moves on different blocks aren't independent
// so what really needs to happen is a maximal partial state must be created and then compressed
// requires indexing around holes / insertions into child lists
const mergeEdits = (edits) => {
  const result = []
  const state = {}
  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i]

  }
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
    if (store.titles[title]) {
      console.error(`tried to create page that already exists ${title}`)
      return
    }
    console.log(`making page ${title}`)
    const id = newUid()
    doEdit("cr", id)
    doEdit("df", id, diff(title, ""))
    return id
  },
  create: (parentId, idx) => {
    const id = newUid()
    doEdit('cr', id, parentId, idx)
    return id
  },
  move: (id, parentId, idx) => {
    const bloc = store.blox[id]
    if (idx === undefined) idx = store.blox[parentId].k.length
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
