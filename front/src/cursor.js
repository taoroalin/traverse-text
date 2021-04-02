const prepFocusIdForCursor = () => {
  if (focusBlock &&
    focusBlock.isConnected &&
    focusBlock.dataset.id !== sessionState.focusId) {

    focusBlockBody.textContent = ""
    renderBlockBody(focusBlockBody, store.blox[focusBlock.dataset.id].s)
  }

  focusBlock = document.querySelector(`.block[data-id="${sessionState.focusId}"]`)
  focusBlockBody = focusBlock.children[1]

  if (focusBlock === undefined) {
    throw new Error(`tried to focus block that doesn't exist: ${sessionState.focusId}`)
  }

  sessionState.isFocused = true

  const text = store.blox[sessionState.focusId].s
  focusBlockBody.innerText = ""
  renderBlockBody(focusBlockBody, text, true)
}

const focusIdPosition = () => {
  prepFocusIdForCursor()

  const scanElement = (element) => {
    for (let el of element.childNodes) {
      if (el.nodeName === "#text") {
        if (sessionState.position >= (el.startIdx || 0) && sessionState.position <= (el.startIdx || 0) + el.textContent.length) {
          scanResult = el
          const placeToGo = sessionState.position - el.startIdx
          // console.log(`startIdx ${el.startIdx} togo ${placeToGo}`)
          getSelection().collapse(el, placeToGo)
          return el
        }
      } else {
        const z = scanElement(el)
        if (z) return z
      }
    }
  }
  scanElement(focusBlockBody)
  updateCursorSpanInfo()
}

const selectIdWholeNode = (node) => {
  prepFocusIdForCursor()

  //todo ......

  updateCursorSpanInfo()
}

const setFocusedBlockString = (string, diff) => {
  let theString = string
  if (theString === undefined) {
    theString = store.blox[sessionState.focusId].s
  }

  if (diff !== undefined) {
    commitEdit('df', sessionState.focusId, diff)
  } else {
    macros.write(sessionState.focusId, theString)
  }

  focusIdPosition()
}

const getEditingSimpleSpan = (className) => {
  const elements = focusBlockBody.querySelectorAll("." + className)
  for (let temp of elements) {
    if (temp.childNodes[0].endIdx >= sessionState.position && temp.childNodes[0].startIdx < sessionState.position) {
      return temp
    }
  }
}


const updateCursorPosition = () => {
  focusNode = getSelection().focusNode
  focusOffset = getSelection().focusOffset
  const block = focusNode.parentNode.closest(".block")
  sessionState.focusId = block.dataset.id
  sessionState.position = (focusNode.startIdx || 0) + focusOffset
}

const updateCursorSpanInfo = () => {
  editingLink = undefined
  const tags = focusBlockBody.querySelectorAll(".tag")
  for (let tag of tags) {
    if (tag.children[1].firstChild.endIdx >= sessionState.position && tag.children[0].firstChild.startIdx < sessionState.position) {
      editingLink = tag
    }
  }
  const pageRefs = focusBlockBody.querySelectorAll(".page-ref")
  for (let ref of pageRefs) {
    if (ref.children[2].firstChild.endIdx >= sessionState.position && ref.children[1].firstChild.startIdx < sessionState.position) {
      editingLink = ref
    }
  }
  editingTitle = editingLink && editingLink.title

  editingTemplateExpander = getEditingSimpleSpan("template-expander")

  editingUrlElement = getEditingSimpleSpan("url")

  editingCommandElement = getEditingSimpleSpan("command")
  if (editingCommandElement === undefined)
    inlineCommandList.style.display = "none"
  if (editingTemplateExpander === undefined)
    templateList.style.display = "none"
  if (editingLink === undefined)
    autocompleteList.style.display = "none"
}


const focusBlockEnd = (blockNode) => {
  sessionState.focusId = blockNode.dataset.id
  sessionState.position = store.blox[sessionState.focusId].s.length
  focusIdPosition()
}

const focusBlockStart = (blockNode) => {
  sessionState.focusId = blockNode.dataset.id
  sessionState.position = 0
  focusIdPosition()
}

const focusBlockVerticalOffset = (offset, block = focusBlock, start = false) => { // this closure feels weird, maybe shoudn't use this language feature?
  const blocks = Array.from(document.querySelectorAll(".block"))
  const newActiveBlock = blocks[blocks.indexOf(block) + offset]
  if (newActiveBlock) {
    newActiveBlock.scrollIntoView({ block: 'nearest', inline: 'nearest' })

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


const getClosestPageLink = (node) => {
  return node.closest(".tag") || node.closest(".attribute") || node.closest(".page-ref")
}

const getPageTitleOfNode = (node) => {
  const linkNode = getClosestPageLink(node)
  return linkNode && linkNode.title
}
