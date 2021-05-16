/**
there is an issue where if the font isn't loaded yet when this runs, this renders the wrong font, and it doesn't automatically rerender like dom does when font arrives */
const renderOverview = (parent, store) => {
  const canvas = templates.overview.cloneNode(true)
  parent.appendChild(canvas)
  const ctx = canvas.getContext("2d",)// could try out desynchronized option, and alpha:false option

  const ov = {
    baseFontSize: 16,
    baseFontHalfHeight: 0,
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
    renderRoundCorneredBox: (x, y, w, h) => {
      ov.ctx.beginPath(x, y)
      ov.ctx.moveTo(x + w, y)
      ov.ctx.moveTo(x + w, y + h)
      ov.ctx.moveTo(x, y + h)
      ov.ctx.moveTo(x, y)
      ov.ctx.fill()
      // ctx.fillRect(x, y, w, h)
    },
    renderTitles: () => {
      ov.ctx.fillStyle = "#111"
      for (let node of ov.nodes) {
        const textStartX = node.x - node.textHalfWidth
        const textStartY = node.y + ov.baseFontHalfHeight
        ov.renderRoundCorneredBox(textStartX, textStartY - ov.baseFontAscent, node.textHalfWidth * 2, ov.baseFontAscent + ov.baseFontDescent)
      }
      ov.ctx.fillStyle = "#ffffff"
      for (let node of ov.nodes) {
        const textStartX = node.x - node.textHalfWidth
        const textStartY = node.y + ov.baseFontHalfHeight
        ov.ctx.fillText(node.title, textStartX, textStartY,)
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

  canvas.height = (window.innerHeight - (user.s.topBar === "visible" ? 42 : 0)) * devicePixelRatio
  canvas.width = canvas.getBoundingClientRect().width * devicePixelRatio
  console.log(canvas.width)
  // ctx.scale(devicePixelRatio, devicePixelRatio)
  ctx.clearStyle = "#000000"
  // ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.font = `${ov.baseFontSize}px Inter`
  ctx.fillStyle = "#ffffff"
  const textMetrics = ctx.measureText("Haggle")
  ov.baseFontHalfHeight = (textMetrics.fontBoundingBoxAscent) / 3
  ov.baseFontAscent = textMetrics.fontBoundingBoxAscent
  ov.baseFontDescent = textMetrics.fontBoundingBoxDescent

  const idToNode = {}
  for (let title in store.titles) {
    const id = store.titles[title]
    const node = {
      x: Math.random() * ov.canvas.width,
      y: Math.random() * ov.canvas.height,
      outgoing: [],
      incoming: [],
      title,
      textHalfWidth: ctx.measureText(title).width / 2,
    }
    console.log(node.textHalfWidth)
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
  console.log(ov.nodes)
  console.log(ov.edges)
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ov.tick()
  console.log("hi from graph-2")

  return ov
}