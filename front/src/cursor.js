const focusIdPosition = () => {
  focusBlockBody = document.querySelector(`.block[data-id="${sessionState.focusId}"]>.block__body`) // todo this looks wrong

  const scanElement = (element) => {
    for (let el of element.childNodes) {
      if (el.nodeName === "#text") {
        if (el.textContent && sessionState.position >= el.startIdx && sessionState.position < el.startIdx + el.textContent.length) {
          scanResult = el
          try {
            // this does the thing correctly, but then throws an error, which I catch? todo investigate
            getSelection().collapse(el,sessionState.position - el.startIdx)
            return el
          } catch (error) {
            return el
          }
        }
      } else {
        const z = scanElement(el)
        if (z) return z
      }
    }
  }
  scanElement(focusBlockBody)
}

const setFocusedBlockString = (string,diff) => {
  focusBlockBody.innerHTML = ""
  const fragment = document.createDocumentFragment()
  const refTitles = renderBlockBody(fragment,string)
  focusBlockBody.appendChild(fragment)
  focusIdPosition()
  updateCursorInfo()
  if (diff !== undefined) {
    commitEdit('df',sessionState.focusId,diff)
  } else {
    macros.write(sessionState.focusId,string)
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

// todo call this less. right now it's called twice as much as necessary, costing 0.3ms per keystroke and making code ugly
// todo also get rid of this entirely. it's a complete mess
const updateCursorInfo = () => {

  focusNode = getSelection().focusNode
  focusOffset = getSelection().focusOffset

  focusSuggestion = autocompleteList.querySelector(`.autocomplete__suggestion[data-selected="true"]`) || templateList.querySelector(`.template__suggestion[data-selected="true"]`) || inlineCommandList.querySelector(`.command__suggestion[data-selected="true"]`)

  focusSearchResult = searchResultList.querySelector(`.search-result[data-selected="true"]`)

  if (focusNode) {
    focusBlock = focusNode.parentNode.closest(".block")
    if (focusBlock) {

      sessionState.isFocused = true
      sessionState.focusId = focusBlock.dataset.id

      if (focusNode.className === "block__body") {
        sessionState.position = focusBlock.innerText.length * (focusOffset !== 0) // todo make this less jank
      } else {
        sessionState.position = focusOffset
        if (focusNode.startIdx) sessionState.position += focusNode.startIdx
      }
      focusBlockBody = focusBlock.children[1]

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

    } else
      sessionState.isFocused = false

  } else
    sessionState.isFocused = false

}


