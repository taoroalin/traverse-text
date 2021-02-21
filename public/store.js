const blankStore = () => ({
  graphName: "default",
  ownerRoamId: "default",
  blocks: {},
  pages: {},
  pagesByTitle: {}
})


const LOCAL_FILE_SIGNATURE = 0x04034b50

const zipToFiles = (buffer) => {
  const bufferU8 = new Uint8Array(buffer)
  const length = bufferU8.length
  let idx = 0
  const result = []
  while (idx < length) {
    // I have to copy header uint32s into new arrays because they might not be aligned :(
    const sigBuf = new ArrayBuffer(4)
    const sigInt8 = new Uint8Array(sigBuf)
    for (let i = 0; i < 4; i++) {
      sigInt8[i] = bufferU8[idx + i]
    }
    const sigInt = (new Uint32Array(sigBuf))[0]
    if (sigInt === LOCAL_FILE_SIGNATURE) {
      const compressionMethod = (new Uint16Array(buffer,8,1))[0]
      if (compressionMethod === 0) {

        const dumbArray = new ArrayBuffer(12)
        const dumbu8 = new Uint8Array(dumbArray)
        for (let i = 0; i < 12; i++) {
          dumbu8[i] = bufferU8[i + 18 + idx]
        }
        const dumbu32 = new Uint32Array(dumbArray)
        const compressedSize = dumbu32[0]
        const rawSize = dumbu32[1]
        const fileNameSize = dumbu32[2]

        const decoder = new TextDecoder()
        const fullName = decoder.decode(new Uint8Array(buffer,idx + 30,fileNameSize))
        const match = fullName.match(/\.([a-z]+)$/)
        const text = decoder.decode(new Uint8Array(buffer,idx + 30 + fileNameSize,rawSize))
        let ext,name
        if (match) {
          ext = match[1]
          name = fullName.substring(0,match.index)
        }
        result.push({ name,ext,text,fullName })
        idx += 30 + fileNameSize + rawSize

      } else {
        console.log(compressionMethod)
        alert("Micro Roam can't handle .zip files that are actually compressed. use a .json file or an uncompressed .zip file, like ones exported by Roam Research or Micro Roam")
        return
      }
    } else {
      console.log(`got signature ${sigInt}`)
      return result
    }
  }
  return result
}
/*

ZIP header
local file header signature     4 bytes 0  (0x04034b50)
version needed to extract       2 bytes 4
general purpose bit flag        2 bytes 6
compression method              2 bytes 8
last mod file time              2 bytes 10
last mod file date              2 bytes 12
crc-32                          4 bytes 14
compressed size                 4 bytes 18
uncompressed size               4 bytes 22
file name length                2 bytes 26
extra field length              2 bytes 28

*/

const roamJsonToStore = (graphName,text) => {
  const stime = performance.now()

  const obj = JSON.parse(text)

  const pages = {}
  const blocks = {}
  const pagesByTitle = {}

  let ownerRoamId = null
  // todo interface with roam user ids well
  if (obj[0][":edit/user"]) ownerRoamId = obj[0][":edit/user"][":user/uid"]

  const addBlock = (block,parent) => {
    blocks[block.uid] = block
    block.parent = parent

    // discard edit/user if it's the same as create/user to save space
    if (block[":create/user"] && block[":create/user"][":user/uid"] !== ownerRoamId)
      block[":create/user"] = block[":create/user"][":user/uid"]
    else delete block[":create/user"]
    if (block[":edit/user"] && block[":edit/user"][":user/uid"] !== ownerRoamId)
      block[":edit/user"] = block[":edit/user"][":user/uid"]
    else
      delete block[":edit/user"]

    if (block.children) {
      const children = block.children
      block.children = children.map(child => child.uid)
      children.forEach((child) => addBlock(child,block.uid))
    }
    if (block.refs)
      block.refs = block.refs.map(ref => ref.uid)
    if (block[":block/refs"])
      block[":block/refs"] = block[":block/refs"].map(ref => ref[":block/uid"])
    delete block.uid
    block.backRefs = []

    // Round points in drawings to nearest pixel to save 600K on my json
    if (block[":block/props"] && block[":block/props"][":drawing/lines"]) {
      for (let line of block[":block/props"][":drawing/lines"]) {
        line[":points"] = line[":points"].map(p => ([Math.round(p[0]),Math.round(p[1])]))
      }
    }
    if (block.props && block.props.lines) {
      for (let line of block.props.lines) {
        line.points = line.points.map(p => ([Math.round(p[0]),Math.round(p[1])]))
      }
    }
  }

  for (let page of obj) {
    pagesByTitle[page.title] = page.uid
    pages[page.uid] = page
    if (page[":create/user"] && page[":create/user"][":user/uid"] !== ownerRoamId)
      page[":create/user"] = page[":create/user"][":user/uid"]
    else delete page[":create/user"]
    if (page[":edit/user"] && page[":edit/user"][":user/uid"] !== ownerRoamId)
      page[":edit/user"] = page[":edit/user"][":user/uid"]
    else
      delete page[":edit/user"]

    if (page.children !== undefined) {
      const children = page.children
      page.children = []
      for (let child of children) {
        page.children.push(child.uid)
        addBlock(child,page.uid)
      }
    }
    delete page.uid
    page.backRefs = []
  }

  // add backrefs
  for (let blockUid in blocks) {
    const block = blocks[blockUid]

    if (block[":block/refs"]) {
      block[":block/refs"].forEach(ref => {
        if (blocks[ref] !== undefined) {
          blocks[ref].backRefs.push(blockUid)
        } else if (pages[ref] !== undefined) {
          pages[ref].backRefs.push(blockUid)
        } else {
          //throw new Error(`bad ref ${ref}`)
        }
      })
    }

  }

  // remove empty pages
  for (let pageId in pages) {
    const page = pages[pageId]
    if ((!page.children || page.children.length === 0) && page.backRefs.length === 0) {
      delete pagesByTitle[page.title]
      delete pages[pageId]
    }
  }

  const store = { graphName,pages,blocks,pagesByTitle,ownerRoamId }
  console.log(`roamJsonToStore took ${performance.now() - stime}`)
  console.log(store)

  return store
}


/*

Here's what's lost importing Markdown that's saved in JSON:
block author
block create time
block end time
block references get confused with quotes - referencing a block just looks like it's text in quotes, "Block Refs". Micro Roam treats all quotes that could be block refs as block refs, which accidentally creates too many block refs
blocks with line breaks in them can split into two blocks

*/

const mdToStore = (files) => { // files: [{name, ext, fullName, text}]

  const now = Date.now()

  const oldStore = store

  const blockStringIndex = {}

  store = blankStore()

  const getPageId = (title) => pagesByTitle[title] || newUid()


  for (let file of files) {
    const title = file.name
    const text = file.text
    const pageId = getPageId(title)
    const page = { "create-time": now,title: title }
    store.pages[pageId] = page
    store.pagesByTitle[title] = pageId
    if (text.length > 0) {
      page.children = []

      const addBlock = (string) => {
        const blockId = newUid()
        blockStringIndex[string] = blockId // overwrite previous string when multiple have the same :(
        const block = { "create-time": now,string }
        store.blocks[blockId] = block
        page.children.push(blockId)
      }

      const stack = [page]
      const blockBreaks = text.matchAll(/\n((?:    )*)- /g)
      let idx = 2 // skip first block break, "- "

      for (let blockBreak of blockBreaks) {
        addBlock(text.substring(idx,blockBreak.index))
        idx = blockBreak.index + blockBreak[0].length
      }
      addBlock(text.substring(idx))
    }
  }

  console.log(store)

  for (let blockId of store.blocks) {
    const block = store.blocks[blockId]
    const { pageRefs,quotes } = parseMdBlock(block.string)
  }
  const { pageRefs,quotes } = parseMdBlock(blockText)
}

const parseMdBlock = (text) => {

}
/*
block refs ger replaced with "referenced block text". in order to recover these I have to search for a block with that text

if you have
'
text
- text
'
as a block, it will look like 2 blocks in markdown
*/

const mergeStore = (otherStore) => {
  // merge pages by title, adding all blocks to the end
  // if the new store has a block with the same id, give it a new id

  const idTranslation = {}

  const getNewId = (id) => {
    if (store.blocks[id] !== undefined || store.pages[id] !== undefined)
      return idTranslation[id] || newUid()
    return id
  }

  for (let blockId in otherStore.blocks) {
    getNewId(blockId)
  }

  for (let pageId in otherStore.pages) {
    getNewId(pageId)
  }


  const transferBlock = (blockId,newBlockId,parentId) => {
    const block = otherStore.blocks[blockId]
    const newBlock = { ...block }
    store.blocks[newBlockId] = newBlock
    block.parent = parentId
    if (block.children) {
      newBlock.children = []
      for (let childId of block.children) {
        let newChildId = getNewId(childId)
        transferBlock(childId,newChildId,newBlockId)
        newBlock.children.push(newChildId)
      }
    }
    for (let listName of ["refs",":block/refs","backRefs"]) {
      let list = block[listName]
      if (list) {
        newBlock[listName] = list.map(getNewId)
      }
    }
  }

  for (let pageId in otherStore.pages) {
    let page = otherStore.pages[pageId]
    const existingPageId = store.pagesByTitle[page.title]
    if (existingPageId === undefined) {
      const newPageId = getNewId(pageId)
      const newPage = { ...page }
      store.pages[newPageId] = newPage
      store.pagesByTitle[page.title] = newPageId
      if (page.children) {
        newPage.children = []
        for (let blockId of page.children) {
          const newBlockId = getNewId(blockId)
          transferBlock(blockId,newBlockId,pageId)
          newPage.children.push(newBlockId)
        }
      }

      for (let listName of ["refs",":block/refs","backRefs"]) {
        let list = page[listName]
        if (list) {
          newPage[listName] = list.map(getNewId)
        }
      }

    } else {
      const existingPage = store.pages[existingPageId]
      if (page.children) {
        if (existingPage.children === undefined) existingPage.children = []
        for (let childId of page.children) {
          const newChildId = getNewId(childId)
          transferBlock(childId,newChildId,existingPageId)
          existingPage.children.push(newChildId)
        }
      }
      for (let listName of ["refs",":block/refs","backRefs"]) {
        if (page[listName]) {
          if (existingPage[listName] === undefined) existingPage[listName] = []
          for (let name of page[listName]) {
            existingPage[listName].push(getNewId(name))
          }
        }
      }
    }
  }

}

// gc for when I leak data by accident
const gcBlocks = () => {
  for (let blockId of Array.from(store.blocks)) {
    const block = store.blocks[blockId]
    if (store.pages[block.parent] === undefined && store.blocks[block.parent] === undefined) {
      delete store.blocks[blockId]
    }
  }
}



// search

const escapeRegex = (string) => {
  return string.replaceAll(/(?<=^|[^`])([\[\]\(\)])/g,"\\$1").replaceAll("`","")
}

const searchRefCountWeight = 0.05

const titleExactFullTextSearch = (string) => {
  const regex = new RegExp(escapeRegex(string),"i")
  const results = []
  for (let id in store.pages) {
    const page = store.pages[id]
    const title = page.title
    const match = title.match(regex)
    if (match) {
      results.push({ title,id,idx: match.index - page.backRefs.length * searchRefCountWeight })
    }
  }
  results.sort((a,b) => a.idx - b.idx)
  return results.slice(0,10)
}

const exactFullTextSearch = (string) => {
  const regex = new RegExp(escapeRegex(string),"i")
  const results = []
  for (let id in store.pages) {
    const page = store.pages[id]
    const title = page.title
    const match = title.match(regex)
    if (match) results.push({ title,id,idx: match.index - page.backRefs.length * searchRefCountWeight })
  }
  for (let blockUid in store.blocks) {
    const block = store.blocks[blockUid]
    const match = block.string.match(regex)
    // weight blocks 1 lower than titles 
    if (match) results.push({ string: block.string,id: blockUid,idx: match.index + 1 - block.backRefs.length * searchRefCountWeight })
  }
  return results.sort((a,b) => a.idx - b.idx).slice(0,10)
}


