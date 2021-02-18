const blankStore = () => ({
  graphName: "default",
  ownerRoamId: "default",
  blocks: {},
  pages: {},
  pagesByTitle: {}
})

const roamJsonToStore = (graphName,text) => {
  const stime = performance.now()

  const obj = JSON.parse(text)

  const pages = {}
  const blocks = {}
  const pagesByTitle = {}

  let ownerRoamId = null
  if (obj[0][":edit/user"]) ownerRoamId = obj[0][":edit/user"][":user/uid"] // todo interface with roam user ids well

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

    // if (block.refs) {
    //   block.refs.forEach(ref => {
    //     if (blocks[ref] !== undefined) {
    //       blocks[ref].backRefs.push(blockUid)
    //     } else if (pages[ref] !== undefined) {
    //       pages[ref].backRefs.push(blockUid)
    //     } else {
    //       //throw new Error(`bad ref ${ref}`)
    //     }
    //   })
    // }

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
  // console.log(JSON.stringify(store))

  return store
}

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
  console.log(results)
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

