const pageRefTemplate = document.getElementById("page-ref").content.firstElementChild
const tagTemplate = document.getElementById("tag").content.firstElementChild
const urlTemplate = document.getElementById("url").content.firstElementChild
const blockRefTemplate = document.getElementById("block-ref").content.firstElementChild
const boldTemplate = document.getElementById("bold").content.firstElementChild

const renderBlockBody = (parent,text) => {
  let stack = [parent]
  const matches = text.matchAll(/(\[\[)|(\]\])|(#[\/a-zA-Z0-9_-]+)|(\(\([a-zA-Z0-9\-_]+\)\))|(\*\*)|((?:https?\:\/\/)(?:[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6})\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*))/g)
  let idx = 0
  let stackTop = parent
  for (let match of matches) {
    if (match.index > idx) {
      const textNode = document.createTextNode(
        text.substring(idx,match.index)
      )
      stackTop.appendChild(textNode)
    }
    if (match[1]) {
      const pageRefElement = pageRefTemplate.cloneNode(true)
      stackTop.appendChild(pageRefElement)
      stack.push(pageRefElement.children[1])
      stackTop = stack[stack.length - 1]
    } else if (match[2]) {
      if (stack.length > 1) {
        stack.pop()
        stackTop = stack[stack.length - 1]
      }
    } else if (match[3]) {
      const tagElement = tagTemplate.cloneNode(true)
      tagElement.innerText = match[3]
      stackTop.appendChild(tagElement)
    } else if (match[4]) {
      // @query would use a query here if I had them
      const ae = database.vae[match[4].substring(2,match[4].length - 2)]
      if (ae) {
        const blockIds = ae.uid // todo find out why I get two results for uid
        if (blockIds) {
          const blockId = blockIds[0]
          const blockRefElement = blockRefTemplate.cloneNode(true)
          blockRefElement.innerText = database.eav[blockId].string
          blockRefElement.setAttribute("data-id",blockId)
          stackTop.appendChild(blockRefElement)
        } else {
          const textNode = document.createTextNode(match[0])
          stackTop.appendChild(textNode)
        }
      }
    } else if (match[5]) {
      if (stackTop.className === "bold") {
        stackTop.appendChild(document.createTextNode("**"))
        stack.pop()
        stackTop = stack[stack.length - 1]
      } else {
        const boldElement = boldTemplate.cloneNode(true)
        stackTop.appendChild(boldElement)
        boldElement.appendChild(document.createTextNode("**"))
        stack.push(boldElement)
        stackTop = boldElement
      }
    } else if (match[6]) {
      const urlElement = urlTemplate.cloneNode(true)
      urlElement.innerText = match[6]
      urlElement.href = match[6]
      stackTop.appendChild(urlElement)
    }
    idx = match.index + match[0].length
  }
  if (idx < text.length) {
    const textNode = document.createTextNode(text.substring(idx))
    stack[stack.length - 1].appendChild(textNode)
  }
  /**
   * PARSING REVELATION!!!!
   * Instead of backtracking and deleting when a block doesn't close, I can just erase the className of the block. Then it's still part of the tree but looks like it's gone! No performance cost!!
   */
  while (stackTop.className !== "block__body") {
    stackTop.className = ""
    stackTop = stackTop.parentNode
  }
}

