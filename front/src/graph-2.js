/**
there is an issue where if the font isn't loaded yet when this runs, this renders the wrong font, and it doesn't automatically rerender like dom does when font arrives */
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
    collisionRadius: 7,
    baseFontSize: 20,
    baseFontHalfHeight: 0,
    textWidthLimit: 300,

    animationFrameDelay: 1,
    curAnimationFrame: 0,

    onlyRenderOnInput: false,

    simulating: "collide",
    simulationTicksPerRender: 10,
    centerForce: 0.000000003,
    attractionForce: 0.01,
    drag: 0.7,
    collisionForce: 5,
    pushaside: 5,
    extraPush: 0.1,
    eccentricity: 0.02,
    centeringEccentricity: 0.4,

    /** earler I implemented zoom with canvas set transform, but that leads to the font being rendered at the wrong resolution and then being rescaled, so this time i'm keeping the canvas scale constant and moving and scaling all the entities in order to achieve zoom */
    zoom: 1,
    originX: 0,
    originY: 0,

    isDragging: false,
    draggingNode: null,
    dragOffsetX: 0,
    dragOffsetY: 0,

    nodes: [],
    edges: [],

    lastframeTime: 1,
    lastFrameJsTime: 1,
    lastFrameStartTime: 0,

    isPointInNodeIdx: (idx, x, y) => {
      const node = ov.nodes[idx]
      const textStartX = node.x - node.textHalfWidth - ov.radius
      const textStartY = node.y - (ov.baseFontHeight * node.textLines.length) * 0.5 - ov.radius
      const textEndX = node.x + node.textHalfWidth + ov.radius
      const textEndY = node.y + (ov.baseFontHeight * node.textLines.length) * 0.5 + ov.radius
      return (x > textStartX && x < textEndX) && (y > textStartY && y < textEndY)
    },

    screenToCanvas: (x, y) => {
      return [x + 0.5, y + 3.5]
    },
    setOrdinaryFont: () => {
      ov.ctx.font = `${ov.baseFontSize}px Verdana`
    },
    rescaleEverything: (zoomRatio, deltaX, deltaY) => {
      for (let node of ov.nodes) {
        node.x = node.x * zoomRatio + deltaX
        node.y = node.y * zoomRatio + deltaY
        node.textHalfWidth *= zoomRatio
        node.halfHeight *= zoomRatio
        for (let i = 0; i < node.textLineWidths.length; i++) {
          node.textLineWidths[i] *= zoomRatio
        }
      }
      ov.zoom *= zoomRatio
      ov.radius *= zoomRatio
      ov.pushaside *= zoomRatio * zoomRatio
      ov.collisionRadius *= zoomRatio
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
      document.removeEventListener("keypress", keypressListener)
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
        const textStartY = node.y - node.halfHeight
        ov.renderRoundCorneredBox(textStartX, textStartY, node.textHalfWidth * 2, node.halfHeight * 2)
      }
      ov.ctx.fillStyle = "#ffffff"
      for (let node of ov.nodes) {
        ov.ctx.font = `${ov.baseFontSize * node.size}px Verdana`
        const textStartX = node.x - node.textHalfWidth
        let textStartY = node.y + ov.baseFontAscent * node.size - node.halfHeight
        for (let i = 0; i < node.textLines.length; i++) {
          const textLine = node.textLines[i]
          // const lineWidth = node.textLineWidths[i]
          // const centeredStartY = textStartY + (node.textHalfWidth * 2 - lineWidth) / 2
          ov.ctx.fillText(textLine, textStartX, textStartY)
          textStartY += ov.baseFontHeight * node.size
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
      let sumx = 0, sumy = 0
      for (let node of ov.nodes) {
        sumx += node.x
        sumy += node.y
      }
      let deltax = (sumx / ov.nodes.length) - ov.originX
      let deltay = (sumy / ov.nodes.length) - ov.originY
      for (let node of ov.nodes) {
        node.x -= deltax
        node.y -= deltay
      }
    },
    centerVelocity: () => {
      for (let node of ov.nodes) {
        const dx = (ov.originX - node.x)
        const dy = (ov.originY - node.y)
        const distanceSquared = dx * dx + dy * dy
        node.dx += distanceSquared * dx * ov.centerForce * ov.eccentricity
        node.dy += distanceSquared * dy * ov.centerForce
      }
    },
    attractPosition: () => {
      for (let [node1, node2] of ov.edges) {
        const dx = node2.x - node1.x
        const dy = node2.y - node1.y
        const fx = dx * ov.attractionForce * ov.eccentricity
        node1.x += fx
        node2.x -= fx
        const fy = dy * ov.attractionForce
        node1.y += fy
        node2.y -= fy
      }
    },
    attractVelocity: () => {
      for (let [node1, node2] of ov.edges) {
        const ax = (node2.x - node1.x) * ov.attractionForce * ov.eccentricity
        const ay = (node2.y - node1.y) * ov.attractionForce
        node1.dx += ax
        node2.dx -= ax
        node1.dy += ay
        node2.dy -= ay
      }
    },

    /**
    maybe a good reference for collisions https://github.com/erincatto/box2d-lite/blob/master/src/Collide.cpp
    
    seems like this just moves pairs of objects so they're barely touching. simple, didn't work for
     */
    collide: () => {
      for (let node of ov.nodes) {
        node.collisionMoved = false//means checked against all
        node.collisionChecked = false
      }
      const baseDistanceY = ov.collisionRadius * 2
      const baseDistanceX = ov.collisionRadius * 2
      /**
      instead of iterating in same arbitrary order, could spread by contact
       */
      const toCollide = [...ov.nodes]
      if (ov.draggingNode !== null) toCollide.push(ov.draggingNode)
      const collide = (node1) => {
        for (let idx2 = 0; idx2 < ov.nodes.length; idx2++) {
          const node2 = ov.nodes[idx2]
          if (node2.collisionChecked || node2 == node1) continue

          const ydist = baseDistanceY + (node2.halfHeight + node1.halfHeight)
          const xdist = baseDistanceX + node1.textHalfWidth + node2.textHalfWidth
          const topDist = node2.y - node1.y - ydist
          const bottomDist = node1.y - node2.y - ydist
          const leftDist = node1.x - node2.x - xdist
          const rightDist = node2.x - node1.x - xdist

          if (topDist < 0 &&
            bottomDist < 0 &&
            rightDist < 0 &&
            leftDist < 0) {
            let sideDist = leftDist - ov.extraPush
            if (rightDist > leftDist) {
              sideDist = -rightDist + ov.extraPush
            }
            let verticalDist = topDist - ov.extraPush
            if (bottomDist > topDist) {
              verticalDist = -bottomDist + ov.extraPush
            }
            if (Math.abs(sideDist) < Math.abs(verticalDist)) {
              let inverseVerticalDist = 0.2 * ov.pushaside / (1 + verticalDist)
              if (Math.abs(inverseVerticalDist) > Math.abs(verticalDist)) inverseVerticalDist = verticalDist
              if (node1.collisionMoved) {
                node2.x += sideDist
                node2.y -= inverseVerticalDist * 2
              } else {
                node2.x += sideDist * 0.5
                node1.x -= sideDist * 0.5
                node2.y -= inverseVerticalDist
                node1.y += inverseVerticalDist
              }
              node1.dx = 0
              node2.dx = 0
            } else {
              let inverseSideDist = ov.pushaside / (1 + sideDist)
              if (Math.abs(inverseSideDist) > Math.abs(sideDist)) inverseSideDist = sideDist
              if (node1.collisionMoved) {
                node2.y -= verticalDist
                node2.x += inverseSideDist * 2
              } else {
                node2.y -= verticalDist * 0.5
                node1.y += verticalDist * 0.5
                node2.x += inverseSideDist
                node1.x -= inverseSideDist
              }
              node1.dy = 0
              node2.dy = 0
            }
            node2.collisionMoved = true
            node1.collisionMoved = true
            toCollide.push(node2)
          }
        }
        node1.collisionChecked = true
      }

      while (toCollide.length > 0) {
        const cur = toCollide.pop()
        if (!cur.collisionChecked) {
          collide(cur)
        }
      }
    },

    tick: () => {
      if (ov.curAnimationFrame === 0) {
        if (!ov.onlyRenderOnInput || ov.inputHappenedThisFrame) {
          ov.lastFrameTime = performance.now() - ov.lastFrameStartTime
          ov.lastFrameStartTime = performance.now()
          for (let i = 0; i < ov.simulationTicksPerRender; i++) {
            if (ov.simulating === "all")
              ov.simulate()
            else if (ov.simulating === "collide")
              ov.collide()
          }
          ov.render()
          ov.renderDebugInfo()
          ov.lastFrameJsTime = performance.now() - ov.lastFrameStartTime
          ov.inputHappenedThisFrame = false
        }
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
      // ov.renderCursor()
    },
    renderCursor: () => {
      ov.ctx.beginPath()
      ov.ctx.moveTo(ov.canvasMouseX, ov.canvasMouseY)
      ov.ctx.arc(ov.canvasMouseX, ov.canvasMouseY, 4, 0, 2 * Math.PI)
      ov.ctx.closePath()
      ov.ctx.fill()
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
  ov.originX = canvas.width * 0.5
  ov.originY = canvas.height * 0.5
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

      collisionMoved: false,
      collisionChecked: false,

      size: 0,
      halfHeight: 0,

      title,
      textLines,
      textLineWidths,
      textHalfWidth: maxTextWidth * 0.5,
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

  for (let node of ov.nodes) {
    node.size = 1 + Math.log(node.incoming.length + node.outgoing.length) * 0.4
    node.textHalfWidth *= node.size
    for (let i = 0; i < node.textLineWidths.length; i++) {
      node.textLineWidths[i] *= node.size
      node.halfHeight += node.size * ov.baseFontHeight
    }
    node.halfHeight *= 0.5
  }

  const buttonNumbers = ["left", "wheeldown", "right"]
  /** interesting code style question. is that better than 
  // must button codes: left:0, wheel:1, right:2 */

  canvas.addEventListener("mousedown", (event) => {
    handleMouseMove(event)
    switch (event.button) {
      case 0:
        ov.inputHappenedThisFrame = true
        for (let i = 0; i < ov.nodes.length; i++) {
          if (ov.isPointInNodeIdx(i, ov.canvasMouseX, ov.canvasMouseY)) {
            ov.draggingNode = ov.nodes[i]
            ov.dragOffsetX = ov.nodes[i].x - ov.canvasMouseX
            ov.dragOffsetY = ov.nodes[i].y - ov.canvasMouseY
            return
          }
        }
        ov.isDragging = true
        break
      case 1:
        break
      case 2:
        break
    }
  })
  canvas.addEventListener("mouseup", (event) => {
    handleMouseMove(event)
    switch (event.button) {
      case 0:
        ov.isDragging = false
        ov.draggingNode = null
        ov.inputHappenedThisFrame = true
        break
      case 1:
        break
      case 2:
        break
    }
  })

  const handleMouseMove = (event) => {
    const [canvasX, canvasY] = ov.screenToCanvas(event.clientX, event.clientY)
    const deltaX = canvasX - ov.canvasMouseX, deltaY = canvasY - ov.canvasMouseY
    if (ov.isDragging) {
      ov.inputHappenedThisFrame = true
      ov.rescaleEverything(1, deltaX, deltaY)
    }
    ov.canvasMouseX = canvasX
    ov.canvasMouseY = canvasY
    if (ov.draggingNode !== null) {
      ov.inputHappenedThisFrame = true
      ov.draggingNode.x = canvasX + ov.dragOffsetX
      ov.draggingNode.y = canvasY + ov.dragOffsetY
    }
  }
  canvas.addEventListener("mousemove", handleMouseMove)
  const keypressListener = (event) => {
    const previhtf = ov.inputHappenedThisFrame
    ov.inputHappenedThisFrame = true
    switch (event.code) {
      case "Space":
        if (ov.simulating === "all") ov.simulating = "collide"
        else if (ov.simulating === "collide") ov.simulating = "all"
        break
      case "f":
        ov.onlyRenderOnInput = !ov.onlyRenderOnInput
        break
      default:
        ov.inputHappenedThisFrame = previhtf
    }
  }
  document.addEventListener("keypress", keypressListener)
  /**
  there's a problem where if you zoom before you ever move your mouse, I don't know where the mouse is */
  canvas.addEventListener("wheel", (event) => {
    handleMouseMove(event)
    const deltaModes = {
      0: { name: "pixel", conversion: 1 },
      1: { name: "line", conversion: 25 },
      2: { name: "page", conversion: 600 },
    }
    if (event.deltaY !== 0) {
      ov.inputHappenedThisFrame = true
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
  window.ov = ov
  document.activeElement = canvas
  return ov
}