// idk whether this is "random enough"
// it is highly performance inneficient but i don't need to call this many times
const chars64 = "-_0123456789abcdefghijklmnopqrstuvwxyzABCDEFJHIJKLMNOPQRSTUVWXYZ"
const newUid = () => {
  let result
  do {
    result = ""
    for (let i = 0; i < 9; i++) {
      result += chars64[Math.floor(Math.random() * 64)]
    }
  } while (store.pages[result] !== undefined || store.blocks[result] !== undefined)
  return result
}

const blockOrPageFromId = (id) => {
  return store.blocks[id] || store.pages[id]
}

const parentThingey = (id) => store.pages[id] ? "pages" : "blocks"

// Commands
// this is real const, don't edit in runtime
const commands = {
  deleteBlock: (blockId) => {
    const block = store.blocks[blockId]
    const parentId = block.parent
    const refs = block[":block/refs"]
    const backRefs = block.backRefs
    // todo make legit ref tracking on deleteBlock
    const edits = {
      subtract: [[parentThingey(block.parent),parentId,"children",blockId],
      ...refs.map(ref => ([parentThingey(ref),ref,"backRefs",blockId])),
      ...backRefs.map(backRef => ([parentThingey(backRef),backRef,"refs",blockId]))],
      delete: [["blocks",blockId]]
    }

    return { edits }
  },

  moveBlock: (blockId,parentId,idx,time) => {
    const oldParent = store.blocks[blockId].parent
    const edits = {
      write: [["blocks",blockId,"parent",parentId]],
      insert: [[parentThingey(parentId),parentId,"children",blockId,idx]],
      subtract: [[parentThingey(oldParent),oldParent,"children",blockId]]
    }
    return { edits,returns: undefined }
  },

  // writeBlock takes link title list to avoid recomputation. couples this with renderBlockBody
  writeBlock: (blockId,string,refTitles,time) => {
    /**
     * This does a lot. It
     * 
     * writes string
     * writes :edit/time
     * writes :block/refs
     * writes corresponding backRefs
     * removes old backRefs
     * 
     */

    const block = store.blocks[blockId]
    const oldRefs = block[":block/refs"]

    const edits = {
      write: [],
      subtract: [],
      add: [],
      delete: []
    }

    // add refs
    const newRefs = refTitles.map(title => {
      let pageId = store.pagesByTitle[title]
      if (pageId !== undefined) {
        if (!oldRefs.includes(pageId)) {
          edits.add.push(["pages",pageId,"backRefs",blockId])
        }
        return pageId
      }
      pageId = newUid()
      edits.write.push(["pages",pageId,{ title: title,children: [],":create/time": time,backRefs: [blockId] }])
      edits.write.push(["pagesByTitle",title,pageId])
      return pageId
    })

    // add string, edit time
    edits.write.push(["blocks",blockId,"string",string],
      ["blocks",blockId,":edit/time",time],
      ["blocks",blockId,":block/refs",newRefs])


    // subtract old refs
    if (oldRefs) {
      for (let oldRef of oldRefs) {
        if (!newRefs.includes(oldRef)) {
          const page = store.pages[oldRef]
          if (parentThingey(oldRef) === "pages" && (page.children === undefined || page.children.length === 0) && (page.backRefs === undefined || page.backRefs.length <= 1)) {
            edits.delete.push(["pagesByTitle",page.title])
            edits.delete.push(["pages",oldRef])
          } else {
            edits.subtract.push([parentThingey(oldRef),oldRef,"backRefs",blockId])
          }
        }
      }
    }

    return { edits }
  },

  // gonna add more fields later
  // the new id is in the change so it can be serialized deterministically
  createBlock: (parentId,idx,time) => {
    // todo make date guaranteed same between main and worker thread
    const blockId = newUid()
    const parentThingey = !!store.pages[parentId] ? "pages" : "blocks"
    const parent = store[parentThingey]
    const edits = {
      write: [["blocks",blockId,{ string: "",parent: parentId,":create/time": time,children: [],backRefs: [],":block/refs": [],refs: parent.refs }]],
      insert: [[parentThingey,parentId,"children",blockId,idx]],
    }
    return { edits,returns: blockId }
  },

  createPage: (pageTitle,time) => {
    const pageId = newUid()
    const edits = {
      write: [["pages",pageId,{ title: pageTitle,children: [],":create/time": time,backRefs: [] }],
      ["pagesByTitle",pageTitle,pageId]]
    }
    return { edits,returns: pageId }
  },

  writePageTitle: (pageId,title,time) => {
    const page = store.pages[pageId]
    const oldTitle = page.title
    const edits = {
      write: [["pages",pageId,"title",title],
      ["pages",pageId,":edit/time",time],
      ["pagesByTitle",title,pageId]],
      delete: [["pagesByTitle",oldTitle]]
    }
    if (page.backRefs) {
      for (let backRef of page.backRefs) {
        const block = store.blocks[backRef]
        let string = block.string

        // this replaces all other instances of that word, not just linked ones. This is a feature decision I made because it's easy
        edits.write.push(["blocks",backRef,"string",string.replaceAll(oldTitle,title)])
      }
    }
    return { edits }
  }

}

const runCommand = (...command) => {
  const { edits,returns } = commands[command[0]](...command.slice(1),Date.now())
  doEdits(edits)
  saveWorker.postMessage(["edits",edits])
  return returns
}
