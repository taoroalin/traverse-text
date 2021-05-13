// Event Listener Helpers -----------------------------------------------------------------------------------------------
/**
Event listeners are only placed on static ID'd elements and document.body
(no event listeners on dynamic generated content like blocks, pages)
this makes rendering faster (no need to attach listeners) and makes event handling faster because routing events on document.body to their appropriate sub-handler in JS is faster than using DOM event bubbling

this gives the codebase a very different feel than most codebases
you're always operating at global scope, "puppeteering" the DOM, never working from inside the DOM
 */
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
  idElements.templateList.style.display = "none"
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
  idElements.autocompleteList.style.display = "none"
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

const doAutocompletesIfApplicable = () => {
  if (editingCommandElement) {
    const matchingInlineCommands = matchInlineCommand(editingCommandElement.innerText.substring(1))
    renderResultSet(editingCommandElement, matchingInlineCommands, idElements.commandList, 0)
  }

  if (editingLink) {
    const matchingTitles = titleSearch(editingLink.dataset.title)
    renderResultSet(editingLink, matchingTitles, idElements.autocompleteList, 0)
  }

  if (editingTemplateExpander) {
    const editingTemplateText = editingTemplateExpander.innerText.substring(2)
    const matchingTemplates = searchTemplates(editingTemplateText)
    renderResultSet(editingTemplateExpander, matchingTemplates, idElements.templateList, 0)
  }
}

const cursorWriteText = (text, offset = 0) => {

  const oldString = store.blox[sessionState.focusId].s
  const newString = oldString.substring(0, sessionState.position) + text + oldString.substring(sessionState.position)
  sessionState.position += text.length + offset
  setFocusedBlockString(newString)

  updateCursorPosition()
  doAutocompletesIfApplicable()
}

const cursorRemoveText = (backward, forward) => {
  const oldString = store.blox[sessionState.focusId].s
  const newString = oldString.substring(0, sessionState.position - backward) + oldString.substring(sessionState.position + forward)
  sessionState.position -= backward
  setFocusedBlockString(newString)

  updateCursorPosition()
  doAutocompletesIfApplicable()
}

// Event listners --------------------------------------------------------------------------------------------------------
document.addEventListener("input", (event) => {
  if (sessionState.isFocused) {
    updateCursorPosition()
    if (focusBlockBody.innerText === " " || focusBlockBody.innerText === "") {
      macros.write(sessionState.focusId, "")
      return
    }

    // reparse block and insert cursor into correct position while typing

    const oldString = store.blox[sessionState.focusId].s
    let string = focusBlockBody.innerText

    console.log("STRING is " + string)
    let diff = { d: oldString, i: string }
    setFocusedBlockString(string, diff)

    doAutocompletesIfApplicable()

  } else if (event.target.id === "search-input") {
    const matchingTitles = fullTextSearch(event.target.value)
    renderResultSet(idElements.searchInput, matchingTitles, idElements.searchResultList, 0)

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
      if (idElements.topBar.style.marginTop === "0px") user.s.topBar = "hidden"
      else user.s.topBar = "visible"
      saveUser()
    }
  },
  "escape": {
    key: "Escape", fn: () => {
      idElements.autocompleteList.style.display = "none"
      idElements.templateList.style.display = "none"
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
      if (idElements.topBar.style.marginTop !== "0px") idElements.topBar.style.marginTop = "0px"
      idElements.searchInput.focus()
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
      if (idElements.terminal.style.display === "none") {
        idElements.terminal.style.display = "block"
        idElements.terminal.focus()
      } else {
        idElements.terminal.style.display = "none"
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
    // does this actually belong in global hotkeys? only applies in block
    key: "i", alt: true, fn: () => {
      const id = sessionState.focusId
      if (id)
        navigator.clipboard.writeText("((" + id + "))")
      else
        notifyText("no block focused, cannot copy block id")
    }
  },
  "move block to link": {
    key: "m", control: true, shift: true,
    fn: () => {
      updateCursorSpanInfo()
      if (!editingLink) {
        notifyText(`move the current block to the page link you're hovering. 
      No page link hovered `)
        return
      }

      const title = getPageTitleOfNode(editingLink)
      console.log(title)
      const newParentId = store.titles[title]
      if (!newParentId) {
        console.warn("dom page link without page!!!")
      }
      const currentPosition = editingLink.startIdx
      editingLink.outerHTML = ""
      const string = focusBlockBody.innerText

      // have to save cursor position because switching pages normally erasis this info
      const currentId = sessionState.focusId

      macros.nocommit.move(currentId, newParentId)
      macros.nocommit.write(currentId, string)
      commit()

      goto("pageTitle", title)

      sessionState.focusId = currentId
      sessionState.position = currentPosition

      focusIdPosition()
    }
  },
  "invert link": {
    key: "p", control: true, shift: true,// very temporary hotkey
    fn: () => {
      updateCursorSpanInfo()
      if (!editingLink) {
        notifyText(`move the current block to the page link you're hovering. 
      No page link hovered `)
        return
      }

      const title = getPageTitleOfNode(editingLink)
      const currentId = sessionState.focusId
      const newParentId = store.titles[title]
      if (!newParentId) {
        console.warn("dom page link without page!!!")
      }
      // could accelerate this by using innerT
      const newPageLink = "[[" + getPageOfBlocId(currentId) + "]]"
      const currentPosition = editingLink.startIdx + newPageLink.length
      editingLink.outerHTML = newPageLink
      const string = focusBlockBody.innerText

      // have to save cursor position because switching pages normally erasis this info

      macros.nocommit.move(currentId, newParentId)
      macros.nocommit.write(currentId, string)
      commit()

      goto("pageTitle", title)

      sessionState.focusId = currentId
      sessionState.position = currentPosition

      focusIdPosition()
    }
  },
  collapse: {
    key: "c", alt: true, fn: () => {
      if (!sessionState.isFocused) {
        notifyText(`Collapse children of current block. 
      No block focused`)
        return
      }

      toggleCollapsed(sessionState.focusId)
      focusIdPosition()
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
      return
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
    if (did) {
      event.preventDefault()
      return
    }
  }

  if (idElements.autocompleteList.style.display !== "none") {
    if (event.key === "Enter") {
      updateCursorSpanInfo()
      autocomplete()
      event.preventDefault()
      return
    }
    if (navigateDropdownWithKeyboard(editingLink, idElements.autocompleteList, titleSearchCache, focusSuggestion, event)) return
  }
  if (idElements.templateList.style.display !== "none") {
    if (event.key === "Tab" || event.key === "Enter") {
      expandTemplate()
      event.preventDefault()
      return
    }
    if (navigateDropdownWithKeyboard(editingTemplateExpander, idElements.templateList, templateSearchCache, focusSuggestion, event)) return
  }
  if (idElements.commandList.style.display !== "none") {
    if (event.key === "Tab" || event.key === "Enter") {
      execInlineCommand()
      event.preventDefault()
      return
    }
    if (navigateDropdownWithKeyboard(editingCommandElement, idElements.commandList, commandSearchCache, focusSuggestion, event)) return
  }
  if (sessionState.isFocused) {
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
        } else { // handling deleting a char here to save ~3ms vs catching it in onInput
          cursorRemoveText(1, 0)
          event.preventDefault()
        }
        break
      case "Delete":
        if (sessionState.position === store.blox[sessionState.focusId].s.length) {
        } else {
          cursorRemoveText(0, 1)
          event.preventDefault()
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
          updateCursorPosition()
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
          updateCursorPosition()
        }
        break
      case "c":
        if (getCtrlKey(event)) { // LEGITTODO copy md text and check paste text against, 
          clipboardData = null
        }
        break
      default:
        if (!event.altKey && !getCtrlKey(event) && getSelection().isCollapsed) {
          if (event.key.length === 1) {// check if it's a typeable char
            // need a more correct way to do this later
            switch (event.key) {
              case "[":
                const pageRefClosesMissingOpens = focusBlockBody.querySelectorAll(".page-ref-close-missing-open")
                let broke = false
                for (let x of pageRefClosesMissingOpens) {
                  if (x.childNodes[0].startIdx > sessionState.position) {
                    broke = true
                    break
                  }
                }
                if (!broke) {
                  cursorWriteText("[]", -1)
                  event.preventDefault()
                  return
                }
                break
              case "]":
                const string = store.blox[sessionState.focusId].s
                console.log(string[sessionState.position])
                if (string[sessionState.position] === "]") {
                  sessionState.position++
                  focusIdPosition()
                  event.preventDefault()
                  return
                }
                break
              default:
                cursorWriteText(event.key)
                event.stopPropagation()
                event.preventDefault()
                return
            }
          }
        }
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

    if (navigateDropdownWithKeyboard(idElements.searchInput, idElements.searchResultList, fullTextSearchCache, focusSuggestion, event)) return
  }

  if (idElements.terminal.style.display !== "none") {
    if (event.key === "Enter" && !getCtrlKey(event) && !event.shiftKey && !event.altKey) {
      const string = event.target.innerText
      const first = string.match(/^[a-z]+/)
      if (first && terminalCommands[first[0]]) {
        const fn = terminalCommands[first[0]]
        fn(string.substring(first[0].length))
        event.preventDefault()
        idElements.terminal.style.display = "none"
        idElements.terminal.innerHTML = ""
      }
      else {
        try {
          // wrap eval in function to avoid names leaking out
          function evalfunc() { eval(string) }
          evalfunc()

          if (!getCtrlKey(event)) {
            idElements.terminal.style.display = "none"
            idElements.terminal.innerHTML = ""
          }
        } catch (error) {
          console.log(error)
          event.preventDefault()
        }
      }
    }
  }
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
    return true // returning true to tell caller to return
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
    idElements.searchResultList.style.display = "none"
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
    idElements.signup.style.display = "none"
    idElements.login.style.display = "none"
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
      "[[" + newLink + "]]" + "}}" + // @todo make consistent endIndex that's either beginning of content or markup
      string.substring(fe.endIdx)
    macros.write(id, string)
    event.preventDefault()
  } else if (event.target.id === "top-connect") {
    if (idElements.connectFrame.style.display === "none") { // todo make the "connect" button show loaded graphs
      idElements.connectFrame.style.display = "block"
      for (let otherStore in otherStores) {

      }
    } else idElements.connectFrame.style.display = "none"
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

idElements.topBarHiddenHitbox.addEventListener("mouseover", () => {
  clearTimeout(showTopBarTimeout)
  showTopBarTimeout = setTimeout(showTopBarFn, 400)
})

idElements.topBarHiddenHitbox.addEventListener("mouseout", () => {
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
  idElements.optionsFrame.style.display = 'none'
  document.removeEventListener('click', topHamburgerClickOutsideListener)
}
idElements.topHamburger.addEventListener('click', (event) => {
  if (idElements.optionsFrame.style.display == 'block') {
    idElements.optionsFrame.style.display = 'none'
  } else {
    document.addEventListener('click', topHamburgerClickOutsideListener)
    idElements.optionsFrame.style.display = 'block'
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
  idElements.signup.style.display = "block"
  idElements.login.style.display = "none"
  idElements.signupEmail.focus()
}

const focusLogin = () => {
  idElements.login.style.display = "block"
  idElements.signup.style.display = "none"
  idElements.loginEmail.focus()
}

idElements.switchToSignup.addEventListener('click', focusSignup)

idElements.switchToLogin.addEventListener('click', focusLogin)

const rwlClickOutListener = (event) => {
  console.log("rwlclick")
  if (event.target.closest('.really-want-to') === null) {
    idElements.reallyWantToLeave.style.display = "none"
    document.removeEventListener('click', rwlClickOutListener)
  }
}

topButtons["Login"].addEventListener('click', focusLogin)

topButtons["Sign Out"].addEventListener('click', (event) => {
  if (isSynced()) reset()
  else {
    idElements.reallyWantToLeave.style.display = "flex"
    document.addEventListener('click', (event) => rwlClickOutListener(event))
    event.stopPropagation()
  }
})

idElements.reallyWantToLeave.children[0].addEventListener('click', reset)


topButtons["Create New Graph"].addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    createAndSwitchToNewStore(event.target.value)
  }
})

topButtons["Report Issue"].addEventListener("click", (event) => {
  // todo report issue
})