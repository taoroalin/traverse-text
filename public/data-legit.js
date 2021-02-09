const roamJsonToStore = (text) => {
  const stime = performance.now()

  const obj = JSON.parse(text)

  const pages = {}
  const blocks = {}
  const pagesByTitle = {}

  const addBlock = (block) => {
    blocks[block.uid] = block
    if (block[":create/user"])
      block[":create/user"] = block[":create/user"][":user/uid"]
    if (block[":edit/user"])
      block[":edit/user"] = block[":edit/user"][":user/uid"]
    if (block[":create/user"] === block[":edit/user"])
      delete block[":edit/user"]

    if (block.children) {
      const children = block.children
      block.children = children.map(child => child.uid)
      children.forEach(addBlock)
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
        addBlock(child)
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

  const store = { pages,blocks,pagesByTitle }
  console.log(`roamJsonToStore took ${performance.now() - stime}`)
  console.log(store)
  console.log(JSON.stringify(store))

  return store
}