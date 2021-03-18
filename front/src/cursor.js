const focusIdPosition = () => {
  focusBlockBody = document.querySelector(`.block[data-id="${sessionState.focusId}"]>.block__body`)

  const scanElement = (element) => {
    for (let el of element.childNodes) {
      if (el.nodeName === "#text") {
        if (sessionState.position >= (el.startIdx || 0) && sessionState.position <= (el.startIdx || 0) + el.textContent.length) {
          scanResult = el
          const placeToGo = sessionState.position - el.startIdx
          console.log(`startIdx ${el.startIdx} togo ${placeToGo}`)
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
}

const setFocusedBlockString = (string, diff) => {
  let theString = string
  if (theString === undefined) {
    theString = store.blox[sessionState.focusId].s
  }

  focusBlockBody.innerHTML = ""
  renderBlockBodyToEdit(focusBlockBody, theString)
  focusIdPosition()
  updateCursorSpanInfo()
  if (diff !== undefined) {
    commitEdit('df', sessionState.focusId, diff)
  } else {
    macros.write(sessionState.focusId, theString)
  }
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

const resetFocusedBlockBody = () => {
  focusBlockBody.innerText = ""
  const oldBlockData = store.blox[sessionState.focusId]
  if (oldBlockData !== undefined) renderBlockBody(focusBlockBody, oldBlockData.s)
}

const updateFocusFromNode = (node, position) => {
  sessionState.isFocused = true
  if (focusBlockBody) {
    resetFocusedBlockBody()
  }
  if (position === -1) {
    position = store.blox[node.dataset.id].s.length
  }
  focusBlock = node
  focusBlockBody = focusBlock.children[1]
  sessionState.focusId = focusBlock.dataset.id
  sessionState.position = position

  const text = store.blox[sessionState.focusId].s
  focusBlockBody.innerText = ""
  renderBlockBodyToEdit(focusBlockBody, text)
  focusIdPosition()
  updateCursorSpanInfo()
}

const updateCursorSpanInfo = () => {
  editingLink = undefined
  const pageRefs = focusBlockBody.querySelectorAll(".page-ref")
  const tags = focusBlockBody.querySelectorAll(".tag")
  for (let tag of tags) {
    if (tag.childNodes[0].endIdx >= sessionState.position && tag.childNodes[0].startIdx < sessionState.position) {
      editingLink = tag
    }
  }
  for (let ref of pageRefs) {
    if (ref.children[1].childNodes[0].endIdx >= sessionState.position && ref.children[1].childNodes[0].startIdx < sessionState.position) {
      editingLink = ref
    }
  }
  editingTitle = editingLink && ((editingLink.className === "tag" && editingLink.innerText.substring(1)) || (editingLink.className === "page-ref" && editingLink.children[1].innerText))

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