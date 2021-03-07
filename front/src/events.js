// Event Listener Helpers -----------------------------------------------------------------------------------------------

const focusBlockEnd = (blockNode) => {
  const body = blockNode.children[1]
  const temp = document.createTextNode(" ")
  body.appendChild(temp)
  getSelection().collapse(temp,0)
  temp.remove()
}

const focusBlockStart = (blockNode) => {
  const body = blockNode.children[1]
  const temp = document.createTextNode(" ")
  body.insertBefore(temp,body.firstChild)
  getSelection().collapse(temp,0)
  temp.remove()
}

const focusBlockVerticalOffset = (offset,block = focusBlock,start = false) => { // this closure feels weird, maybe shoudn't use this language feature?
  const blocks = Array.from(document.querySelectorAll(".block"))
  const newActiveBlock = blocks[blocks.indexOf(block) + offset]
  if (newActiveBlock) {
    if (!start) {
      focusBlockEnd(newActiveBlock)
    } else {
      focusBlockStart(newActiveBlock)
    }
  }
}

const getChildren = (node) => {
  return node.className === "block" ? node.children[2].children : node.children[1].children
}

const downloadHandler = () => {
  console.log("download")
  const json = storeToRoamJSON(store)
  const data = new Blob([json],{ type: 'text/json' })
  const url = URL.createObjectURL(data)
  downloadButton.setAttribute('href',url)
  downloadButton.setAttribute('download',`${store.graphName}-${formatDateYMD(new Date(Date.now()))}.json`)
}

const expandTemplate = () => {
  const id = focusSuggestion.dataset.id
  const block = store.blox[sessionState.focusId]
  if (block.children === undefined || block.children.length === 0) {
    const parentId = store.blox[sessionState.focusId].p
    const childIds = store.blox[id].k
    const currentIdx = store.blox[parentId].k.indexOf(sessionState.focusId)
    macros.nocommit.delete(sessionState.focusId,false)
    const parentNode = focusBlock.parentNode
    focusBlock.remove()
    for (let i = 0; i < childIds.length; i++) {
      const childId = childIds[i]
      const idx = currentIdx + i
      const newId = macros.nocommit.copyBlock(childId,parentId,idx)
      const e = renderBlock(parentNode,newId,idx)
      if (i === 0) {
        focusBlockEnd(e)
      }
    }
    commit()
  } else
    notifyText("can't use a template inside a block that has children")
  templateList.style.display = "none"
}

const pasteBlocks = () => {
  const block = store.blox[sessionState.focusId]
  const parentId = block.p
  let currentIdx = store.blox[parentId].k.indexOf(sessionState.focusId)
  const parentNode = focusBlock.parentNode
  if (focusBlockBody.innerText === "") {
    macros.nocommit.delete(sessionState.focusId)
    focusBlock.remove()
  } else {
    currentIdx += 1
  }

  if (clipboardData.dragSelect.rooted) {
    const newId = macros.nocommit.copyBlock(clipboardData.dragSelect.root,parentId,currentIdx)
    const e = renderBlock(parentNode,newId,currentIdx)
    focusBlockEnd(e)
  } else {
    let lastNode = null
    for (let i = 0; i < clipboardData.dragSelect.endIdx + 1 - clipboardData.dragSelect.startIdx; i++) {
      const blockId = store.blox[clipboardData.dragSelect.root].k[i + clipboardData.dragSelect.startIdx]
      const newId = macros.nocommit.copyBlock(blockId,parentId,i + currentIdx)
      const e = renderBlock(parentNode,newId,i + currentIdx)
      lastNode = e
    }
    focusBlockEnd(lastNode)
  }
  commit()
}

const autocomplete = () => {
  const origString = store.blox[sessionState.focusId].s
  if (editingLink.className === "tag") {
    const textNode = editingLink.childNodes[0]
    // check for the exact inverse of tag regex to see if this would be a valid tag, otherwise make it a ref  
    if (/[^\/a-zA-Z0-9_-]/.test(focusSuggestion.dataset.title)) {
      const string = origString.slice(0,textNode.startIdx) + "[[" + focusSuggestion.dataset.title + "]]" + origString.slice(textNode.endIdx)
      sessionState.position = textNode.startIdx + focusSuggestion.dataset.title.length + 4
      setFocusedBlockString(string)
    } else {
      const string = origString.slice(0,textNode.startIdx) + "#" + focusSuggestion.dataset.title + origString.slice(textNode.endIdx)
      sessionState.position = textNode.startIdx + focusSuggestion.dataset.title.length + 1
      setFocusedBlockString(string)
    }
  } else {
    const textNode = editingLink.children[1].childNodes[0]
    const string = origString.slice(0,textNode.startIdx) + focusSuggestion.dataset.title + origString.slice(textNode.endIdx)
    sessionState.position = textNode.startIdx + focusSuggestion.dataset.title.length + 2
    setFocusedBlockString(string)
  }
  autocompleteList.style.display = "none"
}

const indentFocusedBlock = () => {
  const bid = sessionState.focusId
  const olderSibling = focusBlock.previousElementSibling
  if (olderSibling && olderSibling.dataset && olderSibling.dataset.id) {
    const newParentId = olderSibling.dataset.id
    console.log(newParentId)
    const idx = (store.blox[newParentId].k && store.blox[newParentId].k.length) || 0
    macros.move(bid,newParentId,idx)
    olderSibling.children[2].appendChild(focusBlock)
    getSelection().collapse(focusNode,focusOffset)
  }
}

const dedentFocusedBlock = () => {
  const bid = sessionState.focusId
  const parentId = store.blox[bid].p
  const parentBlock = store.blox[parentId]
  if (parentBlock) {
    const grandparentId = parentBlock.p
    const idx = store.blox[grandparentId].k.indexOf(parentId)
    macros.move(bid,grandparentId,idx + 1)
    const parentNode = focusBlock.parentNode.parentNode
    const grandparentChildren = parentNode.parentNode
    const cousin = parentNode.nextElementSibling
    if (cousin) {
      grandparentChildren.insertBefore(focusBlock,cousin)
    } else {
      grandparentChildren.appendChild(focusBlock)
    }

    getSelection().collapse(focusNode,focusOffset)
  } else {
    // notifyText("can't dedent from page root", 2) // don't need error message here?
  }
}


// Event listners --------------------------------------------------------------------------------------------------------

document.addEventListener("input",(event) => {
  updateCursorInfo()
  autocompleteList.style.display = "none"
  templateList.style.display = "none"
  if (sessionState.isFocused) {
    if (focusBlockBody.innerText === " " || focusBlockBody.innerText === "") {
      macros.write(sessionState.focusId,"")
      return
    }

    // reparse block and insert cursor into correct position while typing

    let string = focusBlockBody.innerText
    if (event.data === "[") {
      const pageRefClosesMissingOpens = event.target.querySelectorAll(".page-ref-close-missing-open")
      let broke = false
      for (let x of pageRefClosesMissingOpens) {
        console.log(x)
        if (x.childNodes[0].startIdx > sessionState.position) {
          broke = true
          break
        }
      }
      if (!broke)
        string = string.substring(0,sessionState.position) + "]" + string.substring(sessionState.position)
    } else if (event.data === "]") {
      if (string[sessionState.position] === "]") {
        string = string.substring(0,sessionState.position - 1) + string.substring(sessionState.position)
      }
    }

    let diff = { d: store.blox[sessionState.focusId].s,i: string }
    if (event.data !== null) {
      if (event.data.length === 1 && event.inputType === "insertText") {
        if (sessionState.position === string.length)
          diff = { i: event.data }
        else diff = { i: event.data,s: sessionState.position - 1 }
      }
    }

    setFocusedBlockString(string,diff)

    if (editingTitle) {
      const matchingTitles = titleExactFullTextSearch(editingTitle)
      renderResultSet(editingLink,matchingTitles,autocompleteList,0)
    }

    if (editingTemplateExpander) {
      console.log("editingTemplateExpander")
      const editingTemplateText = editingTemplateExpander.innerText.substring(2)
      const matchingTemplates = searchTemplates(editingTemplateText)
      renderResultSet(editingTemplateExpander,matchingTemplates,templateList,0)
    }

  } else if (event.target.id === "search-input") {
    const matchingTitles = exactFullTextSearch(event.target.value)
    renderResultSet(searchInput,matchingTitles,searchResultList,0)

  } else if (event.target.className === "page__title") {
    console.log("edit title")
    const pageId = event.target.parentNode.dataset.id
    macros.write(pageId,event.target.innerText)
  }
})

const globalHotkeys = {
  "hide top bar": {
    key: "b",
    control: true,
    fn: () => {
      if (topBar.style.marginTop === "0px") user.topBar = "hidden"
      else user.topBar = "visible"
      saveUser()
    }
  },
  "escape": {
    key: "Escape",fn: () => {
      autocompleteList.style.display = "none"
      templateList.style.display = "none"
    }
  },
  "upload": {
    key: "d",control: true,fn: () => {
      document.getElementById("upload-input").click()
    }
  },
  "download": { key: "s",control: true,shift: true,fn: downloadHandler },
  "save": { key: "s",control: true,fn: debouncedSaveStore },
  "toggle color theme": {
    key: "m",control: true,fn: () => {
      if (document.body.className === "light") {
        user.settings.theme = "dark"
        saveUser()
      } else {
        user.settings.theme = "light"
        saveUser()
      }
    }
  },
  "search": {
    key: "u",control: true,fn: () => {
      if (topBar.style.marginTop !== "0px") topBar.style.marginTop = "0px"
      searchInput.focus()
    }
  },
  "open": {
    key: "o",control: true,fn: (event) => {
      if (editingTitle) goto("pageTitle",editingTitle)
      else if (editingUrlElement) editingUrlElement.click()
    }
  },
  "daily notes": {
    key: "d",alt: true,fn: () => {
      goto("dailyNotes")
    }
  },"undo": {
    key: "z",control: true,fn: () => {
      if (edits.length > 0) {
        undoEdit()
        renderSessionState()
      }
    }
  },
  "terminal": {
    key: "i",control: true,alt: true,fn: () => {
      if (terminalElement.style.display === "none") {
        terminalElement.style.display = "block"
        terminalElement.focus()
      } else {
        terminalElement.style.display = "none"
      }
    }
  }
}

document.addEventListener("keydown",(event) => {
  updateCursorInfo()
  for (let hotkeyName in globalHotkeys) {
    const hotkey = globalHotkeys[hotkeyName]
    if (event.key === hotkey.key &&
      event.shiftKey === !!hotkey.shift &&
      event.ctrlKey === !!hotkey.control &&
      event.altKey === !!hotkey.alt) {
      hotkey.fn(event)
      event.preventDefault()
      return
    }
  }

  if (dragSelect) {
    let did = false
    if ((event.key === "c" || event.key === "x") && event.ctrlKey) {
      let text = ""
      console.log("copy blocks")
      const id = dragSelect.root.dataset.id
      if (dragSelect.rooted) {
        text = blocToMd(id)
      } else {
        const kids = store.blox[id].k
        for (let i = dragSelect.startIdx; i < dragSelect.endIdx + 1; i++) {
          text += blocToMd(kids[i])
        }
      }
      clipboardData = {
        dragSelect: {
          root: id,
          startIdx: dragSelect.startIdx,
          endIdx: dragSelect.endIdx,
          rooted: dragSelect.rooted
        },
        text
      }
      console.log(clipboardData)
      navigator.clipboard.writeText(text)
      did = true
    }
    if (event.key === "Backspace" || event.key === "Delete" || (event.key === "x" && event.ctrlKey)) {
      console.log(dragSelect)
      if (dragSelect.rooted) {
        focusBlockVerticalOffset(-1,dragSelect.root)
        macros.nocommit.delete(dragSelect.root.dataset.id)
        document.querySelectorAll(`.block[data-id="${dragSelect.root.dataset.id}"]`).forEach(x => x.remove())
      } else {
        const childNodes = getChildren(dragSelect.root)
        focusBlockVerticalOffset(-1,childNodes[dragSelect.startIdx])
        console.log(`cnl ${childNodes.length} start ${dragSelect.startIdx} end ${dragSelect.endIdx}`)
        // iterate backwards so the idxs don't shift underneath you
        for (let i = dragSelect.endIdx; i >= dragSelect.startIdx; i--) {
          const node = childNodes[i]
          macros.nocommit.delete(node.dataset.id)
          document.querySelectorAll(`.block[data-id="${node.dataset.id}"]`).forEach(x => x.remove())
        }
        commit()
      }
      dragSelect = null
      did = true
    }
    if (did) event.preventDefault()
  } else if (autocompleteList.style.display !== "none") {
    if (event.key === "Enter") {
      autocomplete()
      event.preventDefault()
    }
    if (updownythingey(editingLink,autocompleteList,titleExactFullTextSearchCache,focusSuggestion)) event.preventDefault()
  } else if (templateList.style.display !== "none") {
    if (event.key === "Tab" || event.key === "Enter") {
      expandTemplate()
      event.preventDefault()
    }
    if (updownythingey(editingTemplateExpander,templateList,templateSearchCache,focusSuggestion)) event.preventDefault()
  } else if (sessionState.isFocused) {
    let blocks
    let newActiveBlock
    switch (event.key) {
      case "Enter":
        if (!event.shiftKey) {
          let idx = store.blox[store.blox[sessionState.focusId].p].k.indexOf(sessionState.focusId)
          if (!event.ctrlKey) {
            idx += 1
          }
          console.log(idx)
          const newBlockUid = newUid()
          commitEdit("cr",newBlockUid,store.blox[sessionState.focusId].p,idx)
          const newBlockElement = renderBlock(focusBlock.parentNode,newBlockUid,idx)
          newBlockElement.children[1].focus()
          event.preventDefault()
        }
        break
      case "Tab":
        if (event.shiftKey)
          dedentFocusedBlock()
        else
          indentFocusedBlock()
        event.preventDefault()
        break
      case "Backspace":
        if (sessionState.position === 0) {
          const parent = store.blox[store.blox[sessionState.focusId].p]
          console.log(parent.k)
          if (!(parent.p === undefined && parent.k.length === 1)) {
            blocks = Array.from(document.querySelectorAll(".block"))
            newActiveBlock = blocks[blocks.indexOf(focusBlock) - 1]
            focusBlock.remove()
            focusBlockEnd(newActiveBlock)
            macros.delete(sessionState.focusId)
            event.preventDefault()
          }
        }
        break
      case "ArrowDown":
        if (event.altKey && event.shiftKey) {
          const parentId = store.blox[sessionState.focusId].p
          const parentElement = focusBlock.parentNode
          const currentIdx = store.blox[parentId].children.indexOf(sessionState.focusId)
          if (focusBlock.nextElementSibling) {
            macros.move(sessionState.focusId,parentId,currentIdx + 1)
            if (focusBlock.nextElementSibling.nextElementSibling) {
              parentElement.insertBefore(focusBlock,focusBlock.nextElementSibling.nextElementSibling)
            } else parentElement.appendChild(focusBlock)
            getSelection().collapse(focusNode,focusOffset)
            event.preventDefault()
          }
        } else if (!event.shiftKey && !event.altKey) {
          focusBlockVerticalOffset(1)
          event.preventDefault()
        }
        break
      case "ArrowUp":
        if (event.altKey && event.shiftKey) {
          const parentId = store.blox[sessionState.focusId].p
          const parentElement = focusBlock.parentNode
          const currentIdx = store.blox[parentId].children.indexOf(sessionState.focusId)
          if (focusBlock.previousElementSibling) {
            macros.move(sessionState.focusId,parentId,currentIdx - 1)
            parentElement.insertBefore(focusBlock,focusBlock.previousElementSibling)
            getSelection().collapse(focusNode,focusOffset)
            event.preventDefault()
          }
        } else if (!event.shiftKey && !event.altKey) {
          focusBlockVerticalOffset(-1)
          event.preventDefault()
        }
        break
      case "ArrowLeft":
        if (event.shiftKey && event.altKey) {
          dedentFocusedBlock()
        } else if (sessionState.position === 0) {
          focusBlockVerticalOffset(-1)
          event.preventDefault()
        }
        break
      case "ArrowRight":
        if (event.shiftKey && event.altKey) {
          indentFocusedBlock()
        } else if (sessionState.position === focusBlockBody.innerText.length) {
          focusBlockVerticalOffset(1,focusBlock,true)
          event.preventDefault()
        }
        break
      case "c":
        if (event.ctrlKey) { // LEGITTODO copy md text and check paste text against, 
          clipboardData = null
        }
        break
    }
  }

  if (
    document.activeElement &&
    document.activeElement.id === "search-input"
    && focusSearchResult
  ) {
    if (event.key === "Enter" && !event.ctrlKey) {
      if (focusSearchResult) {
        if (focusSearchResult.dataset.title) {
          goto("pageTitle",focusSearchResult.dataset.title)
        } else {
          goto("block",focusSearchResult.dataset.id)
        }
        event.preventDefault()
        return
      }
    } else if (event.key === "Enter" && event.ctrlKey) {
      goto("pageTitle",event.target.value)
      event.preventDefault()
      return
    }

    const didUpDowny = updownythingey(searchInput,searchResultList,exactFullTextSearchCache,focusSearchResult)
    if (didUpDowny) event.preventDefault()
  }

  if (terminalElement.style.display !== "none") {
    if (event.key === "Enter" && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      const tc = terminalCommands[event.target.innerText]
      if (tc) {
        tc()
        event.preventDefault()
        terminalElement.style.display = "none"
        terminalElement.innerHTML = ""
      }
      else {
        try {
          eval(event.target.innerText)
          if (!event.ctrlKey) {
            terminalElement.style.display = "none"
            terminalElement.innerHTML = ""
          }
        } catch (error) {
          console.log(error)
          event.preventDefault()
        }
      }
    }
  }
})

document.addEventListener('paste',(event) => {
  console.log(event)
  if (clipboardData) {
    const clipboardText = event.clipboardData.getData('text')
    console.log(clipboardText)
    console.log(clipboardData.text)
    if (clipboardText.replaceAll(/\r/g,"") == clipboardData.text) {
      pasteBlocks()
      event.preventDefault()
    } else clipboardData = undefined
  }
})

const updownythingey = (parent,list,cache,focused) => {
  // todo factor this so the same logic works on search all, block, title, and template
  const moveDirection = ((event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey)) && -1) ||
    ((event.key === "ArrowDown" || event.key === "Tab") && 1)
  if (moveDirection) {
    const siblingToMoveTo = moveDirection === -1 ? focused.previousElementSibling : focused.nextElementSibling
    if (siblingToMoveTo) {
      siblingToMoveTo.dataset.selected = "true"
      delete focused.dataset.selected
    } else {
      const oldIdx = parseInt(list.dataset.resultStartIdx)
      const newIdx = clamp(oldIdx + moveDirection * SEARCH_RESULT_LENGTH,0,cache.length - SEARCH_RESULT_LENGTH)
      renderResultSet(parent,cache,list,newIdx)
      if (moveDirection === -1) {
        delete list.firstElementChild.dataset.selected
        list.lastElementChild.dataset.selected = true
      }
    }
    return true
  }
}

const getPageTitleOfNode = (node) => {
  const tag = node.closest(".tag")
  if (tag) return tag.innerText.substring(1)

  const attribute = node.closest(".attribute")
  if (attribute) return attribute.innerText.substring(0,attribute.innerText.length - 2)

  const pageRef = node.closest(".page-ref")
  if (pageRef) return pageRef.children[1].innerText

  return undefined
}

// The single event handler model has some problems. The cases need to appear in the same order they are nested in the DOM
document.addEventListener("click",(event) => {

  const clickedPageTitle = getPageTitleOfNode(event.target)
  if (clickedPageTitle) {
    goto("pageTitle",clickedPageTitle)
    return
  }

  const closestBullet = event.target.closest(".block__bullet")

  if (event.target.className === "search-result") {
    if (event.target.dataset.title) {
      goto("pageTitle",event.target.dataset.title)
    } else {
      goto("block",event.target.dataset.id)
    }
    return
  } else if (event.target.id !== "search-input") {
    searchResultList.style.display = "none"
  }

  const closestBreadcrumbPage = event.target.closest(".breadcrumb-page")
  const closestBreadcrumbBlock = event.target.closest(".breadcrumb-block")

  // markup
  if (closestBullet) {
    goto("block",closestBullet.parentNode.dataset.id)
  } else if (event.target.className === "block-ref") {
    goto("block",event.target.dataset.id)
  } else if (event.target.className === "url") { // using spans with event handlers as links because they play nice with contenteditable
    const link = document.createElement("a")
    link.target = "_blank"
    link.href = event.target.innerText
    link.click()

    // everything else, so none of it triggers when user clicks markup
  } else if (event.target.id === "download-button") {
    downloadHandler()
  } else if (event.target.className === "template__suggestion") {
    if (focusSuggestion) focusSuggestion.dataset.selected = false
    event.target.dataset.selected = true
    focusSuggestion = event.target
    expandTemplate()
  } else if (event.target.id === "upload-button") {
    document.getElementById("upload-input").click()
  } else if (event.target.id === "daily-notes-button") {
    goto("dailyNotes")
  } else if (event.target.id === "options-button") {
    notifyText("Options coming soon")
  } else if (event.target.className === "autocomplete__suggestion") {
    if (focusSuggestion) focusSuggestion.dataset.selected = false
    event.target.dataset.selected = true
    autocomplete()
  } else if (event.target.id === "help-button") {
    goto("pageTitle","Welcome to Micro Roam")
  } else if (closestBreadcrumbPage) {
    goto("pageTitle",closestBreadcrumbPage.dataset.title)
  } else if (closestBreadcrumbBlock) {
    goto("block",closestBreadcrumbBlock.dataset.id)
  } else if (event.target.className == "exit-to-main") {
    signupElement.style.display = "none"
    loginElement.style.display = "none"
  }

  // this is at the bottom so that autocomplete suggestion click handler still knows where the link is. 
  // todo have better tracking of active block
  updateCursorInfo()
})


const commonAncestorNode = (a,b) => {
  const aList = []
  while (a.dataset.id !== undefined) {
    aList.push(a.dataset.id)
    a = a.parentNode.parentNode
  }
  const bList = []
  while (b.dataset.id !== undefined) {
    bList.push(b.dataset.id)
    if (aList.indexOf(b.dataset.id) !== -1) {
      const caid = aList[aList.indexOf(b.dataset.id) - 1]
      const cbid = bList[bList.length - 2]
      const parentChildIds = store.blox[b.dataset.id].k
      const bidx = parentChildIds ? parentChildIds.indexOf(cbid) : -1
      const aidx = parentChildIds ? parentChildIds.indexOf(caid) : -1
      const e = Math.max(aidx,bidx)
      return { root: b,startIdx: Math.max(Math.min(aidx,bidx),0),endIdx: e === -1 ? parentChildIds.length : e,rooted: bidx === -1 || aidx === -1 }
    }
    b = b.parentNode.parentNode
  }
}

const setDragSelected = (bool) => {
  if (dragSelect) {
    if (dragSelect.rooted) {
      dragSelect.root.dataset.selected = bool
    } else {
      const children = getChildren(dragSelect.root)
      for (let i = dragSelect.startIdx; i < dragSelect.endIdx + 1; i++) {
        children[i].dataset.selected = bool
      }
    }
  }
}

const mouseMoveListener = (event) => {
  setDragSelected(false)
  const blockNode = event.target.closest(".block")
  if (blockNode && blockNode !== dragSelectStartBlock) {
    getSelection().empty()
    const can = commonAncestorNode(dragSelectStartBlock,blockNode)
    if (can) {
      dragSelect = can
      setDragSelected(true)
    }
  } else {
    dragSelect = null
  }
}

document.addEventListener("mousedown",(event) => {
  updateCursorInfo()
  setDragSelected(false)
  dragSelect = null
  if (event.target.closest(".block")) {
    document.addEventListener("mousemove",mouseMoveListener)
    dragSelectStartBlock = event.target.closest(".block")
  }
})

document.addEventListener("mouseup",(event) => {
  if (dragSelectStartBlock !== null) {
    document.removeEventListener("mousemove",mouseMoveListener)
    dragSelectStartBlock = null
  }
})

const showTopBarFn = () => {
  user.topBar = "visible"
  saveUser()
}
let showTopBarTimeout = null

topBarHiddenHitbox.addEventListener("mouseover",() => {
  clearTimeout(showTopBarTimeout)
  showTopBarTimeout = setTimeout(showTopBarFn,700)
})

topBarHiddenHitbox.addEventListener("mouseout",() => {
  clearTimeout(showTopBarTimeout)
  showTopBarTimeout = null
})

document.getElementById('upload-input').addEventListener('change',(event) => {
  const file = event.target.files[0]
  console.log(file)
  const { name,ext: extension } = splitFileName(file.name)
  console.log(`name ${name} extension ${extension}`)
  if (extension === "zip") {
    file.arrayBuffer().then((buffer) => {
      const files = zipToFiles(buffer)
      console.log(files)
      if (files.length === 1 && files[0].ext === "json") {
        store = roamJsonToStore(files[0].name,files[0].text)
        preprocessNewStore()
      } else {
        notifyText("Markdown import doesn't work yet. Upload a .json file, or a .zip file containing a .json file instead.",12)
        throw new Error("md import doesn't work")
        const mds = []
        for (let file of files) {
          if (file.ext === "md") {
            mds.push(file)
          } else {
            console.log(`That zip file contained ${file.fullName}, but Micro Roam expected a .json file or multiple .md files`)
          }
        }
        console.log("parsing markdown")
        mdToStore(mds)
      }
    })
  } else if (extension === "json") {
    file.text().then((text) => {
      user.graphName = name
      store = roamJsonToStore(name,text)
      preprocessNewStore()
    })
  } else {
    notifyText("Micro Roam only accepts a .json file or .zip file containing 1 .json file") // add "md" once that works
  }
})

const preprocessNewStore = () => {
  startFn = () => gotoNoHistory("dailyNotes")
  fetch("./default-store.json").then(text => text.json().then(json => {
    mergeStore(json)
    start()
  }))
}

switchToSignup.addEventListener('click',() => {
  focusSignup()
})

switchToLogin.addEventListener('click',() => {
  focusLogin()
})

signupButton.addEventListener('click',(event) => {
  focusSignup()
  event.stopPropagation()
  event.preventDefault()
})

const focusSignup = () => {
  signupElement.style.display = "block"
  loginElement.style.display = "none"
  signupEmailElement.focus()
}

const focusLogin = () => {
  loginElement.style.display = "block"
  signupElement.style.display = "none"
  loginEmailElement.focus()
}