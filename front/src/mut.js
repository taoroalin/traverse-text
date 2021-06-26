/**
what do I want out of a edit format

string based so it works with localStorage
dense
easy to parse
*/

/**
putting all data consistency related things into an object, like state = {account,store,editStore1, editStore2} would add a lot of chars of code everywhere that reads state. instead, I'll have a convention that data is read right out of store, otherStores, and sessionState, and it's written to in special functions
 */

/**
 
omg what do you do about this problem? let's say you send a push request, your computer sends all the packets, but times out on receipt for the last packet. then you think "the request failed", but could the server think the request didn't fail?
 
it looks like there's no built-in way to make sure this doesn't happen?
 
only solution is to be able to just integrate that change when you see the server again?
 
 */

const qualifiedBloxToStore = (qualifiedBlox) => {
  let theStore = { ...blankStore(graphName), ...qualifiedBlox }
  generateTitles(theStore)
  generateRefs(theStore)
  generateInnerOuterRefs(theStore)
  return theStore
}

const defaultUser = () => ({ s: { graphName: "default", theme: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? "purple" : "light", topBar: "visible", logging: false, spellcheck: false, editingSpotlight: true, hideBulletsUnlessHover: true, } })

const hashPassword = async (password, email) => {
  const middlePepper = "76pCgT0lW6ES9yjt01MeH"
  const beginPepper = "CeoPPOv9rIq6O7YiYlSFX"
  const endPepper = "Rzw1dagomQGpoo2s7iGE3lYL2yruaJDGrUk6bFCvz"

  const saltAndPeppered = `${beginPepper}${password}${middlePepper}${email}${endPepper}`
  const buffer = textEncoder.encode(saltAndPeppered)
  const hashed = await crypto.subtle.digest("SHA-256", buffer)
  const passwordHashBuffer = new Uint8Array(hashed)
  return btoa(String.fromCharCode(...passwordHashBuffer))
}

// all the mut methods return an error string. any place that's mutating may need to check error string
const mut = {
  idbVersion: 5,

  idb: null,

  editInFlight: false,
  localPersistTimeout: null,
  editTime: null,

  connectIdb: promisify((resolve) => {
    const r = indexedDB.open("microroam", mut.idbVersion)
    r.onsuccess = (openEvent) => {
      mut.idb = r.result
      resolve()
    }
    r.onupgradeneeded = (openEvent) => {
      console.log("upgradeneeded")
      mut.idb = r.result
      const stores = Array.from(mut.idb.objectStoreNames)
      if (!stores.includes("stores")) {
        mut.idb.createObjectStore("stores", { keyPath: "graphName" })
      } else {
        r.onsuccess = (event) => {
          console.log("new success")
          const storeStore = mut.idb.transaction(["stores"], "readwrite").objectStore("stores")
          // @TODO tell user blox version is being updated. difficult because notifyText hasn't loaded yet
          storeStore.getAll().onsuccess = (event) => {
            const cursor = event.target.result
            if (!cursor) {
              resolve()
              return
            }
            const storeWrapper = JSON.parse(cursor.value)
            const newStore = upgradeOldStore[mut.idb.version](storeWrapper.store)
            const updateReq = storeStore.put({
              graphName: storeWrapper.graphName,
              store: JSON.stringify(newStore)
            })
            updateReq.onsuccess = () => {
            }
            updateReq.onerror = (event) => {
              console.log(event)
              console.log("IDB UPGRDE ERROR")
            }
            cursor.continue()
          }
        }
      }
    }
  }),

  initUser: async () => {
    const localStorageUser = localStorage.getItem('user')
    if (localStorageUser) {
      mut._loginUser(JSON.parse(localStorageUser), false)
      if (user.h) {
        const serverUser = await clientGo.login(user.h)
        if (serverUser) {
          mut._loginUser(serverUser)
        }
      }
    } else {
      mut._loginUser(defaultUser())
    }
  },

  login: async (email, password) => {
    const passwordHash = await hashPassword(password, email)
    const serverUser = await clientGo.login(passwordHash)
    if (serverUser) {
      mut._loginUser(serverUser)
    }
    return "error"
  },

  _loginUser: async (theUser, save = true) => {
    user = theUser
    if (applyUserSettingsToDom) applyUserSettingsToDom()
    if (save) localStorage.setItem("user", JSON.stringify(user))
  },

  __loadIdbStores: async () => {
    const storeStore = idb.transaction(["stores"], "readonly").objectStore("stores")
    // @TODO tell user blox version is being updated. difficult because notifyText hasn't loaded yet
    storeStore.getAll().onsuccess = (event) => {
      const cursor = event.target.result
      const storeWrapper = JSON.parse(cursor.value)
      otherStores[storeWrapper.graphName] = storeWrapper.store
      cursor.continue()
    }
  },

  // callback is here because graph might be loaded twice (out of date version, then new version), and it's set up to call the callback for each one
  loadGraphName: async (graphName, multiCallback) => {

    if (otherStores[graphName]) {
      multiCallback()
      return
    }
    let fails = 0
    const fail = () => {
      fails++
      if (fails == 2) {
        multiCallback("failed")
      }
    }
    const fetchPromise = (async () => {
      const qualifiedBlox = await clientGo.get(graphName)
      if (typeof qualifiedBlox === "object") {
        otherStores[qualifiedBlox.graphName] = qualifiedBlox
        multiCallback()
        clientGo.saveOtherStore(graphName)
      } else {
        fail()
      }
    })()
    const storeStore = mut.idb.transaction(["stores"], "readonly").objectStore("stores")
    storeStore.get(graphName).onsuccess = (event) => {
      const wrapper = event.target.result
      if (wrapper) {
        if (fails === 0) {
          otherStores[graphName] = wrapper.store
          multiCallback()
        }
      } else {
        fail()
      }
    }
  },

  logout: async () => {
    const r = indexedDB.deleteDatabase('microroam')
    r.onsuccess = () => {
      localStorage.clear()
      window.location.href = window.location.href // it's the caller's job to make sure there's no form submission or link queued!
    }
  },

  signup: async (email, username, password) => {
    const passwordHash = await hashPassword(password, email)
    console.log(`signed up`)
    const serverUser = await clientGo.signup(email, username, passwordHash)
    if (serverUser) {
      mut._loginUser(serverUser)
    } else {
      return "failed to sign up"
    }
  },

  create: async (qualifiedBlox) => {

  },

  createEmpty: async (graphName) => {
    const qualifiedBlox = { graphName, commitId: "" }
    const result = await clientGo.create(qualifiedBlox)
    if (result !== undefined) {
      otherStores[graphName] = qualifiedBlox
      mut.saveOtherStore(graphName)
    }
    return "no worky"
  },
  /*
  Paralel difs are too much work. Switching to simpler single command buffer
  {d:string,i:string,s:number}
  d: string to delete backwards (keep string instead of length so it's reversible)
  i: string to insert forwards
  s: distance from end of string. defaults to end of string
  
  ["cr"|"dl"|"df"|"mv", ]
  
  
  Idea for Pure String Edit Stream Representation
  cr dl mv df tm
  c  d  m  e  t
  
  "diff" stream representation
  i[len].[string]
  d[len].[string]
  s[len]
  
  ["cr","evIF6p0Ld","7ttoFbwPh",0]
  cevIF6p0Ld7ttoFbwPh0
  
  ["df","evIF6p0Ld",[{"i":"hi"}]]  
  eevIF6p0Ldi2.hi
  31:15
  
  ["df","evIF6p0Ld",[{"i":"ello","d":"i","s":1}]]  
  eevIF6p0Ldi4.ellod1.is1
  47:23
  */
  _applyDif: (string, dif) => {
    // not using dif.s||result.length because dif.s could be 0
    let end = string.length
    if (dif.s !== undefined) end -= dif.s
    const start = end - (((dif.d !== undefined) && dif.d.length) || 0)
    return string.substring(0, start) + (dif.i || "") + string.substring(end)
  },

  _doEditBlox: (edit, blox, time) => {
    const [op, id, p1, p2, p3] = edit
    switch (op) {
      case "dl":
        const parent = blox[id].p
        if (parent) {
          blox[parent].k = blox[parent].k.filter(x => x !== id)
        }
        delete blox[id]
        // need to handle inner blocks of deleted block. thinking of pulling them into the outer scope
        break
      case "cr":
        blox[id] = {
          ct: time,
          s: ""
        }
        const parentId = p1, idx = p2
        if (parentId !== undefined) {
          blox[id].p = parentId
          if (blox[parentId].k === undefined) blox[parentId].k = []
          if (idx === undefined) {
            blox[parentId].k.push(id)
          } else {
            blox[parentId].k.splice(idx, 0, id)
          }
        }
        break
      case "mv":
        const newParent = p1, nidx = p2, oldParent = p3
        const block = blox[id]
        blox[oldParent].k = blox[oldParent].k.filter(x => x != id)
        block.p = newParent
        if (!blox[newParent].k) blox[newParent].k = []
        blox[newParent].k.splice(nidx, 0, id)
        break
      case "df":
        const df = p1
        const bloc = blox[id]
        bloc.et = time
        bloc.s = applyDif(bloc.s, df)
        break
    }
  },

  _doEditCacheStuff: (edit, includeInnerOuter = false) => {
    const [op, id, p1] = edit
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
        const forwardRefsBefore = [...store.forwardRefs[id] || []]
        setLinks(store, id, true, includeInnerOuter)
        propagateRefs(id, store.forwardRefs[id], forwardRefsBefore)

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
  },

  _doEditDom: (edit) => {

    const [op, id, p1, p2, p3, p4] = edit
    switch (op) {
      case 'dl':
        domGlobalEdit.unrenderBlocId(id)
        break
      case 'mv': {
        const newParentId = p1, nidx = p2, oldParent = p3
        domGlobalEdit.unrenderBlocId(id)
        domGlobalEdit.addChild(id, newParentId, nidx)
      }
        break
      case 'cr':
        domGlobalEdit.addChild(id, p1, p2)
        break
      case 'df':
        const blocks = document.querySelectorAll(`.block[data-id="${id}"]`)
        for (let block of blocks) {
          const blockBody = block.children[1]
          blockBody.innerHTML = ""
          render.blockBody(store, blockBody, store.blox[id].s, false)
        }
    }
  },

  doEditShadow: (edit, time) => {
    if (edit[0] === "tm") {
      return edit[1]
    }
    mut._doEditBlox(edit, store.blox, time)
    mut._doEditCacheStuff(edit)
    mut._doEditDom(edit)
    return time
  },

  doEdit: (edit) => {
    if (edit[0] === "tm") {
      mut.editTime = edit[1]
      return
    } else if (!mut.editTime) {
      mut.editTime = Date.now()
      const timeEdit = ["tm", mut.editTime]
      store.undoEditInProgress.push(timeEdit)
      store.unsyncedEdits.push(timeEdit)
      store.editStartSessionState = cpy(sessionState)
    }

    mut._doEditBlox(edit, store.blox, mut.editTime)
    mut._doEditCacheStuff(edit)
    mut._doEditDom(edit)

    store.undoEditInProgress.push(edit)
    store.unsyncedEdits.push(edit)
  },

  undo: () => {
    if (store.undoEdits.length === 0) {
      return
    }
    const undoItem = store.undoEdits.pop()
    store.redoEdits.push(undoItem)
    const reversedEdits = reverseEdits(undoItem.edits)
    for (let edit of reversedEdits) {
      mut.doEdit(edit)
    }
  },

  _truncateUndoEdits: () => {
    if (store.undoEdits.length > UNDO_EDITS_SLACK + UNDO_EDITS_TO_KEEP) {
      store.undoEdits.splice(0, UNDO_EDITS_SLACK)
    }
  },

  finishEdit: () => {
    if (!store) return

    mut.editTime = null
    if (store.undoEditInProgress.length === 1) {
      return
    }

    store.undoEdits.push({ sessionStateStart: store.editStartSessionState, sessionStateEnd: cpy(sessionState), edits: store.undoEditInProgress }) //@PERFORMANCE drain copying session state. should use setter on session state, store set fields
    store.editStartSessionState = null
    store.undoEditInProgress = []
    store.redoEdits = []

    mut._truncateUndoEdits()

    mut.persistEdit()
  },

  persistEdit() {
    mut.saveStoreLocalDebounced()
    mut.checkUpOnEditSync()
  },

  saveStoreLocalDebounced: () => {
    clearTimeout(mut.localPersistTimeout)
    mut.localPersistTimeout = setTimeout(mut.saveStoreLocal, SAVE_LOCAL_DEBOUNCE)
  },

  saveStoreLocal: () => {
    const string = JSON.stringify(store)
    try {
      localStorage.setItem(store.graphName, string)
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
    }
  },

  saveOtherStore: (graphName) => {
    const string = JSON.stringify(otherStores[graphName])
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
    }
  },

  checkUpOnEditSync: async () => {
    if (mut.editInFlight) {
      return
    }
    mut.editInFlight = store.unsyncedEdits.length
    const commit = { edits: store.unsyncedEdits, prevCommitId: store.commitId, commitId: newUUID() }
    const editStatus = await clientGo.edit(store.graphName, commit)
    if (editStatus === undefined) {
      store.unsyncedEdits.splice(0, mut.editInFlight)
      store.commitId = commit.commitId
    } else if (typeof editStatus === "number") {

    } else if (typeof editStatus === "object") {// editStatus is commit from server
      const reversedLocalEdits = reverseEdits(store.unsyncedEdits)
      let time = null
      for (let edit of reversedLocalEdits) {
        time = mut.doEditShadow(edit, time)
      }
      const operationalTransformData = generateOTData(edits)
      for (let edit of edits) {
        time = mut.doEditShadow(edit, time)
      }
      editOT(operationalTransformData, store.unsyncedEdits)
      store.commitId = commitId
    }
    mut.editInFlight = 0
  },

  setUserSetting: async (key, value) => {
    const oldValue = user.s[key]
    if (oldValue === value) return

    if (applyUserSettingsToDom) applyUserSettingsToDom()

    localStorage.setItem("user", JSON.stringify(user))
    const settingsResponse = await clientGo.settings(user.s)
  },

  sessionStateFromHash: () => {
    sessionState = urlToSessionState(location.hash)
  }
}

const generateOTData = (edits) => {

}

const editOT = (otData, edits) => {

}

const diff = (string, oldString) => { // todo real diff
  return { d: oldString, i: string }
}

const canWriteToBlockNode = (node) => { // todo implement readonly blocs
  return node.dataset.graphName == store.graphName
}

const domGlobalEdit = {
  addChild: (id, parentId, idx) => {
    const newParents = document.querySelectorAll(`[data-id="${parentId}"]`)
    for (let newParent of newParents) {
      if (newParent.className === 'block') {
        render.block(store, newParent.children[3], id, idx)
      } else if (newParent.className === 'page') {
        render.block(store, newParent.children[1], id, idx)
      }
    }
  },
  rerenderBlocId: (blocId) => {
    const bloc = store.blox[blocId]
    const parentBloc = store.blox[bloc.p]
    const targetElements = document.querySelectorAll(`.block[data-id="${blocId}"]`)
    for (let targetElement of targetElements) {
      const parentElement = targetElement.parentNode
      targetElement.remove()
      render.block(store, parentElement, blocId, parentBloc.k.indexOf(blocId))
    }
  },

  unrenderBlocId: (id) => {
    const targetElements = document.querySelectorAll(`.block[data-id="${id}"]`)
    for (let targetElement of targetElements) {
      targetElement.remove()
    }
  },
}

const reverseEdit = (edit) => {
  const [op, id, p1, p2, p3, p4] = edit
  const result = [op, id]
  switch (op) {
    case "dl":
      result.op = "cr"
      result.push(p1)
      result.push(p2)
      break
    case "cr":
      result.op = "dl"
      result.push(p1)
      result.push(p2)
      break
    case "df":
      const df = p1
      // does s really not change?
      result.push({ i: df.d, d: df.i, s: df.s })
      break
    case "mv":
      result.push(p3)
      result.push(p4)
      result.push(p1)
      result.push(p2)
      break
  }
  return result
}

const reverseEdits = (edits) => {
  const result = []
  for (let i = edits.length - 1; i >= 0; i--) {
    const reversed = reverseEdit(edits[i])
    result.push(reversed)
  }
  return result
}

const macros = {
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
    mut.doEdit("dl", id, cpy(bloc), idx)
  },
  write: (id, string) => {
    mut.doEdit("df", id, diff(string, store.blox[id].s))
  },
  writePageTitle: (id, string) => {
    const oldString = store.blox[id].s
    // create page first so that changing the backrefs will reference existing page instead of making new page
    mut.doEdit("df", id, diff(string, oldString))
    for (let ref of store.refs[id] || []) {
      const bloc = store.blox[ref]
      const oldBlocString = bloc.s
      const newBlocString = bloc.s.replaceAll(oldString, string)
      console.log(oldBlocString)
      console.log(newBlocString)
      mut.doEdit("df", ref, diff(newBlocString, oldBlocString))
    }
  },
  createPage: (title) => {
    if (store.titles[title]) {
      console.error(`tried to create page that already exists ${title}`)
      return
    }
    // console.log(`making page ${title}`)
    const id = newUid()
    // if you create a new page it's guaranteed to not be rendered on the current page, so I can skip editing dom
    mut.doEdit("cr", id)
    mut.doEdit("df", id, diff(title, ""))
    const firstChildId = newUid()
    mut.doEdit('cr', firstChildId, id, 0)
    return id
  },
  create: (parentId, idx) => {
    const id = newUid()
    mut.doEdit('cr', id, parentId, idx)
    return id
  },
  move: (id, parentId, idx) => {
    const bloc = store.blox[id]
    if (idx === undefined) idx = store.blox[parentId].k.length
    mut.doEdit("mv", id, parentId, idx, bloc.p, store.blox[bloc.p].k.indexOf(id))
  }
}