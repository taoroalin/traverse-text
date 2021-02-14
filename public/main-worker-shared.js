const blockOrPageFromId = (id) => {
  return store.blocks[id] || store.pages[id]
}

const insertBlock = (blockId,newParentId,idx) => {
  const block = store.blocks[blockId]
  block.parent = newParentId
  const newParent = blockOrPageFromId(newParentId)
  newParent.children = newParent.children || []
  const newParentOldChildren = newParent.children
  if (idx !== undefined) {
    newParent.children = newParentOldChildren.slice(0,idx)
    newParent.children.push(blockId)
    newParent.children.push(...newParentOldChildren.slice(idx))
  } else {
    newParent.children.push(blockId)
  }
  // todo make this not duplicate refs
  const curRefs = store.blocks[blockId].refs
  if (curRefs) store.blocks[blockId].refs = curRefs.map(x => x) // make sure to copy because these are mutable!!!!
}

// Commands
// this is real const, don't edit in runtime
const commands = {
  deleteBlock: (blockId) => {
    const block = store.blocks[blockId]
    const backRefs = block.backRefs
    for (let ref in backRefs) {
      if (store.blocks[ref].refs)
        store.blocks[ref].refs = store.blocks[ref].refs.filter(x => x !== blockId)
      if (store.blocks[ref][":block/refs"])
        store.blocks[ref][":block/refs"] = store.blocks[ref][":block/refs"].filter(x => x !== blockId)
    }
    const parentBlock = store.blocks[block.parent]
    if (parentBlock) {
      parentBlock.children = parentBlock.children.filter(x => x !== blockId)
    }
    const parentPage = store.pages[block.parent]
    if (parentPage) {
      parentPage.children = parentPage.children.filter(x => x !== blockId)
    }
    delete store.blocks[blockId]
  },

  moveBlock: (blockId,newParentId,idx) => {
    const block = store.blocks[blockId]
    const parent = blockOrPageFromId(block.parent)
    parent.children = parent.children.filter(x => x != blockId)
    insertBlock(blockId,newParentId,idx)
  },

  // writeBlock takes link title list to avoid recomputation. couples this with renderBlockBody
  writeBlock: (blockId,string,refTitles) => {
    console.log(refTitles)

    const block = store.blocks[blockId]
    block.string = string

    const oldRefs = block[":block/refs"]
    if (oldRefs) {
      for (let ref of oldRefs) {
        blockOrPageFromId(ref).backRefs = blockOrPageFromId(ref).backRefs.filter(x => x !== blockId)
      }
    }

    block[":block/refs"] = []
    for (let title of refTitles) {
      console.log(`title ${title}`)
      let pageId = store.pagesByTitle[title]
      if (pageId === undefined) {
        // need to save this generated ID into command for worker / server
        pageId = newUid()
        commands.createPage(pageId,title)
      }
      block[":block/refs"].push(pageId)
      store.pages[pageId].backRefs.push(blockId)
      console.log("page")
      console.log(store.pages[pageId])
    }
  },

  // gonna add more fields later
  // the new id is in the change so it can be serialized deterministically
  createBlock: (blockId,parentId,idx) => {
    // todo make date guaranteed same between main and worker thread
    store.blocks[blockId] = { string: "",parent: parentId,":create/time": Date.now(),children: [],backRefs: [] }
    insertBlock(blockId,parentId,idx)
  },

  createPage: (pageId,pageTitle) => {
    store.pages[pageId] = { title: pageTitle,children: [],":create/time": Date.now(),backRefs: [] }
    store.pagesByTitle[pageTitle] = pageId
  }
}

const runCommand = (...command) => {
  saveWorker.postMessage(["command",command])
  commands[command[0]](...command.slice(1))
}

const print = (text) => {
  if (user.logging) {
    console.log(text)
  }
}