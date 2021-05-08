// Event Listener Helpers -----------------------------------------------------------------------------------------------
const isOsMac = navigator.platform.substring(0, 3) === "Mac"

let getCtrlKey = (event) => event.ctrlKey
if (isOsMac) {
  getCtrlKey = (event) => event.metaKey
}

const downloadHandler = () => {
  console.log("download")
  const json = storeToRoamJSON(store)
  const data = new Blob([json], { type: 'text/json' })
  const url = URL.createObjectURL(data)
  const aElement = document.createElement('a')
  aElement.setAttribute('href', url)
  aElement.setAttribute('download', `${store.graphName}-${formatDateYMD(new Date(Date.now()))}.json`)
  aElement.click()
}

const downloadMd = () => {
  console.log("download md")
  const data = storeToMdZip()
  const url = URL.createObjectURL(data)
  const anchor = document.createElement("a")
  anchor.setAttribute('href', url)
  anchor.setAttribute('download', `${store.graphName}-md-${formatDateYMD(new Date(Date.now()))}.zip`)
  anchor.click()
}

const expandTemplate = () => {
  const id = focusSuggestion.dataset.id
  const block = store.blox[sessionState.focusId]
  if (block.k === undefined || block.k.length === 0) {
    const parentId = store.blox[sessionState.focusId].p
    const childIds = store.blox[id].k
    const currentIdx = store.blox[parentId].k.indexOf(sessionState.focusId)
    macros.nocommit.delete(sessionState.focusId, false)
    for (let i = 0; i < childIds.length; i++) {
      const childId = childIds[i]
      const idx = currentIdx + i
      const newId = macros.nocommit.copyBlock(childId, parentId, idx)
      if (i === 0) {
        sessionState.position = 0
        sessionState.focusId = newId
        focusIdPosition()
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
  if (focusBlockBody.innerText === "") {
    macros.nocommit.delete(sessionState.focusId)
  } else {
    currentIdx += 1
  }
  let firstId
  if (clipboardData.dragSelect.rooted) {
    firstId = macros.nocommit.copyBlock(clipboardData.dragSelect.root, parentId, currentIdx)
  } else {
    for (let i = 0; i < clipboardData.dragSelect.endIdx + 1 - clipboardData.dragSelect.startIdx; i++) {
      const blockId = store.blox[clipboardData.dragSelect.root].k[i + clipboardData.dragSelect.startIdx]
      const theId = macros.nocommit.copyBlock(blockId, parentId, i + currentIdx)
      if (!firstId) firstId = theId
    }
  }
  sessionState.position = 0
  sessionState.focusId = firstId
  focusIdPosition()
  commit()
}

const autocomplete = () => {
  const origString = store.blox[sessionState.focusId].s
  if (editingLink.className === "tag") {
    const textNode = editingLink.childNodes[0]
    // check for the exact inverse of tag regex to see if this would be a valid tag, otherwise make it a ref  
    if (focusSuggestion.dataset.title.match(/^[a-zA-Z0-9\-_]+$/)) {
      const string = origString.slice(0, editingLink.startIdx) + "#" + focusSuggestion.dataset.title + origString.slice(editingLink.endIdx)
      sessionState.position = editingLink.startIdx + focusSuggestion.dataset.title.length + 1
      setFocusedBlockString(string)
    } else {
      const string = origString.slice(0, editingLink.startIdx) + "[[" + focusSuggestion.dataset.title + "]]" + origString.slice(editingLink.endIdx)
      sessionState.position = editingLink.startIdx + focusSuggestion.dataset.title.length + 4
      setFocusedBlockString(string)
    }
  } else {
    const string = origString.slice(0, editingLink.startIdx) + "[[" + focusSuggestion.dataset.title + "]]" + origString.slice(editingLink.endIdx)
    sessionState.position = editingLink.startIdx + focusSuggestion.dataset.title.length + 4
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
    macros.move(bid, newParentId, idx)
    focusIdPosition()
  }
}

const dedentFocusedBlock = () => {
  const bid = sessionState.focusId
  const parentId = store.blox[bid].p
  const parentBlock = store.blox[parentId]
  if (parentBlock && parentBlock.p) {
    const grandparentId = parentBlock.p
    const idx = store.blox[grandparentId].k.indexOf(parentId)
    macros.move(bid, grandparentId, idx + 1)
    focusIdPosition()
  } else {
    // notifyText("can't dedent from page root", 2) // don't need error message here?
  }
}


// Event listners --------------------------------------------------------------------------------------------------------

document.addEventListener("input", (event) => {
  console.log("input???")
  if (sessionState.isFocused) {
    updateCursorPosition()
    if (focusBlockBody.innerText === " " || focusBlockBody.innerText === "") {
      macros.write(sessionState.focusId, "")
      return
    }

    // reparse block and insert cursor into correct position while typing

    const oldString = store.blox[sessionState.focusId].s
    let string = focusBlockBody.innerText

    if (string === oldString + "\n\n") string = oldString + "\n"
    let wasInputPlain = event.data && event.data.length === 1 && event.inputType === "insertText"
    if (event.data) {
      if (getSelection().isCollapsed) {
        wasInputPlain = false
      }
      if (event.data === "[") {
        const pageRefClosesMissingOpens = event.target.querySelectorAll(".page-ref-close-missing-open")
        let broke = false
        for (let x of pageRefClosesMissingOpens) {
          if (x.childNodes[0].startIdx > sessionState.position) {
            broke = true
            break
          }
        }
        if (!broke) {
          string = string.substring(0, sessionState.position) + "]" + string.substring(sessionState.position)
          wasInputPlain = false
        }
      } else if (event.data === "]") {
        if (string[sessionState.position] === "]") {
          string = string.substring(0, sessionState.position - 1) + string.substring(sessionState.position)
          wasInputPlain = false
        }
      }
    }
    let diff = { d: oldString, i: string }
    if (wasInputPlain) {
      if (sessionState.position === string.length)
        diff = { i: event.data }
      else diff = { i: event.data, s: sessionState.position - 1 }
    }
    setFocusedBlockString(string, diff)

    if (editingCommandElement) {
      const matchingInlineCommands = matchInlineCommand(editingCommandElement.innerText.substring(1))
      renderResultSet(editingCommandElement, matchingInlineCommands, inlineCommandList, 0)
    }

    if (editingLink) {
      const matchingTitles = titleSearch(editingLink.dataset.title)
      renderResultSet(editingLink, matchingTitles, autocompleteList, 0)
    }

    if (editingTemplateExpander) {
      const editingTemplateText = editingTemplateExpander.innerText.substring(2)
      const matchingTemplates = searchTemplates(editingTemplateText)
      renderResultSet(editingTemplateExpander, matchingTemplates, templateList, 0)
    }

  } else if (event.target.id === "search-input") {
    const matchingTitles = fullTextSearch(event.target.value)
    renderResultSet(searchInput, matchingTitles, searchResultList, 0)

  } else if (event.target.className === "page__title") {
    const pageId = event.target.parentNode.dataset.id
    macros.writePageTitle(pageId, event.target.innerText)
  }
})

const globalHotkeys = {
  "hide top bar": {
    key: "b",
    control: true,
    fn: () => {
      if (topBar.style.marginTop === "0px") user.s.topBar = "hidden"
      else user.s.topBar = "visible"
      saveUser()
    }
  },
  "escape": {
    key: "Escape", fn: () => {
      autocompleteList.style.display = "none"
      templateList.style.display = "none"
    }
  },
  "upload": {
    key: "d", control: true, fn: () => {
      topButtons["Upload"].click()
    }
  },
  "download": { key: "s", control: true, shift: true, fn: downloadHandler },
  "save": { key: "s", control: true, fn: debouncedSaveStore },
  "toggle color theme": {
    key: "m", control: true, fn: () => {
      const currentThemeIndex = colorThemeOrder.indexOf(user.s.theme)
      user.s.theme = colorThemeOrder[(currentThemeIndex + 1) % colorThemeOrder.length]
      saveUser()
    }
  },
  "search": {
    key: "u", control: true, fn: () => {
      if (topBar.style.marginTop !== "0px") topBar.style.marginTop = "0px"
      searchInput.focus()
    }
  },
  "open": {
    key: "o", control: true, fn: (event) => {
      updateCursorSpanInfo()
      console.log('CONTROL O')
      console.log(editingLink)
      console.log(editingUrlElement)
      if (editingLink) {
        goto("pageTitle", editingLink.dataset.title, editingLink.graphName)
      }
      else if (editingUrlElement) {
        followUrlElement(editingUrlElement)
      }
    }
  },
  "daily notes": {
    key: "d", alt: true, fn: () => {
      goto("dailyNotes")
    }
  },
  "undo": {
    key: "z", control: true, fn: () => {
      if (undoCommitList.length > 0) {
        undo()
        renderSessionState()
      }
    }
  },
  "delete block": {
    key: "k", control: true, shift: true, fn: () => {
      const bloc = store.blox[sessionState.focusId]
      if ((bloc.k === undefined || bloc.k.length === 0) &&
        !(store.blox[bloc.p].p === undefined &&
          store.blox[bloc.p].k.length === 1)) {
        const oldFocusId = sessionState.focusId
        focusBlockVerticalOffset(-1)
        macros.delete(oldFocusId)
      } else {
        notifyText(`no "delete block" for blocks with children or the only block in a page (at least right now)`)
      }
    }
  },
  "terminal": {
    key: "i", control: true, alt: true, fn: () => {
      if (terminalElement.style.display === "none") {
        terminalElement.style.display = "block"
        terminalElement.focus()
      } else {
        terminalElement.style.display = "none"
      }
    }
  },
  "hide bullets": {
    key: "p", control: true, fn: () => {
      user.s.hideBulletsUnlessHover = !user.s.hideBulletsUnlessHover
      saveUser()
    }
  },
  "copy block reference": {
    key: "i", alt: true, fn: () => {
      const id = sessionState.focusId
      if (id)
        navigator.clipboard.writeText("((" + id + "))")
      else
        notifyText("no block focused, cannot copy block id")
    }
  }
}

document.addEventListener("keydown", (event) => {
  for (let hotkeyName in globalHotkeys) {
    const hotkey = globalHotkeys[hotkeyName]
    if (event.key.toLowerCase() === hotkey.key &&
      event.shiftKey === !!hotkey.shift &&
      getCtrlKey(event) === !!hotkey.control &&
      event.altKey === !!hotkey.alt) {
      hotkey.fn(event)
      event.preventDefault()
      return
    }
  }

  if (dragSelect) {
    let did = false
    if ((event.key === "c" || event.key === "x") && getCtrlKey(event)) {
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
    if (event.key === "Backspace" || event.key === "Delete" || (event.key === "x" && getCtrlKey(event))) {
      if (dragSelect.rooted) {
        focusBlockVerticalOffset(-1, dragSelect.root)
        macros.delete(dragSelect.root.dataset.id)
      } else {
        const childNodes = getChildren(dragSelect.root)
        focusBlockVerticalOffset(-1, childNodes[dragSelect.startIdx])
        console.log(`cnl ${childNodes.length} start ${dragSelect.startIdx} end ${dragSelect.endIdx}`)
        // iterate backwards so the idxs don't shift underneath you
        for (let i = dragSelect.endIdx; i >= dragSelect.startIdx; i--) {
          const node = childNodes[i]
          macros.nocommit.delete(node.dataset.id)
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
    navigateDropdownWithKeyboard(editingLink, autocompleteList, titleSearchCache, focusSuggestion, event)
  } else if (templateList.style.display !== "none") {
    if (event.key === "Tab" || event.key === "Enter") {
      expandTemplate()
      event.preventDefault()
    }
    navigateDropdownWithKeyboard(editingTemplateExpander, templateList, templateSearchCache, focusSuggestion, event)
  } else if (inlineCommandList.style.display !== "none") {
    if (event.key === "Tab" || event.key === "Enter") {
      execInlineCommand()
      event.preventDefault()
    }
    navigateDropdownWithKeyboard(editingCommandElement, inlineCommandList, commandSearchCache, focusSuggestion, event)
  } else if (sessionState.isFocused) {
    let blocks
    let newActiveBlock
    switch (event.key) {
      case "Enter":
        if (event.shiftKey) {

        } else {
          let oldIdx = store.blox[store.blox[sessionState.focusId].p].k.indexOf(sessionState.focusId)
          let idx = oldIdx
          if (!getCtrlKey(event)) {
            idx += 1
          }
          macros.create(store.blox[sessionState.focusId].p, idx)
          focusBlockVerticalOffset(idx === oldIdx ? -1 : 1)
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
          if (!(parent.p === undefined && parent.k.length === 1)) {
            const currentFocusBlock = focusBlock
            focusBlockVerticalOffset(-1)
            macros.delete(currentFocusBlock.dataset.id)
            event.preventDefault()
          }
        }
        break
      case "ArrowDown":
        if (event.altKey && event.shiftKey) {
          // this needs to only work when the parent is actually visible, not accidentally move around in its parent when its just a block in a frame. 
          const parentId = store.blox[sessionState.focusId].p
          const parentElement = focusBlock.parentNode
          const currentIdx = store.blox[parentId].k.indexOf(sessionState.focusId)
          if (focusBlock.nextElementSibling) {
            macros.move(sessionState.focusId, parentId, currentIdx + 1)
            focusIdPosition()
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
          const currentIdx = store.blox[parentId].k.indexOf(sessionState.focusId)
          if (focusBlock.previousElementSibling) {
            macros.move(sessionState.focusId, parentId, currentIdx - 1)
            focusIdPosition()
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
        } else { // have to adjust sessionState.position manually because no updateCursorPosition at the head of keydown anymore. instead all cursor updates come from oninput, onselectionchange, key left/right, and scripts that change position
          sessionState.position -= 1
        }
        break
      case "ArrowRight":
        if (event.shiftKey && event.altKey) {
          indentFocusedBlock()
        } else if (sessionState.position >= focusBlockBody.innerText.length) {
          focusBlockVerticalOffset(1, focusBlock, true)
          event.preventDefault()
        } else {
          sessionState.position += 1
        }
        break
      case "c":
        if (getCtrlKey(event)) { // LEGITTODO copy md text and check paste text against, 
          clipboardData = null
        }
        break
    }
  }

  if (document.activeElement && document.activeElement.id === "search-input") {
    if (event.key === "Enter") {
      if (!getCtrlKey(event) && focusSuggestion) {
        if (focusSuggestion.dataset.title) {
          goto("pageTitle", focusSuggestion.dataset.title)
        } else {
          goto("block", focusSuggestion.dataset.id)
        }
      } else {
        goto("pageTitle", event.target.value)
      }
      event.preventDefault()
      return
    }

    navigateDropdownWithKeyboard(searchInput, searchResultList, fullTextSearchCache, focusSuggestion, event)
  }

  if (terminalElement.style.display !== "none") {
    if (event.key === "Enter" && !getCtrlKey(event) && !event.shiftKey && !event.altKey) {
      const string = event.target.innerText
      const first = string.match(/^[a-z]+/)
      if (first && terminalCommands[first[0]]) {
        const fn = terminalCommands[first[0]]
        fn(string.substring(first[0].length))
        event.preventDefault()
        terminalElement.style.display = "none"
        terminalElement.innerHTML = ""
      }
      else {
        try {
          eval(string)
          if (!getCtrlKey(event)) {
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
  print(sessionState)
})

document.addEventListener('paste', (event) => {
  console.log(event)
  const clipboardText = event.clipboardData.getData('text')
  console.log(clipboardText.substring(0, 2))
  if (clipboardData) {
    if (clipboardText.replaceAll(/\r/g, "") == clipboardData.text) {
      pasteBlocks()
      event.preventDefault()
      return
    }
  } else clipboardData = undefined
  if (clipboardText.substring(0, 2) === "- ") {
    console.log('Pasting Markdown')
    insertMdIntoBloc(clipboardText, sessionState.focusId, 0)
    commit()
    event.preventDefault()
  }
})

const navigateDropdownWithKeyboard = (parent, list, cache, focused, event) => {
  // todo factor this so the same logic works on search all, block, title, and template
  const moveDirection = ((event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey)) && -1) ||
    ((event.key === "ArrowDown" || event.key === "Tab") && 1)
  if (moveDirection) {
    const siblingToMoveTo = moveDirection === -1 ? focused.previousElementSibling : focused.nextElementSibling
    if (siblingToMoveTo) {
      siblingToMoveTo.dataset.selected = "true"
      focusSuggestion = siblingToMoveTo
      delete focused.dataset.selected
    } else {
      const oldIdx = parseInt(list.dataset.resultStartIdx)
      const newIdx = clamp(oldIdx + moveDirection * SEARCH_RESULT_LENGTH, 0, cache.length - SEARCH_RESULT_LENGTH)
      renderResultSet(store, parent, cache, list, newIdx)
      if (moveDirection === -1) {
        delete list.firstElementChild.dataset.selected
        list.lastElementChild.dataset.selected = true
      }
    }
    event.preventDefault()
  }
}


// The single event handler model has some problems. The cases need to appear in the same order they are nested in the DOM
// maybe this should be click instead of mousedown
document.addEventListener("mousedown", (event) => {
  if (event.button !== 0) {
    return
  }

  const clickedPageLink = getClosestPageLink(event.target)
  if (clickedPageLink) {
    goto("pageTitle", clickedPageLink.dataset.title, clickedPageLink.graphName)
    return
  }

  const closestBullet = event.target.closest(".block__bullet")

  if (event.target.className === "search-result") {
    if (event.target.dataset.title) {
      goto("pageTitle", event.target.dataset.title) // todo fix this failing on nested page links in non-edit mode
    } else {
      goto("block", event.target.dataset.id)
    }
    return
  } else if (event.target.id !== "search-input") {
    searchResultList.style.display = "none"
  }

  const closestBreadcrumbPage = event.target.closest(".breadcrumb-page")
  const closestBreadcrumbBlock = event.target.closest(".breadcrumb-block")

  // markup
  if (closestBullet) {
    goto("block", closestBullet.parentNode.dataset.id)
  } else if (event.target.className === "block-ref") {
    goto("block", event.target.dataset.id)
  } else if (event.target.className === "url") { // using spans with event handlers as links because they play nice with contenteditable
    followUrlElement(event.target)
    // everything else, so none of it triggers when user clicks markup
  } else if (event.target === topButtons["Download"]) {
    downloadHandler()
  } else if (event.target.className === "template__suggestion") {
    if (focusSuggestion) focusSuggestion.dataset.selected = false
    event.target.dataset.selected = true
    focusSuggestion = event.target
    expandTemplate()
  } else if (event.target === topButtons["Upload"]) {
    disconnectedFileInput.click()
  } else if (event.target === topButtons["Daily Notes"]) {
    goto("dailyNotes")
  } else if (event.target.className === "autocomplete__suggestion") {
    if (focusSuggestion) focusSuggestion.dataset.selected = false
    event.target.dataset.selected = true
    autocomplete()
  } else if (event.target === topButtons["Help"]) {
    goto("pageTitle", "Welcome to Micro Roam")
  } else if (closestBreadcrumbPage) {
    goto("pageTitle", closestBreadcrumbPage.dataset.title)
  } else if (closestBreadcrumbBlock) {
    goto("block", closestBreadcrumbBlock.dataset.id)
  } else if (event.target.className == "exit-to-main") {
    signupElement.style.display = "none"
    loginElement.style.display = "none"
  } else if (event.target.className === "command__suggestion") {
    execInlineCommand()
  } else if (event.target.className === "image-embed") {
    focusBlockStart(event.target.closest(".block"))
    // todo select the text corresponding to the image
    event.preventDefault()
  } else if (event.target.className === "todo-checkbox") {
    const checked = event.target.checked
    const newLink = checked ? "TODO" : "DONE"
    const block = event.target.closest(".block")
    const id = block.dataset.id

    const fe = event.target.closest('.compute')

    let string = store.blox[id].s
    string = string.substring(0, fe.startIdx) +
      "[[" + newLink + "]]" +
      string.substring(fe.endIdx)
    macros.write(id, string)
    event.preventDefault()
  } else if (event.target.id === "top-connect") {
    if (connectFrame.style.display === "none") { // todo make the "connect" button show loaded graphs
      connectFrame.style.display = "block"
      for (let otherStore in otherStores) {

      }
    } else connectFrame.style.display = "none"
  } else if (event.target.closest('.alias')) {
    const aliasHidden = event.target.closest('.alias').children[1]
    followLinkLike(aliasHidden.firstElementChild)
  }

  // this is at the bottom so that autocomplete suggestion click handler still knows where the link is. 
  // todo have better tracking of active block
})


const commonAncestorNode = (a, b) => {
  const aList = []
  while (a.dataset.id !== undefined) {
    aList.push(a.dataset.id)
    a = a.parentNode
    if (!a) break;
    a = a.parentNode
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
      const e = Math.max(aidx, bidx)
      return { root: b, startIdx: Math.max(Math.min(aidx, bidx), 0), endIdx: e === -1 ? parentChildIds.length : e, rooted: bidx === -1 || aidx === -1 }
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
    const can = commonAncestorNode(dragSelectStartBlock, blockNode)
    if (can) {
      dragSelect = can
      setDragSelected(true)
    }
  } else {
    dragSelect = null
  }
}

document.addEventListener("mousedown", (event) => {
  setDragSelected(false)
  dragSelect = null
  if (event.target.closest(".block")) {
    document.addEventListener("mousemove", mouseMoveListener)
    dragSelectStartBlock = event.target.closest(".block")
  }
})

document.addEventListener("mouseup", (event) => {
  if (dragSelectStartBlock !== null) {
    document.removeEventListener("mousemove", mouseMoveListener)
    dragSelectStartBlock = null
  }
})

document.addEventListener("selectionchange", (event) => {
  focusNode = getSelection().focusNode
  focusOffset = getSelection().focusOffset
  if (focusNode) {
    const currentFocusBlock = focusNode.parentNode.closest(".block")
    if (currentFocusBlock && canWriteToBlockNode(currentFocusBlock)) {
      sessionState.isFocused = true
      sessionState.position = (focusNode.startIdx || 0) + focusOffset
      if (focusNode.textContent.length === focusOffset) sessionState.position = focusNode.endIdx
      if (currentFocusBlock.dataset.id !== sessionState.focusId) {
        sessionState.focusId = currentFocusBlock.dataset.id
        focusIdPosition()
      }
      return
    }
  }
  sessionState.isFocused = false
})

// ID'ed ELEMENT EVENT LISTENERS ----------------------------------------------------------

const showTopBarFn = () => {
  user.s.topBar = "visible"
  saveUser()
}
let showTopBarTimeout = null

topBarHiddenHitbox.addEventListener("mouseover", () => {
  clearTimeout(showTopBarTimeout)
  showTopBarTimeout = setTimeout(showTopBarFn, 400)
})

topBarHiddenHitbox.addEventListener("mouseout", () => {
  clearTimeout(showTopBarTimeout)
  showTopBarTimeout = null
})

disconnectedFileInput.addEventListener('change', (event) => {
  const file = event.target.files[0]
  console.log(file)
  const { name, ext: extension } = splitFileName(file.name)
  console.log(`name ${name} extension ${extension}`)
  if (extension === "zip") {
    file.arrayBuffer().then((buffer) => {
      const files = zipToFiles(buffer)
      console.log(files)
      if (files.length === 1 && files[0].ext === "json") {
        setActiveStore(roamJsonToStore(files[0].name, files[0].text))
        preprocessImportedStore()
      } else {
        notifyText("Markdown import doesn't work yet. Upload a .json file, or a .zip file containing a .json file instead.", 12)
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
      user.s.graphName = name
      setActiveStore(roamJsonToStore(name, text))
      preprocessImportedStore()
    })
  } else if (extension === "br") {
    addGraphBloxBr(name, file)
  } else {
    notifyText("Traverse Text only accepts a .json file or .zip file containing 1 .json file") // add "md" once that works
  }
})

const preprocessImportedStore = async () => {
  await addGraph()
  start()
}


const topHamburgerClickOutsideListener = (event) => {
  if (event.target.closest("#options-frame")) return
  optionsFrame.style.display = 'none'
  document.removeEventListener('click', topHamburgerClickOutsideListener)
}
topHamburgerElement.addEventListener('click', (event) => {
  if (optionsFrame.style.display == 'block') {
    optionsFrame.style.display = 'none'
  } else {
    document.addEventListener('click', topHamburgerClickOutsideListener)
    optionsFrame.style.display = 'block'
    event.stopPropagation()
    event.preventDefault()
  }
})

topButtons["Sign Up"].addEventListener('click', (event) => {
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

switchToSignup.addEventListener('click', focusSignup)

switchToLogin.addEventListener('click', focusLogin)

const rwlClickOutListener = (event) => {
  console.log("rwlclick")
  if (event.target.closest('.really-want-to') === null) {
    reallyWantToLeaveElement.style.display = "none"
    document.removeEventListener('click', rwlClickOutListener)
  }
}

topButtons["Login"].addEventListener('click', focusLogin)

topButtons["Sign Out"].addEventListener('click', (event) => {
  if (isSynced()) reset()
  else {
    reallyWantToLeaveElement.style.display = "flex"
    document.addEventListener('click', (event) => rwlClickOutListener(event))
    event.stopPropagation()
  }
})

reallyWantToLeaveElement.children[0].addEventListener('click', reset)

// handle 
topButtons["Create New Graph"].addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    createAndSwitchToNewStore(event.target.value)
  }
})

topButtons["Create New Graph"].addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    createAndSwitchToNewStore(event.target.value)
  }
})

topButtons["Report Issue"].addEventListener("click", (event) => {
  // todo report issue
})