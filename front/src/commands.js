const cpy = x => JSON.parse(JSON.stringify(x))

const getIn = (arr,skip) => {
  let result = store
  for (let i = 0; i < arr.length - skip; i++) {
    if (result[arr[i]] === undefined) {
      result[arr[i]] = {}
    }
    result = result[arr[i]]
  }
  return result
}

// Edit format: {delete:[[...keys]],write:[[...keys,value]], add:[[...keys, value]], subtract:[[...keys, value]], insert: [[...keys, value, idx]]}

const doEdits = (edits) => {

  // it's important that subtract comes first because you can subtract something then insert it earlier in the same list
  if (edits.subtract) {
    for (let op of edits.subtract) {
      const obj = getIn(op,2)
      const key = op[op.length - 2]
      obj[key] = obj[key].filter(x => (x != op[op.length - 1]))
    }
  }

  if (edits.write) {
    for (let op of edits.write) {
      const obj = getIn(op,2)
      obj[op[op.length - 2]] = cpy(op[op.length - 1])
    }
  }
  if (edits.add) {
    for (let op of edits.add) {
      const obj = getIn(op,2)
      obj[op[op.length - 2]].push(cpy(op[op.length - 1]))
    }
  }
  if (edits.insert) {
    for (let op of edits.insert) {
      const obj = getIn(op,3)
      const key = op[op.length - 3]
      const val = op[op.length - 2]
      const idx = op[op.length - 1]
      let old = obj[key]
      if (old === undefined) {
        old = [val]
        obj[key] = old
      } else if (old.length < idx) {
        console.log(old)
        console.log(key)
        throw new Error(`tried to insert past end of list`) // todo always put error at the end
      } else {
        obj[key] = old.slice(0,idx)
        obj[key].push(cpy(val))
        obj[key].push(...old.slice(idx))
      }
    }
  }
  if (edits.delete) {
    for (let op of edits.delete) {
      const obj = getIn(op,1)
      delete obj[op[op.length - 1]]
    }
  }
}

const saveStore = () => {
  const transaction = idb.transaction(["stores"],"readwrite")
  const storeStore = transaction.objectStore("stores")
  const str = JSON.stringify(store)
  const req = storeStore.put({ graphName: store.graphName,store: str })
  req.onsuccess = () => {
    console.log("saved")
  }
  req.onerror = (event) => {
    console.log("save error")
    console.log(error)
  }
}

let saveStoreTimeout = null

const debouncedSaveStore = () => {
  clearTimeout(saveStoreTimeout)
  saveStoreTimeout = setTimeout(saveStore,500)
}

const print = (text) => {
  if (user.logging) {
    console.log(text)
  }
}

// idk whether this is "random enough"
// it is highly performance inneficient but i don't need to call this many times
const CHARS_64 = "-_0123456789abcdefghijklmnopqrstuvwxyzABCDEFJHIJKLMNOPQRSTUVWXYZ"
const newUid = () => {
  let result
  do {
    result = ""
    for (let i = 0; i < 9; i++) {
      result += CHARS_64[Math.floor(Math.random() * 64)]
    }
  } while (store.pages[result] !== undefined || store.blocks[result] !== undefined)
  console.trace()
  console.log(result)
  return result
}

const blockOrPageFromId = (id) => {
  return store.blocks[id] || store.pages[id]
}

const parentThingey = (id) => store.pages[id] ? "pages" : "blocks"

const commands = {
  deleteBlock: (blockId) => {
    const block = store.blocks[blockId]
    const parentId = block.parent
    const refs = block[":block/refs"]
    const backRefs = block.backRefs
    // todo make child ref tracking on delete block
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
      ["blocks",blockId,"edit-time",time],
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

  createBlock: (parentId,idx,time) => {
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
      write: [["pages",pageId,{ title: pageTitle,":create/time": time }],
      ["pagesByTitle",pageTitle,pageId]]
    }
    return { edits,returns: pageId }
  },

  writePageTitle: (pageId,title,time) => {
    const page = store.pages[pageId]
    const oldTitle = page.title
    const edits = {
      write: [["pages",pageId,"title",title],
      ["pages",pageId,"edit-time",time],
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
  },
  copyBlock: (blockId,parentId,idx,time) => {
    const newId = newUid()
    const edits = { write: [],insert: [[parentThingey(parentId),parentId,"children",newId,idx]],subtract: [] }
    const copyBlock = (oldId,newId,parentId) => {
      const block = store.blocks[oldId]
      const newBlock = { "create-time": time,string: block.string,parent: parentId }
      for (let propName of LIST_PROPS) {
        if (block[propName])
          newBlock[propName] = Array.from(block[propName])
      }
      if (block.children) {
        newBlock.children = []
        for (let child of block.children) {
          const newChildId = newUid()
          copyBlock(child,newChildId,newId)
          newBlock.children.push(newChildId)
        }
      }
      edits.write.push(["blocks",newId,newBlock])
    }
    copyBlock(blockId,newId,parentId)
    return { edits,returns: newId }
  }

}

const runCommand = (...command) => {
  console.log(command)
  const { edits,returns } = commands[command[0]](...command.slice(1),Date.now())
  doEdits(edits)
  // saveWorker.postMessage(["edits",edits])
  debouncedSaveStore()
  return returns
}
