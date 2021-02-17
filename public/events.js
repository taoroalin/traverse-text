// Event Listener Helpers -----------------------------------------------------------------------------------------------

const updateCursorInfo = () => {
  focusedNode = getSelection().focusNode
  focusOffset = getSelection().focusOffset
  focusedBlock = focusedNode && focusedNode.parentNode.closest(".block")
  focusedBlockBody = focusedBlock && focusedBlock.children[1]
  cursorPositionInBlock = focusedBlock && getCursorPositionInBlock()
  editingLink = focusedBlock && getCurrentLink()
  editingTitle = editingLink && ((editingLink.className === "tag" && editingLink.innerText.substring(1)) || (editingLink.className === "page-ref" && editingLink.children[1].innerText))
}

const getCursorPositionInBlock = () => {
  const selection = getSelection()
  const focusNode = selection.focusNode
  if (focusNode.className === "block__body") {
    const jankReturn = focusedBlock.innerText.length * (focusOffset !== 0) // todo make this less jank
    return jankReturn
  } else {
    let position = selection.focusOffset
    if (focusNode.startIdx) position += focusNode.startIdx
    return position
  }
}

const getCurrentLink = () => {
  const pageRefs = focusedBlockBody.querySelectorAll(".page-ref")
  const tags = focusedBlockBody.querySelectorAll(".tag")
  let result = null
  for (let tag of tags) {
    if (tag.childNodes[0].endIdx >= cursorPositionInBlock && tag.childNodes[0].startIdx < cursorPositionInBlock) {
      result = tag
    }
  }
  for (let ref of pageRefs) {
    if (ref.children[1].childNodes[0].endIdx >= cursorPositionInBlock && ref.children[1].childNodes[0].startIdx < cursorPositionInBlock) {
      result = ref
    }
  }
  return result
}

const dailyNotesInfiniteScrollListener = () => {
  const fromBottom =
    pageFrame.getBoundingClientRect().bottom - innerHeight
  if (fromBottom < 700) {
    for (let i = 0; i < 100; i++) {
      oldestLoadedDailyNoteDate.setDate(oldestLoadedDailyNoteDate.getDate() - 1)
      const daysNotes = store.pagesByTitle[formatDate(oldestLoadedDailyNoteDate)]
      if (daysNotes) {
        renderPage(pageFrame,daysNotes)
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


// TODO make focusBlockStart ect get past the last 1 char
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

const autocomplete = (selected) => {
  const bid = focusedBlock.dataset.id
  if (selected === undefined) selected = autocompleteList.querySelector(`.autocomplete__suggestion[data-selected="true"]`)
  const origString = store.blocks[bid].string
  if (editingLink.className === "tag") {
    const textNode = editingLink.childNodes[0]
    if (/[^\/a-zA-Z0-9_-]/.test(selected.dataset.title)) { // this is exact inverse of regex test for tag token, to see if this must be a tag
      const string = origString.slice(0,textNode.startIdx) + "[[" + selected.dataset.title + "]]" + origString.slice(textNode.endIdx)
      const refTitles = renderBlockBodyWithCursor(focusedBlockBody,string,textNode.startIdx + selected.dataset.title.length + 4)
      runCommand("writeBlock",bid,string,refTitles)
    } else {
      const string = origString.slice(0,textNode.startIdx) + "#" + selected.dataset.title + origString.slice(textNode.endIdx)
      const refTitles = renderBlockBodyWithCursor(focusedBlockBody,string,textNode.startIdx + selected.dataset.title.length + 1)
      runCommand("writeBlock",bid,string,refTitles)
    }
  } else {
    const textNode = editingLink.children[1].childNodes[0]
    const string = origString.slice(0,textNode.startIdx) + selected.dataset.title + origString.slice(textNode.endIdx)
    const refTitles = renderBlockBodyWithCursor(focusedBlockBody,string,textNode.startIdx + selected.dataset.title.length + 2)
    runCommand("writeBlock",bid,string,refTitles)
  }
  autocompleteList.style.display = "none"
}

const indentFocusedBlock = () => {
  const bid = focusedBlock.dataset.id
  const olderSibling = focusedBlock.previousSibling
  if (olderSibling && olderSibling.dataset && olderSibling.dataset.id) {
    const newParentId = olderSibling.dataset.id
    const idx = blockOrPageFromId(newParentId).children.length
    runCommand("moveBlock",bid,newParentId,idx)
    olderSibling.children[2].appendChild(focusedBlock)
    getSelection().collapse(focusedNode,focusOffset)
  }
}

const dedentFocusedBlock = () => {
  const bid = focusedBlock.dataset.id
  const parent = focusedBlock.parentNode.parentNode
  if (parent) {
    const grandparentChildren = parent.parentNode
    const grandparent = parent.parentNode.parentNode
    const grandparentId = grandparent.dataset.id
    const cousin = parent.nextSibling
    if (grandparentId) {
      if (cousin) {
        grandparentChildren.insertBefore(focusedBlock,cousin)
      } else {
        grandparentChildren.appendChild(focusedBlock)
      }
      const idx = blockOrPageFromId(grandparentId).children.indexOf(bid)
      runCommand("moveBlock",bid,grandparentId,idx + 1)
      getSelection().collapse(focusedNode,focusOffset)
    }
  }
}

// Global event listeners that switch on active element, as a possibly more performant, simpler option than propagating through multiple event handlers

// Event listener functions that can't be written inline because multiple triggers / disconnect / reconnect

document.addEventListener("input",(event) => {
  updateCursorInfo()
  if (focusedBlock) {
    const blockBody = focusedBlockBody
    const id = blockBody.parentNode.dataset.id
    if (blockBody.innerText === " " || blockBody.innerText === "") {
      runCommand("writeBlock",id,"",[])
      return
    }
    // reparse block and insert cursor into correct position while typing

    let string = blockBody.innerText
    store.blocks[id].string = string // todo commit changes on word boundaries

    const refTitles = renderBlockBodyWithCursor(blockBody,string,cursorPositionInBlock)
    runCommand("writeBlock",id,string,refTitles)

    updateCursorInfo()

    // Autocomplete
    // could do this here, or in scanElement, or in renderBlockBody
    if (editingTitle) {
      const matchingTitles = titleExactFullTextSearch(editingTitle)
      if (matchingTitles.length > 0) {
        autocompleteList.innerHTML = ""
        for (let i = 0; i < Math.min(matchingTitles.length,10); i++) {
          const suggestion = suggestionTemplate.cloneNode(true)
          if (i === 0) {
            suggestion.dataset.selected = "true"
          }
          if (matchingTitles[i].title) {
            suggestion.dataset.id = matchingTitles[i].id
            suggestion.dataset.title = matchingTitles[i].title
            suggestion.innerText = truncateElipsis(matchingTitles[i].title,50)
          }
          else {
            suggestion.dataset.id = matchingTitles[i].id
            suggestion.dataset.string = matchingTitles[i].string
            suggestion.innerText = truncateElipsis(matchingTitles[i].string,50)
          }
          autocompleteList.appendChild(suggestion)
        }
        autocompleteList.style.display = "block"
        autocompleteList.style.top = editingLink.getBoundingClientRect().bottom
        autocompleteList.style.left = editingLink.getBoundingClientRect().left
      } else {
        autocompleteList.style.display = "none"
      }
    } else {
      autocompleteList.style.display = "none"
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

document.addEventListener("keydown",(event) => {
  updateCursorInfo()

  if (event.key === "b" && event.ctrlKey && !event.shiftKey && !event.altKey) {
    topBar.style.display = topBar.style.display === "flex" ? "none" : "flex"
  } else if (event.key === "Tab" && autocompleteList.style.display !== "none" && focusedBlock) {
    autocomplete()
    event.preventDefault()
    // Check for global shortcut keys
  } else if (event.key === "Escape") {
    autocompleteList.style.display = "none"
    event.preventDefault()
  } else if (event.key === "z" && event.ctrlKey && !event.shiftKey) {

  } else if (event.key === "d" && event.ctrlKey) {
    document.getElementById("upload-input").click()
    event.preventDefault()
  } else if (event.key === "s" && event.ctrlKey && event.shiftKey) {
    downloadHandler()
    event.preventDefault()
  } else if (event.key === "s" && event.ctrlKey) {
    saveWorker.postMessage(["save",store])
    event.preventDefault()
  } else if (event.key === "m" && event.ctrlKey) {
    if (document.body.className === "light") {
      user.theme = "dark"
      saveUser()
    } else {
      user.theme = "light"
      saveUser()
    }
    event.preventDefault()
  } else if (event.key === "d" && event.altKey) {
    goto("dailyNotes")
    event.preventDefault()
  } else if (event.ctrlKey && event.key === "u") {
    if (topBar.style.display === "none") topBar.style.display = "flex"
    searchInput.focus()
    event.preventDefault()
  } else if (event.ctrlKey && event.key === "o") {
    if (editingLink && editingLink.className === "page-ref")
      goto("pageTitle",editingLink.children[1].innerText)
    if (editingLink && editingLink.className === "tag")
      goto("pageTitle",editingLink.innerText.substring(1))
    event.preventDefault()
  } else if (autocompleteList.style.display !== "none") {
    const selected = autocompleteList.querySelector(`.autocomplete__suggestion[data-selected="true"]`)
    if (selected) {
      const newSelected = (event.key === "ArrowUp" && selected.previousSibling) || (event.key === "ArrowDown" && selected.nextSibling)
      if (newSelected) {
        newSelected.dataset.selected = "true"
        delete selected.dataset.selected
        event.preventDefault()
      }
    }
  } else if (event.key === "i" && event.ctrlKey && event.altKey) {
    if (terminalElement.style.display === "none") {
      terminalElement.style.display = "block"
      terminalElement.focus()
      event.preventDefault()
    } else {
      terminalElement.style.display = "none"
    }

    // Check for actions based on active element
  } else if (focusedBlock) {
    let blocks
    let newActiveBlock
    const bid = focusedBlock.dataset.id
    switch (event.key) {
      case "Enter":
        if (event.shiftKey) {

        } else {
          const parent = blockOrPageFromId(store.blocks[bid].parent)
          let idx = parent.children.indexOf(bid)
          if (!event.ctrlKey) {
            idx += 1
          }
          const newBlockUid = runCommand("createBlock",store.blocks[bid].parent,idx)
          const newBlockElement = renderBlock(focusedBlock.parentNode,newBlockUid,idx)
          newBlockElement.children[1].focus()
          event.preventDefault()
        }
        break
      case "Tab":
        if (event.shiftKey) {
          dedentFocusedBlock()
        } else {
          indentFocusedBlock()
        }
        event.preventDefault()
        break
      case "Backspace":
        if (cursorPositionInBlock === 0) {
          blocks = Array.from(document.querySelectorAll(".block"))
          newActiveBlock = blocks[blocks.indexOf(focusedBlock) - 1]
          focusedBlock.remove()
          focusBlockEnd(newActiveBlock)
          runCommand("deleteBlock",bid)
          event.preventDefault()
        }
        break
      case "ArrowDown":
        if (event.altKey && event.shiftKey) {
          const parentId = store.blocks[bid].parent
          const parentElement = focusedBlock.parentNode
          const currentIdx = blockOrPageFromId(parentId).children.indexOf(bid)
          if (focusedBlock.nextSibling) {
            runCommand("moveBlock",bid,parentId,currentIdx + 1)
            if (focusedBlock.nextSibling.nextSibling) {
              parentElement.insertBefore(focusedBlock,focusedBlock.nextSibling.nextSibling)
            } else parentElement.appendChild(focusedBlock)
            getSelection().collapse(focusedNode,focusOffset)
            event.preventDefault()
          }
        } else if (!event.shiftKey && !event.altKey) {
          blocks = Array.from(document.querySelectorAll(".block"))
          newActiveBlock = blocks[blocks.indexOf(focusedBlock) + 1]
          focusBlockStart(newActiveBlock)
          event.preventDefault()
        }
        break
      case "ArrowUp":
        if (event.altKey && event.shiftKey) {
          const parentId = store.blocks[bid].parent
          const parentElement = focusedBlock.parentNode
          const currentIdx = blockOrPageFromId(parentId).children.indexOf(bid)
          if (focusedBlock.previousSibling) {
            runCommand("moveBlock",bid,parentId,currentIdx - 1)
            parentElement.insertBefore(focusedBlock,focusedBlock.previousSibling)
            getSelection().collapse(focusedNode,focusOffset)
            event.preventDefault()
          }
        } else if (!event.shiftKey && !event.altKey) {
          blocks = Array.from(document.querySelectorAll(".block"))
          newActiveBlock = blocks[blocks.indexOf(focusedBlock) - 1]
          focusBlockEnd(newActiveBlock)
          event.preventDefault()
        }
        break
      case "ArrowLeft":
        if (event.shiftKey && event.altKey) {
          dedentFocusedBlock()
        } else if (cursorPositionInBlock === 0) {
          blocks = Array.from(document.querySelectorAll(".block"))
          newActiveBlock = blocks[blocks.indexOf(focusedBlock) - 1]
          if (newActiveBlock) focusBlockEnd(newActiveBlock)
          event.preventDefault()
        }
        break
      case "ArrowRight":
        if (event.shiftKey && event.altKey) {
          indentFocusedBlock()
        } else if (cursorPositionInBlock === focusedBlockBody.innerText.length) {
          blocks = Array.from(document.querySelectorAll(".block"))
          newActiveBlock = blocks[blocks.indexOf(focusedBlock) + 1]
          if (newActiveBlock) focusBlockStart(newActiveBlock)
          event.preventDefault()
        }
        break
    }
  } else if (
    document.activeElement &&
    document.activeElement.id === "search-input"
  ) {
    if (event.key === "Enter") {
      goto("pageTitle",event.target.value)
      event.preventDefault()
      return
    } else if (event.key === "Tab") {
      console.log("goto suggestion")
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
  } else if (terminalElement.style.display !== "none") {
    if (event.key === "Enter" && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      eval(event.target.innerText)
      if (!event.ctrlKey) {
        terminalElement.style.display = "none"
        terminalElement.innerHTML = ""
      }
    }
  }
})

document.addEventListener("click",(event) => {


  const closestBullet = event.target.closest(".block__bullet")
  if (event.target.className === "page-ref__body") {
    goto("pageTitle",event.target.innerText)
  } else if (closestBullet) {
    goto("block",closestBullet.parentNode.dataset.id)
  } else if (event.target.className === "block-ref") {
    goto("block",event.target.dataset.id)
  } else if (event.target.closest(".tag")) {
    goto("pageTitle",event.target.closest(".tag").innerText.substring(1))
  } else if (event.target.id === "download-button") {
    downloadHandler()
  } else if (event.target.id === "upload-button") {
    document.getElementById("upload-input").click()
  } else if (event.target.id === "daily-notes-button") {
    goto("dailyNotes")
  } else if (event.target.className === "autocomplete__suggestion") {
    autocomplete(event.target)
  } else if (event.target.className === "search-result") {
    if (event.target.dataset.title) {
      goto("pageTitle",event.target.dataset.title)
    } else {
      goto("block",event.target.dataset.id)
    }
  } else if (event.target.className === "url") { // using spans with event handlers as links because they play nice with contenteditable
    const link = document.createElement("a")
    link.target = "_blank"
    link.href = event.target.innerText
    link.click()
  }

  // this is at the bottom so that autocomplete suggestion click handler still knows where the link is. 
  // todo have better tracking of active block
  updateCursorInfo()
})

document.getElementById('upload-input').addEventListener('change',(event) => {
  const file = event.target.files[0]
  graphName = file.name.substring(0,file.name.length - 5)
  file.text().then((text) => {
    store = roamJsonToStore(graphName,text)
    user.graphName = graphName
    saveUser()
    goto("dailyNotes")
    setTimeout(() => saveWorker.postMessage(["save",store]),0)
  })
})