const roamJsonToStore = (graphName,text) => {
  const stime = performance.now()

  const obj = JSON.parse(text)

  const pages = {}
  const blocks = {}
  const pagesByTitle = {}

  const addBlock = (block,parent) => {
    blocks[block.uid] = block
    block.parent = parent
    if (block[":create/user"])
      block[":create/user"] = block[":create/user"][":user/uid"]
    if (block[":edit/user"])
      block[":edit/user"] = block[":edit/user"][":user/uid"]
    if (block[":create/user"] === block[":edit/user"])
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
  }

  for (let page of obj) {
    pagesByTitle[page.title] = page.uid
    pages[page.uid] = page
    if (page[":create/user"])
      page[":create/user"] = page[":create/user"][":user/uid"]
    if (page[":edit/user"])
      page[":edit/user"] = page[":edit/user"][":user/uid"]
    if (page[":create/user"] === page[":edit/user"])
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

  for (let blockUid in blocks) {
    const block = blocks[blockUid]
    if (block.refs) {
      block.refs.forEach(ref => {
        if (blocks[ref] !== undefined) {
          blocks[ref].backRefs.push(blockUid)
        } else if (pages[ref] !== undefined) {
          pages[ref].backRefs.push(blockUid)
        } else {
          throw new Error(`bad ref ${ref}`)
        }
      })
    }
    if (block[":block/refs"]) {
      block[":block/refs"].forEach(ref => {
        if (blocks[ref] !== undefined) {
          blocks[ref].backRefs.push(blockUid)
        } else if (pages[ref] !== undefined) {
          pages[ref].backRefs.push(blockUid)
        } else {
          throw new Error(`bad ref ${ref}`)
        }
      })
    }
  }

  const store = { graphName,pages,blocks,pagesByTitle }
  console.log(`roamJsonToStore took ${performance.now() - stime}`)
  console.log(store)
  // console.log(JSON.stringify(store))

  return store
}

const storeToRoamJSON = (store) => {
  const roamJSON = []
  for (let pageId in store) {

  }
}

const titleExactFullTextSearch = (string) => {
  const regex = new RegExp(string,"i")
  const results = []
  for (let title in store.pagesByTitle) {
    const id = store.pagesByTitle[title]
    if (regex.test({ title,id })) {
      results.push({ title,id })
      if (results.length >= 10)
        return results
    }
  }
  return results
}

const exactFullTextSearch = (string) => {
  const regex = new RegExp(string,"i")
  const results = []
  for (let title in store.pagesByTitle) {
    const id = store.pagesByTitle[title]
    if (regex.test(title)) results.push({ title: title,id })
  }
  for (let blockUid in store.blocks) {
    const block = store.blocks[blockUid]
    if (regex.test(block.string)) results.push({ string: block.string,id: blockUid })
  }
  return results
}
