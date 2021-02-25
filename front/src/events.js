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

const dailyNotesInfiniteScrollListener = () => {
  const fromBottom =
    pageFrame.getBoundingClientRect().bottom - innerHeight
  if (fromBottom < 700) {
    for (let i = 0; i < 100; i++) {
      sessionState.oldestDate.setDate(sessionState.oldestDate.getDate() - 1)
      const daysNotes = store.pagesByTitle[formatDate(sessionState.oldestDate)]
      if (daysNotes) {
        renderPage(pageFrame,daysNotes)
        pageFrame.appendChild(pageBreakTemplate.cloneNode(true))
        break
      }
    }
  }
}

const downloadHandler = () => {
  console.log("download")
  const json = storeToRoamJSON(store)
  const data = new Blob([json],{ type: 'text/json' })
  const url = URL.createObjectURL(data)
  downloadButton.setAttribute('href',url)
  downloadButton.setAttribute('download',`${store.graphName}-micro-roam.json`)
}

const expandTemplate = () => {
  const id = focusSuggestion.dataset.id
  const block = store.blocks[sessionState.focusId]
  if (block.children === undefined || block.children.length === 0) {
    const parentId = store.blocks[sessionState.focusId].parent
    const childIds = store.blocks[id].children
    const currentIdx = blockOrPageFromId(parentId).children.indexOf(sessionState.focusId)
    runCommand("deleteBlock",sessionState.focusId)
    const parentNode = focusBlock.parentNode
    focusBlock.remove()
    for (let i = 0; i < childIds.length; i++) {
      const childId = childIds[i]
      const idx = currentIdx + i
      const newId = runCommand("copyBlock",childId,parentId,idx)
      const e = renderBlock(parentNode,newId,idx)
      if (i === 0) {
        focusBlockEnd(e)
      }
    }
  } else
    notifyText("can't use a template inside a block that has children")
  templateList.style.display = "none"
}

const pasteBlocks = () => {
  const parentId = store.blocks[sessionState.focusId].parent
  let currentIdx = blockOrPageFromId(parentId).children.indexOf(sessionState.focusId)
  const parentNode = focusBlock.parentNode
  if (focusBlockBody.innerText === "") {
    runCommand("deleteBlock",sessionState.focusId)
    focusBlock.remove()
  } else {
    currentIdx += 1
  }

  if (clipboardData.dragSelect.rooted) {
    const newId = runCommand("copyBlock",clipboardData.dragSelect.root,parentId,currentIdx)
    const e = renderBlock(parentNode,newId,currentIdx)
    focusBlockEnd(e)
  } else {
    let lastNode = null
    for (let i = 0; i < clipboardData.dragSelect.endIdx + 1 - clipboardData.dragSelect.startIdx; i++) {
      const blockId = blockOrPageFromId(clipboardData.dragSelect.root).children[i + clipboardData.dragSelect.startIdx]
      const newId = runCommand("copyBlock",blockId,parentId,i + currentIdx)
      const e = renderBlock(parentNode,newId,i + currentIdx)
      lastNode = e
    }
    focusBlockEnd(lastNode)
  }
}

const autocomplete = () => {
  const origString = store.blocks[sessionState.focusId].string
  if (editingLink.className === "tag") {
    const textNode = editingLink.childNodes[0]
    // check for the exact inverse of regex test to see if this would be a valid tag, otherwise make it a ref
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
    const idx = blockOrPageFromId(newParentId).children.length
    runCommand("moveBlock",bid,newParentId,idx)
    olderSibling.children[2].appendChild(focusBlock)
    getSelection().collapse(focusNode,focusOffset)
  }
}

const dedentFocusedBlock = () => {
  const bid = sessionState.focusId
  const parentId = store.blocks[bid].parent
  const parentBlock = store.blocks[parentId]
  if (parentBlock) {
    const grandparentId = parentBlock.parent
    const grandparent = blockOrPageFromId(grandparentId)
    const idx = grandparent.children.indexOf(parentId)
    runCommand("moveBlock",bid,grandparentId,idx + 1)

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

document.addEventListener("input",(event) => {
  updateCursorInfo()
  autocompleteList.style.display = "none"
  templateList.style.display = "none"
  if (sessionState.isFocused) {

    if (focusBlockBody.innerText === " " || focusBlockBody.innerText === "") {
      runCommand("writeBlock",sessionState.focusId,"",[])
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
    }
    store.blocks[sessionState.focusId].string = string // todo commit changes on word boundaries

    setFocusedBlockString(string)

    if (editingTitle) {
      const matchingTitles = titleExactFullTextSearch(editingTitle)
      if (matchingTitles.length > 0) {
        autocompleteList.innerHTML = ""
        autocompleteList.style.display = "block"
        const rect = editingLink.getBoundingClientRect()
        autocompleteList.style.top = rect.bottom
        autocompleteList.style.left = rect.left

        for (let i = 0; i < matchingTitles.length; i++) {
          matchingTitle = matchingTitles[i]
          const suggestion = suggestionTemplate.cloneNode(true)
          if (i === 0) suggestion.dataset.selected = "true"
          suggestion.dataset.id = matchingTitle.id

          if (matchingTitle.title) {
            suggestion.dataset.title = matchingTitle.title
            suggestion.innerText = truncateElipsis(matchingTitle.title,50)
          } else {
            suggestion.dataset.string = matchingTitle.string
            suggestion.innerText = truncateElipsis(matchingTitle.string,50)
          }
          autocompleteList.appendChild(suggestion)
        }
      }
    }

    if (editingTemplateExpander) {
      console.log("editingTemplateExpander")
      const editingTemplateText = editingTemplateExpander.innerText.substring(2)
      const matchingTemplates = searchTemplates(editingTemplateText)
      console.log(matchingTemplates)
      if (matchingTemplates.length > 0) {
        templateList.innerHTML = ""
        for (let i = 0; i < Math.min(matchingTemplates.length,10); i++) {
          const result = templateSuggestionTemplate.cloneNode(true)
          if (i === 0) {
            result.dataset.selected = "true"
          }
          result.dataset.string = matchingTemplates[i].string
          result.dataset.id = matchingTemplates[i].id
          result.innerText = truncateElipsis(matchingTemplates[i].string,50)
          templateList.appendChild(result)
        }
        templateList.style.display = "block"
        templateList.style.top = editingTemplateExpander.getBoundingClientRect().bottom
        templateList.style.left = editingTemplateExpander.getBoundingClientRect().left
      }
    }

  } else if (event.target.id === "search-input") {
    const matchingTitles = exactFullTextSearch(event.target.value)
    if (matchingTitles.length > 0) {
      searchResultList.innerHTML = ""
      for (let i = 0; i < Math.min(matchingTitles.length,10); i++) {
        const result = searchResultTemplate.cloneNode(true)
        if (i === 0) {
          result.dataset.selected = "true"
        }
        if (matchingTitles[i].title) {
          result.dataset.title = matchingTitles[i].title
          result.innerText = truncateElipsis(matchingTitles[i].title,50)
        } else {
          result.dataset.string = matchingTitles[i].string
          result.dataset.id = matchingTitles[i].id
          result.innerText = truncateElipsis(matchingTitles[i].string,50)
        }
        searchResultList.appendChild(result)
      }
      searchResultList.style.display = "block"
      searchResultList.style.top = searchInput.getBoundingClientRect().bottom
      searchResultList.style.left = searchInput.getBoundingClientRect().left
    } else {
      searchResultList.style.display = "none"
    }

  } else if (event.target.className === "page__title") {
    console.log("edit title")
    const pageId = event.target.parentNode.dataset.id
    runCommand("writePageTitle",pageId,event.target.innerText)
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
        user.theme = "dark"
        saveUser()
      } else {
        user.theme = "light"
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
    key: "o",control: true,fn: () => {
      if (editingLink && editingLink.className === "page-ref")
        goto("pageTitle",editingLink.children[1].innerText)
      if (editingLink && editingLink.className === "tag")
        goto("pageTitle",editingLink.innerText.substring(1))
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
      hotkey.fn()
      event.preventDefault()
      return
    }
  }

  if (dragSelect) {
    if (event.key === "c" && event.ctrlKey) {
      console.log("copy blocks")
      clipboardData = {
        dragSelect: {
          root: dragSelect.root.dataset.id,
          startIdx: dragSelect.startIdx,
          endIdx: dragSelect.endIdx,
          rooted: dragSelect.rooted
        },
      }
      event.preventDefault()
    }
  } else if (autocompleteList.style.display !== "none") {
    if (event.key === "Tab" || event.key === "Enter") {
      autocomplete()
      event.preventDefault()
    }
    const newSelected = (event.key === "ArrowUp" && focusSuggestion.previousElementSibling) || (event.key === "ArrowDown" && focusSuggestion.nextElementSibling)
    if (newSelected) {
      newSelected.dataset.selected = "true"
      delete focusSuggestion.dataset.selected
      event.preventDefault()
    }
  } else if (templateList.style.display !== "none") {
    if (event.key === "Tab" || event.key === "Enter") {
      expandTemplate()
      event.preventDefault()
    }
    const newSelected = (event.key === "ArrowUp" && focusSuggestion.previousElementSibling) || (event.key === "ArrowDown" && focusSuggestion.nextElementSibling)
    if (newSelected) {
      newSelected.dataset.selected = "true"
      delete focusSuggestion.dataset.selected
      event.preventDefault()
    }
  } else if (sessionState.isFocused) {
    let blocks
    let newActiveBlock
    switch (event.key) {
      case "Enter":
        if (!event.shiftKey) {
          const parent = blockOrPageFromId(store.blocks[sessionState.focusId].parent)
          let idx = parent.children.indexOf(sessionState.focusId)
          if (!event.ctrlKey) {
            idx += 1
          }
          console.log(idx)
          const newBlockUid = runCommand("createBlock",store.blocks[sessionState.focusId].parent,idx)
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
          blocks = Array.from(document.querySelectorAll(".block"))
          newActiveBlock = blocks[blocks.indexOf(focusBlock) - 1]
          focusBlock.remove()
          focusBlockEnd(newActiveBlock)
          runCommand("deleteBlock",sessionState.focusId)
          event.preventDefault()
        }
        break
      case "ArrowDown":
        if (event.altKey && event.shiftKey) {
          const parentId = store.blocks[sessionState.focusId].parent
          const parentElement = focusBlock.parentNode
          const currentIdx = blockOrPageFromId(parentId).children.indexOf(sessionState.focusId)
          if (focusBlock.nextElementSibling) {
            runCommand("moveBlock",sessionState.focusId,parentId,currentIdx + 1)
            if (focusBlock.nextElementSibling.nextElementSibling) {
              parentElement.insertBefore(focusBlock,focusBlock.nextElementSibling.nextElementSibling)
            } else parentElement.appendChild(focusBlock)
            getSelection().collapse(focusNode,focusOffset)
            event.preventDefault()
          }
        } else if (!event.shiftKey && !event.altKey) {
          blocks = Array.from(document.querySelectorAll(".block"))
          newActiveBlock = blocks[blocks.indexOf(focusBlock) + 1]
          focusBlockStart(newActiveBlock)
          event.preventDefault()
        }
        break
      case "ArrowUp":
        if (event.altKey && event.shiftKey) {
          const parentId = store.blocks[sessionState.focusId].parent
          const parentElement = focusBlock.parentNode
          const currentIdx = blockOrPageFromId(parentId).children.indexOf(sessionState.focusId)
          if (focusBlock.previousElementSibling) {
            runCommand("moveBlock",sessionState.focusId,parentId,currentIdx - 1)
            parentElement.insertBefore(focusBlock,focusBlock.previousElementSibling)
            getSelection().collapse(focusNode,focusOffset)
            event.preventDefault()
          }
        } else if (!event.shiftKey && !event.altKey) {
          blocks = Array.from(document.querySelectorAll(".block"))
          newActiveBlock = blocks[blocks.indexOf(focusBlock) - 1]
          focusBlockEnd(newActiveBlock)
          event.preventDefault()
        }
        break
      case "ArrowLeft":
        if (event.shiftKey && event.altKey) {
          dedentFocusedBlock()
        } else if (sessionState.position === 0) {
          blocks = Array.from(document.querySelectorAll(".block"))
          newActiveBlock = blocks[blocks.indexOf(focusBlock) - 1]
          focusBlockEnd(newActiveBlock)
          event.preventDefault()
        }
        break
      case "ArrowRight":
        if (event.shiftKey && event.altKey) {
          indentFocusedBlock()
        } else if (sessionState.position === focusBlockBody.innerText.length) {
          blocks = Array.from(document.querySelectorAll(".block"))
          newActiveBlock = blocks[blocks.indexOf(focusBlock) + 1]
          if (newActiveBlock) focusBlockStart(newActiveBlock)
          event.preventDefault()
        }
        break
      case "v":
        if (event.ctrlKey) {
          if (clipboardData) {
            pasteBlocks()
            event.preventDefault
          }
        }
        break
      case "c":
        if (event.ctrlKey) {
          clipboardData = null
        }
        break
    }
  }

  if (
    document.activeElement &&
    document.activeElement.id === "search-input"
  ) {
    if (event.key === "Enter") {
      goto("pageTitle",event.target.value)
      event.preventDefault()
      return
    } else if (event.key === "Tab") {
      const selected = searchResultList.querySelector(`.search-result[data-selected="true"]`)
      if (selected) {
        if (selected.dataset.title) {
          goto("pageTitle",selected.dataset.title)
        } else {
          goto("block",selected.dataset.id)
        }
        return
      }
    }
  }

  if (terminalElement.style.display !== "none") {
    if (event.key === "Enter" && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      const tc = terminalCommands[event.target.innerText]
      if (tc) tc()
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


// The single event handler model has some problems. The cases need to appear in the same order they are nested in the DOM
document.addEventListener("click",(event) => {

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
  if (event.target.className === "page-ref__body") {
    goto("pageTitle",event.target.innerText)
  } else if (closestBullet) {
    goto("block",closestBullet.parentNode.dataset.id)
  } else if (event.target.className === "block-ref") {
    goto("block",event.target.dataset.id)
  } else if (event.target.className === "url") { // using spans with event handlers as links because they play nice with contenteditable
    const link = document.createElement("a")
    link.target = "_blank"
    link.href = event.target.innerText
    link.click()
  } else if (event.target.closest(".tag")) {
    goto("pageTitle",event.target.closest(".tag").innerText.substring(1))
  } else if (event.target.id === "download-button") {
    downloadHandler()

    // everything else, so none of it triggers when user clicks markup
  } else if (event.target.className === "template__suggestion") {
    if (focusSuggestion) focusSuggestion.dataset.selected = false
    event.target.dataset.selected = true
    focusSuggestion = event.target
    expandTemplate()
  } else if (event.target.id === "upload-button") {
    document.getElementById("upload-input").click()
  } else if (event.target.id === "daily-notes-button") {
    goto("dailyNotes")
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
      const parentChildIds = blockOrPageFromId(b.dataset.id).children
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
      const children = dragSelect.root.children[dragSelect.root.className === "page" ? 1 : 2].children
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


topBarHiddenHitbox.addEventListener("mouseover",() => {
  user.topBar = "visible"
  saveUser()
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
    notifyText("Micro Roam only accepts a .json file, a .zip file containing 1 .json file, or a .zip file containing .md files")
  }
})

const preprocessNewStore = () => {
  attemptToUnCorruptStore() // todo get to the bottom of corrupt stores (links to nowhere)
  startCommand = ["dailyNotes"]
  fetch("./default-store.json").then(text => text.json().then(json => {
    mergeStore(json)
    theresANewStore()
  }))
}
