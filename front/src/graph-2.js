/**
there is an issue where if the font isn't loaded yet when this runs, this renders the wrong font, and it doesn't automatically rerender like dom does when font arrives */
const PI = Math.PI
const TAU = PI * 2
const halfPI = PI / 2
const charsToMeasure = `qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890!@#$%^&*()\`~-_=+[{\\|;:'",<.>/?}] `

const renderOverview = (parent, store) => {
  const canvas = templates.overview.cloneNode(true)
  parent.appendChild(canvas)
  const ctx = canvas.getContext("2d",)// could try out desynchronized option, and alpha:false option

  const ov = {
    baseFontSize: 20,
    baseFontHalfHeight: 0,
    textWidthLimit: 300,
    nodes: [],
    edges: [],
    ctx,
    canvas,
    viewBounds: [0, 0, 0, 0],
    exit: () => {
      canvas.remove()
    },
    renderEdges: () => {
      ov.ctx.strokeStyle = "#a7a7a7"
      ov.ctx.lineWidth = 1
      for (let [from, to] of ov.edges) {
        ov.ctx.beginPath()
        ov.ctx.moveTo(from.x, from.y)
        ov.ctx.lineTo(to.x, to.y)
        ov.ctx.stroke()
      }
    },
    renderRoundCorneredBox: (x, y, w, h, r = 4) => {
      const o = r * 0.8
      ov.ctx.beginPath()
      ov.ctx.moveTo(x - r, y)
      ov.ctx.quadraticCurveTo(x - o, y - o, x, y - r,)
      ov.ctx.lineTo(x + w, y - r)
      ov.ctx.quadraticCurveTo(x + w + o, y - o, x + w + r, y,)
      ov.ctx.lineTo(x + w + r, y + h)
      ov.ctx.quadraticCurveTo(x + w + o, y + h + o, x + w, y + h + r,)
      ov.ctx.lineTo(x, y + h + r)
      ov.ctx.quadraticCurveTo(x - o, y + h + o, x - r, y + h,)
      ov.ctx.closePath()
      ov.ctx.fill()
    },
    renderSharpBox: (x, y, w, h) => {
      ctx.fillRect(x, y, w, h)
    },
    renderTitles: () => {
      ov.ctx.fillStyle = "#111"
      ov.ctx.strokeStyle = "#111"
      for (let node of ov.nodes) {
        const textStartX = node.x - node.textHalfWidth
        const textStartY = node.y + ov.baseFontHalfHeight
        ov.renderRoundCorneredBox(textStartX, textStartY - ov.baseFontAscent, node.textHalfWidth * 2, (ov.baseFontAscent + ov.baseFontDescent) * node.textLines.length)
      }
      ov.ctx.fillStyle = "#ffffff"
      for (let node of ov.nodes) {
        const textStartX = node.x - node.textHalfWidth
        let textStartY = node.y + ov.baseFontHalfHeight
        for (let i = 0; i < node.textLines.length; i++) {
          const textLine = node.textLines[i]
          const lineWidth = node.textLineWidths[i]
          ov.ctx.fillText(textLine, textStartX + (node.textHalfWidth - lineWidth / 2), textStartY)
          textStartY += ov.baseFontAscent + ov.baseFontDescent
        }
      }
    },
    render: () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ov.renderEdges()
      ov.renderTitles()
    },
    tick: () => {
      ov.render()
      requestAnimationFrame(ov.tick)
    },
  }
  canvas.ov = ov

  // canvas.height = (window.innerHeight - (user.s.topBar === "visible" ? 42 : 0)) * devicePixelRatio
  // canvas.width = canvas.getBoundingClientRect().width * devicePixelRatio
  const width = canvas.getBoundingClientRect().width
  const height = window.innerHeight - (user.s.topBar === "visible" ? 42 : 0)
  canvas.width = width * devicePixelRatio
  canvas.height = height * devicePixelRatio
  ctx.scale(devicePixelRatio, devicePixelRatio)
  ctx.clearStyle = "#000000"
  // ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.font = `${ov.baseFontSize}px Verdana`
  ctx.fillStyle = "#ffffff"
  const textMetrics = ctx.measureText("Haggle")
  ov.baseFontHalfHeight = (textMetrics.fontBoundingBoxAscent) / 3
  ov.baseFontAscent = textMetrics.fontBoundingBoxAscent
  ov.baseFontDescent = textMetrics.fontBoundingBoxDescent

  const charWidths = {}
  for (let char of charsToMeasure) {
    charWidths[char] = ctx.measureText(char).width
  }
  const defaultCharWidth = charWidths["0"]


  const charwiseMeasureText = (text) => {
    let result = 0
    for (let char of text) {
      result += charWidths[char] || defaultCharWidth
    }
    return result
  }

  const wordWrapText = (text, widthLimit) => {
    const allWidth = charwiseMeasureText(text)
    if (allWidth < widthLimit) {
      return { textLines: [text], textLineWidths: [allWidth], maxTextWidth: allWidth }
    }

    const matches = text.matchAll(/[^ \t\r\n]+/g)
    const lines = [""]
    const lineWidths = [0]
    let idx = 0
    let maxTextWidth = 0

    for (let match of matches) {
      const matchEndIdx = match.index + match[0].length

      const matchTextIncludingPreSpace = text.substring(idx, matchEndIdx)
      const wordWidth = charwiseMeasureText(matchTextIncludingPreSpace)

      if (lineWidths[lineWidths.length - 1] + wordWidth < widthLimit) {
        lines[lines.length - 1] += text.substring(idx, matchEndIdx)
        lineWidths[lineWidths.length - 1] += wordWidth

      } else if (wordWidth > widthLimit) {
        for (let char of matchTextIncludingPreSpace) {
          const charWidth = charWidths[char] || defaultCharWidth
          if (charWidth + lineWidths[lineWidths.length - 1] > widthLimit) {
            if (lineWidths[lineWidths.length - 1] > maxTextWidth) maxTextWidth = lineWidths[lineWidths.length - 1]
            lines.push(char)
            lineWidths.push(charWidth)
          } else {
            lines[lines.length - 1] += char
            lineWidths[lineWidths.length - 1] += charWidth
          }
        }

      } else {

        if (lineWidths[lineWidths.length - 1] > maxTextWidth) maxTextWidth = lineWidths[lineWidths.length - 1]
        lines.push(match[0])
        lineWidths.push(charwiseMeasureText(match[0]))
      }
      idx = match.index + match[0].length
    }

    return { textLines: lines, textLineWidths: lineWidths, maxTextWidth }
  }


  const idToNode = {}
  for (let title in store.titles) {
    const id = store.titles[title]
    const { textLines, textLineWidths, maxTextWidth } = wordWrapText(stripWhitespace(title), ov.textWidthLimit)
    const node = {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      outgoing: [],
      incoming: [],
      title,
      textLines,
      textLineWidths,
      textHalfWidth: maxTextWidth / 2,
    }
    ov.nodes.push(node)
    idToNode[id] = node
  }
  for (let title in store.titles) {
    const id = store.titles[title]
    const refs = store.innerRefs[id]
    for (let ref in refs) {
      if (idToNode[ref]) {
        const from = idToNode[id]
        const to = idToNode[ref]
        const edge = [from, to]
        from.outgoing.push(edge)
        to.incoming.push(edge)
        ov.edges.push(edge)
      }
    }
  }
  // console.log(ov.nodes)
  // console.log(ov.edges)
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ov.tick()
  console.log("hi from graph-2")

  return ov
}