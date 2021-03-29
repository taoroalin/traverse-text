// blox or bloc means either block or page. they're almost the same, just one has a parent and the other doesn't, and linking syntax is different
const blankStore = () => ({
  blox: {},
  titles: {},
  refs: {},
  innerRefs: {},
  outerRefs: {},
  roamProps: {},
  ownerRoamId: undefined,
  graphName: undefined,
})

const bloxProps = [
  "s",  // string
  "p",  // parent
  "ct", // create time
  "k", // kids
  "et", // edit time
  "cu", // create user
  "eu"  // edit user
]

const gcPage = (store, pageId) => {
  const page = store.blox[pageId]
  const refs = store.refs[pageId]
  if ((page.k === undefined || page.k.length === 0) && (refs === undefined || refs.length === 0)) {
    macros.nocommit.delete(pageId)
  }
}

const fixParents = () => {
  for (let id in store.blox) {
    delete store.blox[id].p
  }
  for (let id in store.blox) {
    const bloc = store.blox[id]
    for (let childId of bloc.k || []) {
      store.blox[childId].p = id
    }
  }
}

const fixDuplicatePages = () => {
  const titles = {}
  for (let id in store.blox) {
    const bloc = store.blox[id]
    if (!bloc.p) {
      pushToArrInObj(titles, store.blox[id].s, id)
    }
  }
  for (let id in titles) {
    const arr = titles[id]
    for (let i = 1; i < arr.length; i++) {
      for (let k of store.blox[arr[i]].k || []) {
        macros.move(k, arr[0])
      }
      macros.delete(arr[i])
    }
  }
}

// 1             2              3   4         5         6       7
// page-ref-open page-ref-close tag block-ref attribute literal code-block
const parseRegexJustLinks = /(\[\[)|(\]\])|#([\/a-zA-Z0-9_-]+)|\(\(([a-zA-Z0-9\-_]+)\)\)|(^[\/a-zA-Z0-9_-]+)::|`([^`]+)`|```/g

const setLinks = (store, blocId, doInnerOuterRefs = false, nogc = false) => {
  for (let ref of store.forwardRefs[blocId] || []) {
    store.refs[ref] = store.refs[ref].filter(x => x !== blocId)
    if (!nogc) gcPage(store, ref)
  }
  const forwardRefs = []
  store.forwardRefs[blocId] = forwardRefs

  let doRef
  if (doInnerOuterRefs) {
    doRef = (ref) => {
      if (ref in store.refs) {
        store.refs[ref].push(blocId)
      } else {
        store.refs[ref] = [blocId]
      }
      forwardRefs.push(ref)
    }
  } else {
    doRef = (ref) => {
      if (ref in store.refs) store.refs[ref].push(blocId)
      else store.refs[ref] = [blocId]
      forwardRefs.push(ref)
    }
  }

  const doTitle = (title) => {
    let ref = store.titles[title]
    if (ref === undefined) {
      ref = macros.nocommit.createPage(title) // todo manage the commit on this one. Need some standard for when to commit / when to do
    }
    doRef(ref)
  }

  const bloc = store.blox[blocId]
  const text = bloc.s
  const matches = text.matchAll(parseRegexJustLinks)
  // Roam allows like whatevs in the tags and attributes. I only allow a few select chars.

  let idx = 0
  let stackTop = undefined // s is string, t is type
  let stack = []

  for (let match of matches) {
    if (stack.length === 0 || stackTop.t === "cb") {
      if (match[1]) {
        const pageRefElement = { t: "pr", s: "" }
        stack.push(pageRefElement)
        stackTop = stack[stack.length - 1]
      } else if (match[3]) {
        doTitle(match[3])
      } else if (match[5]) {
        doTitle(match[5])
      } else if (match[4]) {
        if (store.blox[match[4]] !== undefined)
          doRef(match[4])
      } else if (match[7]) {
        if (stackTop && stackTop.t === "cb") {
          stack.pop()
        } else {
          const codeBlockElement = { t: 'cb', s: "" }
          stack.push(codeBlockElement)
          stackTop = stack[stack.length - 1]
        }
      }
    } else {
      stackTop.s = stackTop.s + text.substring(idx, match.index)
      idx = match.index
      if (match[1]) {
        const pageRefElement = { t: "pr", s: "" }
        stackTop.s = stackTop.s + "[["
        stack.push(pageRefElement)
        stackTop = stack[stack.length - 1]
      } else if (match[2]) {
        let s = "]]"
        if (stackTop.t === "pr") {
          s = stackTop.s + "]]"
          doTitle([stackTop.s])
          stack.pop()
          stackTop = stack[stack.length - 1]
        }
        if (stackTop !== undefined) stackTop.s = stackTop.s + s
      } else if (match[3]) {
        doTitle(match[3])
        stackTop.s = stackTop.s + match[0]
      } else if (match[5]) {
        stackTop.s = stackTop.s + match[0]
        doTitle(match[5])
      } else if (match[4]) {
        if (store.blox[match[4]] !== undefined)
          doRef(match[4])
        stackTop.s = stackTop.s + match[0]
      } else if (match[7]) {
        if (stackTop && stackTop.t === "cb") {
          stack.pop()
        } else {
          const codeBlockElement = { t: 'cb', s: "" }
          stack.push(codeBlockElement)
          stackTop = stack[stack.length - 1]
        }
      } else {
        stackTop.s = stackTop.s + match[0]
      }
    }
    idx = match.index + match[0].length
  }
  if (forwardRefs.length === 0) delete store.forwardRefs[blocId]
}

const generateRefs = (store) => {
  const stime = performance.now()
  store.refs = {}
  store.forwardRefs = {}
  for (let blocId in store.blox) {
    setLinks(store, blocId)
  }
  console.log(`gen refs took ${performance.now() - stime}`)
}

const mergeLists = (list1, list2) => {
  for (let x of list2) {
    if (!list1.includes(x)) list1.push(x)
  }
}

// destructured return here costs me like 3ms over 10_000 calls. unfortunate
const arrSetDiff = (cur, old) => {
  let added = []
  let deleted = []
  for (let ref of cur) {
    if (!old.includes(ref)) added.push(ref)
  }
  for (let oldRef of old) {
    if (!cur.includes(oldRef)) deleted.push(oldRef)
  }
  return { added, deleted }
}

// @INPROGRESS
const propagateRefs = (blocId, refs, oldRefs) => {
  const { added, deleted } = arrSetDiff(refs, oldRefs)
  const bloc = store.blox[blocId]
  if (bloc.p) {
    let p = bloc.p
    while (p) {
      const pbloc = store.blox[p]
      const prefs = store.forwardRefs[p]
      for (let i = 0; i < added.length; i++) { // warning i modified inside loop during deletions
        const adr = added[i]
        if (prefs.includes(adr)) {
          added[i] = added.pop()
          i -= 1
        } else {
          prefs.push(adr)
        }
      }
      p = pbloc.p
    }
  }
  let parent = bloc;
  do {
    parent = store.blox[parent.p]
    for (let i = 0; i < added.length; i++) {

    }
  } while (parent.p)

}

// inner refs are refs in a page/block and any pages/blocks within it
const generateInnerRefs = () => {
  // algorithm: for each ref anywhere, add it to each of its parent's uprefs
  const stime = performance.now()
  store.innerRefs = {}
  for (let blocId in store.forwardRefs) {
    const refs = store.forwardRefs[blocId]
    let id = blocId
    while (id) {
      if (!store.innerRefs[id]) store.innerRefs[id] = []
      mergeLists(store.innerRefs[id], refs)
      id = store.blox[id].p
    }
  }
  // console.log(`innerrefs took ${performance.now() - stime}`)
}

// outer refs are refs in a block / page and each block/page in its ancestry
const generateOuterRefs = () => {
  const stime = performance.now()
  store.outerRefs = {}
  for (let blocId in store.forwardRefs) {
    const refs = store.forwardRefs[blocId]
    const fn = (id) => {
      if (!store.outerRefs[id]) store.outerRefs[id] = []
      mergeLists(store.outerRefs[id], refs)
      for (let cid of store.blox[id].k || []) {
        fn(cid)
      }
    }
    fn(blocId)
  }
  // console.log(`outerrefs took ${performance.now() - stime}`)
}

const generateInnerOuterRefs = () => {
  generateInnerRefs()
  generateOuterRefs()
}

const mergeStore = (otherStore) => {
  // merge pages by title, adding all blocks to the end
  // if the new store has a block with the same id, give it a new id

  const idTranslation = {}

  for (let blocId in otherStore.blox) {
    const bloc = otherStore.blox[blocId]
    if (!store.titles[bloc.s]) {
      idTranslation[blocId] = store.titles[bloc.s]
    } else if (store.blox[blocId]) {
      idTranslation[blocId] = newUid()
    }
  }

  const transferBlock = (blockId, parentId) => {
    const newBlockId = idTranslation[blockId] || blockId
    const block = otherStore.blox[blockId]
    const newBlock = {
      ...block
    }
    store.blox[newBlockId] = newBlock
    newBlock.p = parentId
    if (block.k) {
      newBlock.k = []
      for (let childId of block.k) {
        let newChildId = idTranslation[childId] || childId
        transferBlock(childId, newBlockId)
        newBlock.k.push(newChildId)
      }
    }
  }

  for (let title in otherStore.titles) {
    const pageId = otherStore.titles[title]
    const page = otherStore.blox[pageId]
    if (store.titles[page.s] === undefined) {
      const newPageId = idTranslation(pageId) || pageId
      const newPage = {
        ...page
      }
      store.blox[newPageId] = newPage
      store.titles[page.s] = newPageId
      if (page.k) {
        newPage.k = []
        for (let blockId of kids) {
          const newBlockId = getNewId(blockId)
          transferBlock(blockId, newPageId)
          newPage.k.push(newBlockId)
        }
      }
    } else if (page.k) {
      const newPageId = store.titles[page.s]
      const existingPage = store.blox[newPageId]
      if (!existingPage.k) {
        existingPage.k = []
      }
      for (let childId of page.k) {
        const newChildId = idTranslation[childId] || childId
        transferBlock(childId, newPageId)
        existingPage.k.push(newChildId)
      }
    }
  }
}



// search

const escapeRegex = (string) => string.replaceAll(/([\[\]\(\)])/g, "\\$1").replaceAll("\\\\", "")

const newSearchRegex = (string) => new RegExp(escapeRegex(string), "i")

const searchRefCountWeight = 0.05
const pageOverBlockWeight = 1

let titleExactFullTextSearchCache = []
const titleExactFullTextSearch = (string) => {
  const regex = newSearchRegex(string)
  titleExactFullTextSearchCache = []
  for (let title in store.titles) {
    const id = store.titles[title]
    const page = store.blox[id]
    const match = title.match(regex)
    if (match) {
      titleExactFullTextSearchCache.push({
        title,
        id,
        idx: match.index - (store.refs[id] ? store.refs[id].length : 0) * searchRefCountWeight
      })
    }
  }
  titleExactFullTextSearchCache.sort((a, b) => a.idx - b.idx)
  return titleExactFullTextSearchCache
}

let exactFullTextSearchCache = []
const exactFullTextSearch = (string) => {
  const regex = newSearchRegex(string)
  exactFullTextSearchCache = []
  for (let id in store.blox) {
    const bloc = store.blox[id]
    const string = bloc.s
    const match = string.match(regex)
    if (match) {
      const matchObj = {
        id,
        idx: match.index - (store.refs[id] ? store.refs[id].length : 0) * searchRefCountWeight - (bloc.p === undefined) * pageOverBlockWeight
      }
      if (bloc.p) matchObj.string = bloc.s
      else matchObj.title = bloc.s
      exactFullTextSearchCache.push(matchObj)
    }
  }
  exactFullTextSearchCache.sort((a, b) => a.idx - b.idx)
  return exactFullTextSearchCache
}


let templateSearchCache = []
const searchTemplates = (string) => {
  const templatePageId = store.titles["roam/templates"]
  const templatePage = store.blox[templatePageId]
  templateSearchCache = []
  let searchRegex

  try {
    searchRegex = newSearchRegex(string)
  } catch {
    return templateSearchCache
  }

  if (templatePage) {
    const fn = (blockId) => {
      const block = store.blox[blockId]
      console.log(block.s)
      const match = block.s.match(searchRegex)
      console.log(match)
      if (match) {
        templateSearchCache.push({
          id: blockId,
          string: block.s,
          idx: match.idx
        })
      }
    }
    if (store.refs[templatePageId]) {
      for (let backref of store.refs[templatePageId])
        fn(backref)
    }
    if (store.blox[templatePageId].k) {
      for (let blockId of store.blox[templatePageId].k)
        fn(blockId)
    }
    console.log(templateSearchCache)
    templateSearchCache = templateSearchCache.sort((a, b) => b.idx - a.idx)
    console.log(templateSearchCache)

  }
  return templateSearchCache
}

const generateTitles = (store) => {
  store.titles = {}
  for (let id in store.blox) {
    const bloc = store.blox[id]
    if (bloc.p === undefined) store.titles[bloc.s] = id
  }
}

const hydrateFromBlox = (graphName, blox) => {
  console.log("hydratefromblox")
  let store = blankStore()
  store.blox = blox
  store.graphName = graphName
  generateTitles(store)
  generateRefs(store)
  return store
}

const sortByLastEdited = (arr) => {
  arr.sort((a, b) => {
    if (store.blox[a].et > store.blox[b].et) {
      return -1
    }
    return 1
  })
}

const createAndSwitchToNewStore = storeName => {
  store = blankStore()
  store.graphName = storeName
  user.s.graphName = storeName
  user.commitId = "MYVERYFIRSTCOMMITEVER"
  saveUser()
  saveStore()
}