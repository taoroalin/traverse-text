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
  "i",  // child idx
  "ct", // create time
  "et", // edit time
  "cu", // create user
  "eu"  // edit user
]

const roamBloxProps = {
  children: "k",
  string: "s",
  title: "s",
  "create-time": "ct",
  "edit-time": "et",
  ":create/user": "cu",
  ":edit/user": "eu",
  "uid": "uid",
  "refs": "",
  ":block/refs": "",
}

const roamJsonToStore = (graphName,text) => {
  console.log("roamJsontostore")
  const stime = performance.now()
  const now = Date.now()

  const obj = JSON.parse(text)

  store = blankStore()
  store.graphName = graphName

  // todo interface with roam user ids well
  if (obj[0][":edit/user"]) store.ownerRoamId = obj[0][":edit/user"][":user/uid"]
  ownerRoamId = store.ownerRoamId

  const addBlock = (block,parent) => {
    const newBlock = {
      s: block.string,
      p: parent,
      ct: now,
    }
    store.blox[block.uid] = newBlock

    // discard edit/user if it's the same as create/user to save space
    if (block[":create/user"] && block[":create/user"][":user/uid"] !== ownerRoamId)
      newBlock.cu = block[":create/user"][":user/uid"]
    else delete newBlock.cu
    if (block[":edit/user"] && block[":edit/user"][":user/uid"] !== ownerRoamId)
      newBlock.eu = block[":edit/user"][":user/uid"]
    else delete newBlock.eu

    if (block.children) {
      newBlock.k = block.children.map(child => child.uid)
      block.children.forEach((child) => addBlock(child,block.uid))
    }
    for (let prop in block) {
      if (prop in roamBloxProps) { } else {
        if (!store.roamProps[block.uid]) store.roamProps[block.uid] = {}
        store.roamProps[block.uid][prop] = block[prop]
      }
    }
  }

  for (let page of obj) {
    store.titles[page.title] = page.uid
    const newPage = {
      s: page.title,
      ct: now,
    }
    store.blox[page.uid] = newPage

    for (let prop in page) {
      if (prop in roamBloxProps) { } else {
        if (!store.roamProps[page.uid]) store.roamProps[page.uid] = {}
        store.roamProps[page.uid][prop] = page[prop]
      }
    }

    if (page[":create/user"] && page[":create/user"][":user/uid"] !== ownerRoamId)
      newPage.cu = page[":create/user"][":user/uid"]
    else {
      delete newPage.cu
    }
    if (page[":edit/user"] && page[":edit/user"][":user/uid"] !== ownerRoamId) {
      newPage.eu = page[":edit/user"][":user/uid"]
    } else {
      delete newPage.eu
    }

    if (page.children !== undefined) {
      const kids = []
      newPage.k = kids
      for (let i = 0; i < page.children.length; i++) {
        const child = page.children[i]
        kids.push(child.uid)
        addBlock(child,page.uid)
      }
    }
  }

  generateRefs()
  store.lastCommitId = "MYVERYFIRSTCOMMITEVER"
  user.settings.lastCommitId = store.lastCommitId

  console.log(`roamJsonToStore took ${performance.now() - stime}`)
  console.log(store)

  return store
}

// 1             2              3   4         5         6       7
// page-ref-open page-ref-close tag block-ref attribute literal code-block
const parseRegexJustLinks = /(\[\[)|(\]\])|#([\/a-zA-Z0-9_-]+)|\(\(([a-zA-Z0-9\-_]+)\)\)|(^[\/a-zA-Z0-9_-]+)::|`([^`]+)`|```/g

const generateRefs = () => {
  const stime = performance.now()
  store.refs = {}
  store.forwardRefs = {}
  for (let blocId in store.blox) {
    const bloc = store.blox[blocId]
    const text = bloc.s
    const doRef = (ref) => {
      if (ref in store.refs) store.refs[ref].push(blocId)
      else store.refs[ref] = [blocId]
      if (blocId in store.forwardRefs) store.forwardRefs[blocId].push(ref)
      else store.forwardRefs[blocId] = [ref]
    }
    const matches = text.matchAll(parseRegexJustLinks)
    // Roam allows like whatevs in the tags and attributes. I only allow a few select chars.

    let idx = 0
    let stackTop = undefined // s is string, t is type
    let stack = []

    for (let match of matches) {
      if (stack.length === 0 || stackTop.t === "cb") {
        if (match[1]) {
          const pageRefElement = { t: "pr",s: "" }
          stack.push(pageRefElement)
          stackTop = stack[stack.length - 1]
        } else if (match[3]) {
          const ref = store.titles[match[3]]
          if (ref) doRef(ref)
        } else if (match[5]) {
          const ref = store.titles[match[5]]
          if (ref) doRef(ref)
        } else if (match[4]) {
          doRef(match[4])
        } else if (match[7]) {
          if (stackTop && stackTop.t === "cb") {
            stack.pop()
          } else {
            const codeBlockElement = { t: 'cb',s: "" }
            stack.push(codeBlockElement)
            stackTop = stack[stack.length - 1]
          }
        }
      } else {
        stackTop.s = stackTop.s + text.substring(idx,match.index)
        idx = match.index
        if (match[1]) {
          const pageRefElement = { t: "pr",s: "" }
          stackTop.s = stackTop.s + "[["
          stack.push(pageRefElement)
          stackTop = stack[stack.length - 1]
        } else if (match[2]) {
          let s = "]]"
          if (stackTop.t === "pr") {
            s = stackTop.s + "]]"
            const ref = store.titles[stackTop.s]
            if (ref) doRef(ref)
            stack.pop()
            stackTop = stack[stack.length - 1]
          }
          if (stackTop !== undefined) stackTop.s = stackTop.s + s
        } else if (match[3]) {
          const ref = store.titles[match[3]]
          if (ref) doRef(ref)
          stackTop.s = stackTop.s + match[0]
        } else if (match[5]) {
          stackTop.s = stackTop.s + match[0]
          const ref = store.titles[match[5]]
          if (ref) doRef(ref)
        } else if (match[4]) {
          doRef(match[4])
          stackTop.s = stackTop.s + match[0]
        } else if (match[7]) {
          if (stackTop && stackTop.t === "cb") {
            stack.pop()
          } else {
            const codeBlockElement = { t: 'cb',s: "" }
            stack.push(codeBlockElement)
            stackTop = stack[stack.length - 1]
          }
        } else {
          stackTop.s = stackTop.s + match[0]
        }
      }
      idx = match.index + match[0].length
    }
  }
  console.log(`gen refs took ${performance.now() - stime}`)
  return store
}

const mergeLists = (list1,list2) => {
  for (let x of list2) {
    if (!list1.includes(x)) list1.push(x)
  }
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
      mergeLists(store.innerRefs[id],refs)
      id = store.blox[id].p
    }
  }
  console.log(`innerrefs took ${performance.now() - stime}`)
}

// outer refs are refs in a block / page and each block/page in its ancestry
const generateOuterRefs = () => {
  const stime = performance.now()
  store.outerRefs = {}
  for (let blocId in store.forwardRefs) {
    const refs = store.forwardRefs[blocId]
    const fn = (id) => {
      if (!store.outerRefs[id]) store.outerRefs[id] = []
      mergeLists(store.outerRefs[id],refs)
      for (let cid of store.blox[id].k || []) {
        fn(cid)
      }
    }
    fn(blocId)
  }
  console.log(`outerrefs took ${performance.now() - stime}`)
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

  const transferBlock = (blockId,parentId) => {
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
        transferBlock(childId,newBlockId)
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
          transferBlock(blockId,newPageId)
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
        transferBlock(childId,newPageId)
        existingPage.k.push(newChildId)
      }
    }
  }
}



// search

const escapeRegex = (string) => string.replaceAll(/([\[\]\(\)])/g,"\\$1").replaceAll("\\\\","")

const searchRefCountWeight = 0.05
const pageOverBlockWeight = 1

let titleExactFullTextSearchCache = []
const titleExactFullTextSearch = (string) => {
  const regex = new RegExp(escapeRegex(string),"i")
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
  titleExactFullTextSearchCache.sort((a,b) => a.idx - b.idx)
  return titleExactFullTextSearchCache
}

let exactFullTextSearchCache = []
const exactFullTextSearch = (string) => {
  const regex = new RegExp(escapeRegex(string),"i")
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
  exactFullTextSearchCache.sort((a,b) => a.idx - b.idx)
  return exactFullTextSearchCache
}


let templateSearchCache = []
const searchTemplates = (string) => {
  const templatePageId = store.titles["roam/templates"]
  const templatePage = store.blox[templatePageId]
  templateSearchCache = []
  if (templatePage) {
    const fn = (blockId) => {
      const block = store.blox[blockId]
      console.log(block.s)
      const match = block.s.match(/^([^ \r\n]+)/)
      console.log(match)
      if (match) {
        if (match[1].length >= string.length && match[1].substring(0,string.length).toLowerCase() === string.toLowerCase()) {
          templateSearchCache.push({
            id: blockId,
            string: match[1]
          })
        }
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
  }
  return templateSearchCache
}


const hydrateFromBlox = (graphName,blox) => {
  store = blankStore()
  store.blox = blox
  store.graphName = graphName
  for (let id in blox) {
    const bloc = blox[id]
    if (bloc.p === undefined) store.titles[bloc.s] = id
  }
  generateRefs()
}

const storeToRoamJSON = (store) => {
  const roamJSON = []

  const blockIdToJSON = (blockId) => {
    const block = store.blox[blockId]
    const result = { uid: blockId,string: block.s,"create-time": block.ct,"edit-time": block.et }
    const roamProps = store.roamProps[blockId]
    if (roamProps) Object.assign(result,roamProps)

    if (block.k) result.children = block.k.map(blockIdToJSON)

    result[":create/user"] = { ":user/uid": store.ownerRoamId }
    result[":edit/user"] = { ":user/uid": store.ownerRoamId }
    if (block.cu)
      result[":create/user"] = { ":user/uid": block.cu }
    if (block.eu)
      result[":edit/user"] = { ":user/uid": block.eu }

    return result
  }

  for (let title in store.titles) {
    const pageId = store.titles[title]
    const page = store.blox[pageId]
    const roamProps = store.roamProps[pageId]
    const jsonPage = { uid: pageId,title: page.s,"edit-time": page.et,"create-time": page.ct }
    roamJSON.push(jsonPage)
    Object.assign(jsonPage,roamProps)
    if (page.k) {
      jsonPage.children = page.k.map(blockIdToJSON)
    }
    jsonPage[":create/user"] = { ":user/uid": store.ownerRoamId }
    jsonPage[":edit/user"] = { ":user/uid": store.ownerRoamId }
    if (page[":create/user"])
      jsonPage[":create/user"] = { ":user/uid": page[":create/user"] }
    if (page[":edit/user"])
      jsonPage[":edit/user"] = { ":user/uid": page[":edit/user"] }
  }
  console.log(roamJSON)

  return JSON.stringify(roamJSON)
}

const oldStoreToRoamJSON = {
  4: (store) => {
    const roamJSON = []

    const blockIdToJSON = (blockId) => {
      const result = { uid: blockId }
      const block = store.blocks[blockId]
      Object.assign(result,block)

      if (block.children) result.children = block.children.map(blockIdToJSON)

      result[":create/user"] = { ":user/uid": store.ownerRoamId }
      result[":edit/user"] = { ":user/uid": store.ownerRoamId }
      if (block[":create/user"])
        result[":create/user"] = { ":user/uid": block[":create/user"] }
      if (block[":edit/user"])
        result[":edit/user"] = { ":user/uid": block[":edit/user"] }

      if (block.refs) result.refs = block.refs.map(x => ({ uid: x }))
      if (block[":block/refs"]) result[":block/refs"] = block[":block/refs"].map(x => ({ ":block/uid": x }))

      delete result.backRefs
      delete result.parent
      return result
    }

    for (let pageId in store.pages) {
      const page = store.pages[pageId]
      const jsonPage = { uid: pageId }
      roamJSON.push(jsonPage)
      Object.assign(jsonPage,page)
      delete jsonPage.backRefs
      if (page.children) {
        jsonPage.children = page.children.map(blockIdToJSON)
      }
      jsonPage[":create/user"] = { ":user/uid": store.ownerRoamId }
      jsonPage[":edit/user"] = { ":user/uid": store.ownerRoamId }
      if (page[":create/user"])
        jsonPage[":create/user"] = { ":user/uid": page[":create/user"] }
      if (page[":edit/user"])
        jsonPage[":edit/user"] = { ":user/uid": page[":edit/user"] }
    }
    console.log(roamJSON)

    return JSON.stringify(roamJSON)
  }
}