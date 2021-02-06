const pageRefTemplate = document.getElementById("page-ref").content.firstElementChild
const tagTemplate = document.getElementById("tag").content.firstElementChild
const urlTemplate = document.getElementById("url").content.firstElementChild
const blockRefTemplate = document.getElementById("block-ref").content.firstElementChild

const renderBlockBody = (parent,text,cursorLocation) => {
  let stack = [parent]
  const doubleSquareBrackets = text.matchAll(/(\[\[)|(\]\])|(#[\/a-zA-Z0-9_-]+)|(\(\([a-zA-Z0-9\-_]+\)\))|(showtweethttps:\/\/twitter.com\/[a-zA-Z0-9_]{4,15}\/status\/[0-9]+)|((?:https?\:\/\/)(?:[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6})\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*))/g)
  let idx = 0
  for (let match of doubleSquareBrackets) {
    if (match.index > idx) {
      const textNode = document.createTextNode(
        text.substring(idx,match.index)
      )
      stack[stack.length - 1].appendChild(textNode)
    }
    if (match[1]) {
      const pageRefElement = pageRefTemplate.cloneNode(true)
      stack[stack.length - 1].appendChild(pageRefElement)
      stack.push(pageRefElement.children[1])
    } else if (match[2]) {
      if (stack.length > 1) {
        stack.pop()
      }
    } else if (match[3]) {
      const tagElement = tagTemplate.cloneNode(true)
      tagElement.innerText = match[3]
      stack[stack.length - 1].appendChild(tagElement)
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
          stack[stack.length - 1].appendChild(blockRefElement)
        } else {
          const textNode = document.createTextNode(match[0])
          stack[stack.length - 1].appendChild(textNode)
        }
      }
    } else if (match[5]) {
      embedTweet(stack[stack.length - 1],match[5])
    } else if (match[6]) {
      const urlElement = urlTemplate.cloneNode(true)
      urlElement.innerText = match[6]
      urlElement.href = match[6]
      stack[stack.length - 1].appendChild(urlElement)
    }
    idx = match.index + match[0].length
  }
  if (idx < text.length) {
    const textNode = document.createTextNode(text.substring(idx))
    stack[stack.length - 1].appendChild(textNode)
  }
}
