/*
const storeSchema = {blox:{uid:{kids:[uid],string,parent,ct,edit-time,create-user,edit-user}},
titles:{title:uid},
*/

// blox or bloc means either block or page. they're almost the same, just one has a parent and the other doesn't, and linking syntax is different
const blankStore = () => ({
  blox: {},
  refs: {},
  titles: {},
  roamProps: {},
  ownerRoamId: undefined,
  graphName: undefined
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

  store = generateRefs()

  console.log(`roamJsonToStore took ${performance.now() - stime}`)
  console.log(store)

  return store
}


const generateRefs = () => {
  const stime = performance.now()
  store.refs = {}
  for (let blocId in store.blox) {
    const bloc = store.blox[blocId]
    if (bloc.p) {
      const frag = document.createDocumentFragment()
      const pageTitles = renderBlockBody(frag,bloc.s)
      if (pageTitles.length > 0) {
        for (let pageTitle of pageTitles) {
          const pageId = store.titles[pageTitle]
          if (pageId) {
            if (!store.refs[pageId]) store.refs[pageId] = []
            store.refs[pageId].push(blocId)
          } else {
            console.log(`no page ${pageTitle}`)
          }
        }
      }
    } else {
      store.titles[bloc.s] = blocId
    }
  }
  console.log(`gen refs took ${performance.now() - stime}`)
  return store
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

// inner refs are refs in a page/block and any pages/blocks within it
const generateInnerRefs = () => {
  // algorithm: for each ref anywhere, add it to each of its parent's uprefs
  for (let blocId in store.refs) {
    const refs = store.refs[blocId]

  }
}

// outer refs are refs in a block / page and each block/page in its ancestry
const generateOuterRefs = () => {

}


// search

const escapeRegex = (string) => string.replaceAll(/([\[\]\(\)])/g,"\\$1").replaceAll("\\\\","")

const searchRefCountWeight = 0.05

const titleExactFullTextSearch = (string) => {
  const regex = new RegExp(escapeRegex(string),"i")
  const results = []
  for (let title in store.titles) {
    const id = store.titles[title]
    const page = store.blox[id]
    const match = title.match(regex)
    if (match) {
      results.push({
        title,
        id,
        idx: match.index - (store.refs[id] && store.refs[id].length) * searchRefCountWeight
      })
    }
  }
  results.sort((a,b) => a.idx - b.idx)
  return results.slice(0,10)
}

const exactFullTextSearch = (string) => {
  const regex = new RegExp(escapeRegex(string),"i")
  const results = []
  for (let id in store.blox) {
    const bloc = store.blox[id]
    const string = bloc.s
    const match = string.match(regex)
    if (match) {
      const matchObj = {
        id,
        idx: match.index - (store.refs[id] && store.refs[id].length) * searchRefCountWeight - (bloc.p === undefined)
      }
      if (bloc.p) matchObj.string = bloc.s
      else matchObj.title = bloc.s
      results.push(matchObj)
    }
  }
  return results.sort((a,b) => a.idx - b.idx).slice(0,10)
}

const searchTemplates = (string) => {
  const templatePageId = store.titles["roam/templates"]
  const templatePage = store.blox[templatePageId]
  const result = []
  if (templatePage) {
    const fn = (blockId) => {
      const block = store.blox[blockId]
      console.log(block.s)
      const match = block.s.match(/^([^ \r\n]+)/)
      console.log(match)
      if (match) {
        if (match[1].length >= string.length && match[1].substring(0,string.length).toLowerCase() === string.toLowerCase()) {
          result.push({
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
  return result
}

const storeToBinary = () => {
  const stime = performance.now()
  const encoder = new TextEncoder()

  const {
    keys,
    values
  } = storeToFlat(store)
  let numBytes = 4 // num keys as int
  let keyValueEndIdxs = []
  for (let i = 0; i < keys.length; i++) {
    const keyLen = encoder.encode(keys[i]).length
    const valLen = encoder.encode(values[i]).length
    numBytes += keyLen + valLen + 8 // int to store key end, int to store value end
    keyValueEndIdxs.push(keyLen,valLen)
  }

  const messageBuffer = new ArrayBuffer(numBytes)
  const messageChars = new Uint8Array(messageBuffer)
  const messageInts = new Uint32Array(messageBuffer,0,keyValueEndIdxs.length + 10)

  messageInts[0] = Math.floor(keyValueEndIdxs.length / 2)
  for (let i = 0; i < keyValueEndIdxs.length; i++) {
    messageInts[i + 1] = keyValueEndIdxs[i]
  }

  let idx = 4 + keyValueEndIdxs.length * 4
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    const v = values[i]
    const klen = keyValueEndIdxs[i * 2]
    const vlen = keyValueEndIdxs[i * 2 + 1]

    encoder.encodeInto(k,messageChars.subarray(idx))
    idx += klen
    encoder.encodeInto(v,messageChars.subarray(idx))
    idx += vlen
  }
  console.log(`store to binary took ${performance.now() - stime}`)
  return messageBuffer
}