/**
there is an issue where if the font isn't loaded yet when this runs, this renders the wrong font, and it doesn't automatically rerender like dom does when font arrives */
const PI = Math.PI
const TAU = PI * 2
const halfPI = PI / 2
const charsToMeasure = `qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890!@#$%^&*()\`~-_=+[{\\|;:'",<.>/?}] `

const renderOverview = (parent, store) => {
  const canvas = templates.overview.cloneNode(true)
  parent.appendChild(canvas)
  const ctx = canvas.getContext("2d")// could try out desynchronized option, and alpha:false option

  const ov = {
    canvas,
    ctx,

    canvasMouseX: 0,
    canvasMouseY: 0,

    radius: 4,
    baseFontSize: 20,
    baseFontHalfHeight: 0,
    textWidthLimit: 300,

    animationFrameDelay: 1,
    curAnimationFrame: 0,

    centerForce: 0.0,
    attractionForce: 0,
    drag: 0.7,
    collisionForce: 5,

    /** earler I implemented zoom with canvas set transform, but that leads to the font being rendered at the wrong resolution and then being rescaled, so this time i'm keeping the canvas scale constant and moving and scaling all the entities in order to achieve zoom */
    zoom: 1,
    originX: 0,
    originY: 0,

    nodes: [],
    edges: [],

    lastframeTime: 1,
    lastFrameJsTime: 1,
    lastFrameStartTime: 0,

    screenToCanvas: (x, y) => {
      return [x, y]
    },
    setOrdinaryFont: () => {
      ov.ctx.font = `${ov.baseFontSize}px Verdana`
    },
    rescaleEverything: (zoomRatio, deltaX, deltaY) => {
      for (let node of ov.nodes) {
        node.x = node.x * zoomRatio + deltaX
        node.y = node.y * zoomRatio + deltaY
        node.textHalfWidth *= zoomRatio
        for (let i = 0; i < node.textLineWidths.length; i++) {
          node.textLineWidths[i] *= zoomRatio
        }
      }
      ov.zoom *= zoomRatio
      ov.baseFontSize *= zoomRatio
      ov.baseFontAscent *= zoomRatio
      ov.baseFontHeight *= zoomRatio
      ov.baseFontHalfHeight *= zoomRatio

      // origin is just another point in this frame!
      ov.originX = ov.originX * zoomRatio + deltaX
      ov.originY = ov.originY * zoomRatio + deltaY
      ov.setOrdinaryFont()
    },

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
    renderRoundCorneredBox: (x, y, w, h) => {
      const r = ov.radius
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
      ov.ctx.fillStyle = "#333"
      for (let node of ov.nodes) {
        const textStartX = node.x - node.textHalfWidth
        const textStartY = node.y + ov.baseFontHalfHeight
        ov.renderRoundCorneredBox(textStartX, textStartY - ov.baseFontAscent, node.textHalfWidth * 2, ov.baseFontHeight * node.textLines.length)
      }
      ov.ctx.fillStyle = "#ffffff"
      for (let node of ov.nodes) {
        const textStartX = node.x - node.textHalfWidth
        let textStartY = node.y + ov.baseFontHalfHeight
        for (let i = 0; i < node.textLines.length; i++) {
          const textLine = node.textLines[i]
          const lineWidth = node.textLineWidths[i]
          ov.ctx.fillText(textLine, textStartX + (node.textHalfWidth - lineWidth / 2), textStartY)
          textStartY += ov.baseFontHeight
        }
      }
    },
    render: () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ov.renderEdges()
      ov.renderTitles()
    },

    simulate: () => {
      if (ov.centerForce !== 0) ov.centerVelocity()
      if (ov.attractionForce !== 0) ov.attractVelocity()
      ov.collide()
      ov.velocityStep()
    },
    velocityStep: () => {
      for (let node of ov.nodes) {
        node.x += node.dx
        node.y += node.dy
        node.dx *= ov.drag
        node.dy *= ov.drag
      }
    },
    centerPosition: () => {
      for (let node of ov.nodes) {
        node.x += (ov.originX - node.x) * ov.centerForce
        node.y += (ov.originY - node.y) * ov.centerForce
      }
    },
    centerVelocity: () => {
      for (let node of ov.nodes) {
        node.dx += (ov.originX - node.x) * ov.centerForce
        node.dy += (ov.originY - node.y) * ov.centerForce
      }
    },
    attractPosition: () => {
      for (let [node1, node2] of ov.edges) {
        const dx = node2.x - node1.x
        const dy = node2.y - node1.y
        node1.x += dx * ov.attractionForce
        node2.x -= dx * ov.attractionForce
        node1.y += dy * ov.attractionForce
        node2.y -= dy * ov.attractionForce
      }
    },
    attractVelocity: () => {
      for (let [node1, node2] of ov.edges) {
        const ax = node2.x - node1.x
        const ay = node2.y - node1.y
        node1.dx += ax * ov.attractionForce
        node2.dx -= ax * ov.attractionForce
        node1.dy += ay * ov.attractionForce
        node2.dy -= ay * ov.attractionForce
      }
    },

    /**
    maybe a good reference for collisions https://github.com/erincatto/box2d-lite/blob/master/src/Collide.cpp
    
    seems like this just moves pairs of objects so they're barely touching. simple, didn't work for
     */
    collide: () => {
      for (let node of ov.nodes) {
        node.collisionCount = 0
      }
      const baseDistanceY = ov.radius * 2 + ov.baseFontHeight

      for (let idx1 = 0; idx1 < ov.nodes.length - 1; idx1++) {
        const node1 = ov.nodes[idx1]
        for (let idx2 = idx1 + 1; idx2 < ov.nodes.length; idx2++) {
          const node2 = ov.nodes[idx2]
          // could be faster to use textLineWidths.length instead of lineWidths.lenght if that was going to be used later
          const ydist = baseDistanceY + (node1.textLineWidths.length + node2.textLineWidths.length - 2) * ov.baseFontHeight
          const xdist = ov.radius * 2 + node1.textHalfWidth + node2.textHalfWidth
          const topDist = node2.y - node1.y - ydist
          const bottomDist = node1.y - node2.y - ydist
          const rightDist = node2.x - node1.x - xdist
          const leftDist = node1.x - node2.x - xdist
          if (topDist < 0 &&
            bottomDist < 0 &&
            rightDist < 0 &&
            leftDist < 0) {
            let sideDist = leftDist
            let sideDirection = -1
            if (rightDist > leftDist) {
              sideDist = -rightDist
              sideDirection = 1
            }
            let verticalDist = topDist
            let verticalDirection = -1
            if (topDist < bottomDist) {
              verticalDist = -bottomDist
              verticalDirection = 1
            }
            if (verticalDist * 6 < sideDist) {
              if (node2.collisionCount === 0 && node1.collisionCount !== 0) {
                node1.x += sideDist
              } else if (node1.collisionCount === 0 && node2.collisionCount !== 0) {
                node2.x -= sideDist
              } else {
                node2.x += sideDist * 0.5
                node1.x -= sideDist * 0.5
              }
            } else {
              if (node2.collisionCount === 0 && node1.collisionCount !== 0) {
                node1.y += verticalDist
              } else if (node1.collisionCount === 0 && node2.collisionCount !== 0) {
                node2.y -= verticalDist
              } else {
                node2.y += verticalDist * 0.5
                node1.y -= verticalDist * 0.5
              }

            }
            // console.log(`${node1.title} and ${node2.title} intersect`)
            node1.collisionCount++
            node2.collisionCount++
          }
        }
      }
    },
    tick: () => {
      if (ov.curAnimationFrame === 0) {
        ov.lastFrameTime = performance.now() - ov.lastFrameStartTime
        ov.lastFrameStartTime = performance.now()
        ov.simulate()
        ov.render()
        ov.renderDebugInfo()
        ov.lastFrameJsTime = performance.now() - ov.lastFrameStartTime
      }
      ov.curAnimationFrame = (ov.curAnimationFrame + 1) % ov.animationFrameDelay
      requestAnimationFrame(ov.tick)
    },
    renderDebugInfo: () => {
      ov.ctx.font = `14px Verdana`
      let wy = 30
      for (let varName of ["lastFrameJsTime", "zoom", "canvasMouseX", "canvasMouseY", "originX", "originY"]) {
        ov.ctx.fillText(`${varName} ${ov[varName]}`, 10, wy)
        wy += 20
      }
      ov.setOrdinaryFont()
    }
  }
  canvas.ov = ov

  const width = canvas.getBoundingClientRect().width
  const height = window.innerHeight - (user.s.topBar === "visible" ? 45 : 0)
  canvas.width = width * window.devicePixelRatio
  canvas.height = height * window.devicePixelRatio
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
  ctx.clearStyle = "#000000"
  // ctx.clearRect(0, 0, canvas.width, canvas.height)
  ov.setOrdinaryFont()
  ov.originX = canvas.width / 2
  ov.originY = canvas.height / 2
  ctx.fillStyle = "#ffffff"
  const textMetrics = ctx.measureText("Haggle")
  ov.baseFontHalfHeight = (textMetrics.fontBoundingBoxAscent) / 3
  ov.baseFontAscent = textMetrics.fontBoundingBoxAscent
  ov.baseFontHeight = textMetrics.fontBoundingBoxDescent + ov.baseFontAscent

  const charWidths = {}
  for (let char of charsToMeasure) {
    charWidths[char] = ctx.measureText(char).width
  }
  const defaultCharWidth = charWidths["0"]
  // console.log(JSON.stringify(charWidths))

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
      dx: 0,
      dy: 0,
      outgoing: [],
      incoming: [],
      collisionCount: 0,
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
  const buttonNumbers = ["left", "wheeldown", "right"]
  /** interesting code style question. is that better than 
  // must button codes: left:0, wheel:1, right:2 */

  canvas.addEventListener("mousedown", (event) => {
    switch (event.button) {
      case 0:
        ov.isDragging = true
        break
      case 1:
        break
      case 2:
        break
    }
  })
  canvas.addEventListener("mouseup", (event) => {
    switch (event.button) {
      case 0:
        ov.isDragging = false
        break
      case 1:
        break
      case 2:
        break
    }
  })
  canvas.addEventListener("mousemove", (event) => {
    const [canvasX, canvasY] = ov.screenToCanvas(event.clientX, event.clientY)
    if (ov.isDragging) {
      ov.rescaleEverything(1, canvasX - ov.canvasMouseX, canvasY - ov.canvasMouseY)
    }
    ov.canvasMouseX = canvasX
    ov.canvasMouseY = canvasY
  })
  canvas.addEventListener("keypress", (event) => {
    switch (event.key) {
      case "Space":

        break
    }
    console.log(event)
  })
  canvas.addEventListener("wheel", (event) => {
    const deltaModes = {
      0: { name: "pixel", conversion: 1 },
      1: { name: "line", conversion: 25 },
      2: { name: "page", conversion: 600 },
    }
    if (event.deltaY !== 0) {
      const normalizedDeltaY = event.deltaY * deltaModes[event.deltaMode].conversion
      const zoomFraction = normalizedDeltaY / canvas.height
      const zoomRatio = 1 + zoomFraction
      const mouseDistanceX = ov.canvasMouseX
      const mouseDistanceY = ov.canvasMouseY
      ov.rescaleEverything(zoomRatio, -mouseDistanceX * zoomFraction, -mouseDistanceY * zoomFraction)
      event.preventDefault()
    }
  })

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ov.simulate()

  ov.tick()
  console.log("hi from graph-2")
  window.ov = ov
  return ov
}