const blockOrPageFromId = (id) => {
  return store.blocks[id] || store.pages[id]
}

const insertBlock = (blockId,newParentId,idx) => {
  const block = store.blocks[blockId]
  block.parent = newParentId
  const newParent = blockOrPageFromId(newParentId)
  console.log(newParent)
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
    const backRefs = store.blocks[blockId].backRefs
    for (let ref in backRefs) {
      if (store.blocks[ref].refs)
        store.blocks[ref].refs = store.blocks[ref].refs.filter(x => x !== blockId)
      if (store.blocks[ref][":block/refs"])
        store.blocks[ref][":block/refs"] = store.blocks[ref][":block/refs"].filter(x => x !== blockId)
    }
    if (store.blocks[blockId].parent.children) {
      store.blocks[blockId].parent.children = store.blocks[blockId].parent.children.filter(x => x !== blockId)
    }
    delete store.blocks[blockId]
  },

  moveBlock: (blockId,newParentId,idx) => {
    const block = store.blocks[blockId]
    const parent = blockOrPageFromId(block.parent)
    parent.children = parent.children.filter(x => x != blockId)
    insertBlock(blockId,newParentId,idx)
  },

  writeBlock: (blockId,string) => {
    store.blocks[blockId].string = string
  },

  // gonna add more fields later
  // the new id is in the change so it can be serialized deterministically
  createBlock: (blockId,parentId,idx) => {
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