// Render roam graph on a canvas
// Returns a function that stops rendering graph
const graph = (canvas,store) => {
  const graphJsStartTime = performance.now() // measure when graph.js starts executing
  let lastFrameStartTime = 0 // for counting framerate

  let nodes,edges

  let ctx // HTML5 canvas 2d context

  let clickedNode = null
  let clickedNodeAdjacent = []
  let mousePosition = { x: 0,y: 0,prevX: 0,prevY: 0 }
  let updating = true
  let running = true // use this to asynchronously stop rendering

  // whether anything changed, to know whether to render. Starts true to make sure it renders at least once
  let somethingChangedThisFrame = true

  // ----------- Constants --------------------

  // Physics constants
  let attraction = 0.01
  let friction = 0.9
  let repulsion = 0.00000022
  let centering = 0.001
  const slowdown = 0.65
  const attractionEpsilon = 0.001
  const repulsionEpsilon = 0.0000001

  // Constants that determine speed vs quality tradeoff
  let maxSizeRatioToApproximate = 0.5 // lower means quality, higher means speed
  const simulationStepsBeforeRender = 200 // higher means quality, lower means speed
  let nodeRenderBatchSize = 6 // lower means quality, higher means names might overlap

  const twoPI = 2 * Math.PI // get a few percent performance by precomputing 2*pi once instead of in loop

  // UI constants
  const zoomRatioPerMouseWheelTick = 0.15
  const labelPaddingX = 0.003
  const labelPaddingY = 0.003

  const nodeBackgroundColor = "#eeeeee"
  const textColor = "#000000"
  const clickedAdjacentColor = "#80d7ff"
  const clickedColor = "#28bbff"

  // faster, looser random
  // https://en.wikipedia.org/wiki/Linear_congruential_generator#Parameters_in_common_use
  const randomConstantA = 1664525
  const randomConstantC = 1013904223
  const randomConstantM = 4294967296 // 2^32
  let randomSeed = Math.random()
  const random = () =>
    (randomSeed = (randomConstantA * randomSeed + randomConstantC) % randomConstantM) / randomConstantM

  // create graph node
  const newNode = (title) => ({
    x: random() - 0.5,
    y: random() - 0.5,
    dx: 0,
    dy: 0,
    title: title,
    numConnections: 0,
    mass: 1,
  })

  // This is the start of the Barnes-Hut n-body force approximation.
  // It works by partitiioning space into a tree structure and
  // applying forces to tree roots instead of nodes / leaves
  // The quadTree nodes have nothing to do conceptually with the graph - they're just for optimization
  // https://en.wikipedia.org/wiki/Barnes%E2%80%93Hut_simulation
  const quadTreeNode = (x,y,r,kids = []) => ({
    x,
    y,
    r,
    kids,
    tree: [],
    mass: 0,
  })

  // move all kids in quadtree to child quadtrees, recursively
  const pushQuadTree = (branch,recursionDepth = 0) => {
    if (recursionDepth >= 20) {
      // Abort recursion if we've gone too deep
      return
    }
    const newR = branch.r * 0.5
    branch.tree = [
      quadTreeNode(branch.x - newR,branch.y - newR,newR), // top left
      quadTreeNode(branch.x + newR,branch.y - newR,newR), // top right
      quadTreeNode(branch.x - newR,branch.y + newR,newR), // bottom left
      quadTreeNode(branch.x + newR,branch.y + newR,newR), // bottom right
    ]
    let sumY = 0,
      sumX = 0
    for (let node of branch.kids) {
      // casting boolean to 0/1 to index array
      branch.tree[(node.x > branch.x) + 2 * (node.y > branch.y)].kids.push(node)
      sumY += node.y
      sumX += node.x
      branch.mass += node.mass
    }
    branch.x = sumX / branch.kids.length
    branch.y = sumY / branch.kids.length
    for (let i = 0; i < 4; i++) {
      const len = branch.tree[i].kids.length
      if (len > 1) {
        // if there are multiple nodes in child tree, then push that child tree
        pushQuadTree(branch.tree[i],recursionDepth + 1)
      } else if (len === 0) {
        branch.tree[i] = undefined
      } else {
        // if child tree has one node, replace the tree with the node
        branch.tree[i] = branch.tree[i].kids[0]
      }
    }
  }

  const repelNodeByQuadTree = (node,quadTree) => {
    if (quadTree === undefined) {
      return
    }
    const dx = node.x - quadTree.x
    const dy = node.y - quadTree.y
    if (
      // if quadtree has children but it's far away and should be approximated
      (quadTree.tree !== undefined && quadTree.r / Math.sqrt(dx * dx + dy * dy) < maxSizeRatioToApproximate) ||
      // if node is leaf
      quadTree.numConnections !== undefined
    ) {
      // Use 'approximation' to square root that's faster than Math.sqrt
      const distanceMangledForPerformance = dx * dx * dx * dx * 0.1 + dy * dy * dy * dy + repulsionEpsilon
      const factor = (node.inverseMass * (quadTree.mass * repulsion)) / distanceMangledForPerformance
      node.dx += dx * factor
      node.dy += dy * factor
    } else {
      quadTree.tree.forEach((tree) => repelNodeByQuadTree(node,tree))
    }
  }

  const [nodeLoop,nodeLoopTime] = timeFunc(() => {
    nodes.forEach((node) => {
      // Slow down nodes by friction ratio
      node.dx = node.dx * friction
      node.dy = node.dy * friction

      // Pull nodes towards center
      node.x -= Math.sign(node.x) * node.x * node.x * centering
      node.y -= Math.sign(node.y) * node.y * node.y * centering

      // 'tick' position forward by velocity
      node.x += node.dx
      node.y += node.dy
    })
  },"node loop")
  console.log(nodeLoopTime)

  const physicsTick = () => {
    // Attract nodes on edges together
    edges.forEach(([a,b]) => {
      const dx = a.x - b.x
      const dy = a.y - b.y
      // Use 'approximation' to square root that's faster than Math.sqrt
      const distanceMangledForPerformance = Math.abs(dx) + Math.abs(dy) + attractionEpsilon
      const factor = attraction / distanceMangledForPerformance
      const accX = dx * factor
      const accY = dy * factor
      a.dx -= accX
      b.dx += accX
      a.dy -= accY
      b.dy += accY
    })

    // Repel all nodes apart using Barnes-Hut approximation
    const quadTree = quadTreeNode(0.5,0.5,4,nodes)
    pushQuadTree(quadTree)
    nodes.forEach((node) => repelNodeByQuadTree(node,quadTree))

    nodeLoop()
  }

  const applyViewChanges = () => {
    // Pan by the difference between mouse x and mouse x last frame
    // not last mouseMove event
    if (mousePosition.prevX !== 0) {
      canvasOffsetY += mousePosition.y - mousePosition.prevY
      canvasOffsetX += mousePosition.x - mousePosition.prevX
      mousePosition.prevX = mousePosition.x
      mousePosition.prevY = mousePosition.y
    }
    ctx.setTransform(
      canvasInnerHeight, // scale width, we set this scale the same as the height to avoid stretching
      0, // slant x
      0, // slant y
      canvasInnerHeight, // scale height
      canvasOffsetX, // offset x
      canvasOffsetY // offset y
    )
  }

  // renderNodeBackground and renderNodeText don't set their own colors (fillStyle)
  // for performance. Set the canvas to the color you want before calling
  // can get 10-20% more render performance by inlining this, but that would just be bananas for maintainability
  const renderNodeBackground = (node) =>
    ctx.fillRect(
      node.x - node.textWidth * 0.5 - labelPaddingX,
      node.y - 0.008 * node.mass - labelPaddingY,
      node.textWidth + labelPaddingX * 2,
      0.015 * node.mass + labelPaddingY * 2
    )
  const renderNodeText = (node) => {
    ctx.font = `bold ${node.mass * 0.015}px Verdana`
    ctx.fillText(node.title,node.x - node.textWidth * 0.5,node.y + 0.006 * node.mass * 0.5)
  }

  const clearCanvas = () => {
    // clear canvas in positive and negative directions
    ctx.save()
    ctx.translate(-5000,-5000)
    ctx.clearRect(0,0,10000,10000)
    ctx.restore()
  }

  const render = () => {
    clearCanvas()

    // draw edge lines first so they go underneath nodes
    ctx.strokeStyle = "#a7a7a7" // Set canvas state outside of loop for performance
    ctx.lineWidth = 0.002
    for (let [startNode,endNode] of edges) {
      ctx.beginPath()
      ctx.moveTo(startNode.x,startNode.y)
      ctx.lineTo(endNode.x,endNode.y)
      ctx.stroke()
    }

    // draw nodes in batches to save time switching fillStyle
    const numBatches = Math.floor(nodes.length / nodeRenderBatchSize)
    for (let batch = 0; batch < numBatches; batch++) {
      ctx.fillStyle = nodeBackgroundColor
      for (let i = batch * nodeRenderBatchSize; i < (batch + 1) * nodeRenderBatchSize; i++) {
        renderNodeBackground(nodes[i])
      }
      // draw all node labels at once
      ctx.fillStyle = textColor
      for (let i = batch * nodeRenderBatchSize; i < (batch + 1) * nodeRenderBatchSize; i++) {
        renderNodeText(nodes[i])
      }
    }
    ctx.fillStyle = nodeBackgroundColor
    for (let i = numBatches * nodeRenderBatchSize; i < nodes.length; i++) {
      renderNodeBackground(nodes[i])
    }
    // draw all node labels at once
    ctx.fillStyle = textColor
    for (let i = numBatches * nodeRenderBatchSize; i < nodes.length; i++) {
      renderNodeText(nodes[i])
    }

    if (clickedNode !== null) {
      // draw edges and connected nodes from clicked node
      ctx.strokeStyle = clickedAdjacentColor // Set canvas state outside of loop for performance
      ctx.lineWidth = 0.003
      clickedNodeAdjacent.forEach((adjacent) => {
        ctx.beginPath()
        ctx.moveTo(clickedNode.x,clickedNode.y)
        ctx.lineTo(adjacent.x,adjacent.y)
        ctx.stroke()
      })
      clickedNodeAdjacent.forEach((adjacent) => {
        // draw adjacent node label
        ctx.fillStyle = clickedAdjacentColor
        renderNodeBackground(adjacent)
        // draw all node labels at once
        ctx.fillStyle = textColor
        renderNodeText(adjacent)
      })
      // draw clicked node label
      ctx.fillStyle = clickedColor
      renderNodeBackground(clickedNode)
      // draw all node labels at once
      ctx.fillStyle = textColor
      renderNodeText(clickedNode)
    }
  }

  // This is called once per animation frame
  const update = () => {
    if (running) {
      requestAnimationFrame(update)
      if (updating) {
        physicsTick()
      }
      const frameStartTime = performance.now()
      if (updating || somethingChangedThisFrame) {
        if (fpsCounterElement) fpsCounterElement.innerText = Math.round(1000 / (frameStartTime - lastFrameStartTime))
        applyViewChanges()
        render()
      }
      lastFrameStartTime = frameStartTime
      somethingChangedThisFrame = false
    } else {
      clearCanvas()
      canvas = null
      ctx = null
      fpsCounterElement = null
      nodes = null
      edges = null
    }
  }

  // Setup canvas
  ctx = canvas.getContext("2d")
  canvas.width = window.innerWidth
  // fit to whole window except for text at top
  const fromTop = canvas.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop)
  canvas.height = window.innerHeight - fromTop
  let canvasOffsetX = canvas.width / 2
  let canvasOffsetY = canvas.height / 2
  let canvasInnerHeight = canvas.height * 0.25

  let fpsCounterElement = document.getElementById("fps")
  let statusElement = document.getElementById("status")
  let startupTimeElement = document.getElementById("startupTime")

  applyViewChanges()

  canvas.addEventListener("mousemove",(event) => {
    mousePosition.x = event.offsetX
    mousePosition.y = event.offsetY
    if (mousePosition.prevX) {
      somethingChangedThisFrame = true
    }
  })

  const screenCoordToSpaceCoord = (x,y) => [
    (x - canvasOffsetX) / canvasInnerHeight,
    (y - canvasOffsetY) / canvasInnerHeight,
  ]

  const mouseDownHandler = (event) => {
    const [mouseX,mouseY] = screenCoordToSpaceCoord(event.offsetX,event.offsetY)

    // Linearly searching through the nodes to find the node that's clicked on.
    // Could optimize this with the quadtree, but it only takes 0.5ms now
    // If I were to optimize it with the quadtree, the quadtree would need to consider how wide the node labels are
    // which would be much easier if all labels were the same size / had small max size (which might be good for aesthetics)
    for (let nodeIdx = nodes.length - 1; nodeIdx >= 0; nodeIdx--) {
      // Iterate backwards through nodes to hit most recently drawn first
      const node = nodes[nodeIdx]
      if (
        mouseX >= node.x - node.textWidth * 0.5 - labelPaddingX &&
        mouseY >= node.y - 0.008 * node.mass - labelPaddingY &&
        mouseX <= node.x + node.textWidth * 0.5 + labelPaddingX &&
        mouseY <= node.y + 0.007 * node.mass + labelPaddingY
      ) {
        clickedNode = node
        clickedNodeAdjacent = []
        // find nodes connected to clicked node in edge array
        // Don't already have a map of nodes -> their edges because there's no
        // other need for it.
        for (let [source,target] of edges) {
          if (source === clickedNode) {
            clickedNodeAdjacent.push(target)
          }
          if (target === clickedNode) {
            clickedNodeAdjacent.push(source)
          }
        }
        somethingChangedThisFrame = true
        return
      }
    }
    mousePosition.prevX = event.offsetX
    mousePosition.prevY = event.offsetY
    somethingChangedThisFrame = true
  }

  // whether currently dragging is controlled by whether prev position is nonzero
  // need to record where mouse was when started dragging
  canvas.addEventListener("mousedown",mouseDownHandler)
  const stopDragHandler = (event) => {
    mousePosition.prevX = 0
    mousePosition.prevY = 0
    somethingChangedThisFrame = true
  }

  canvas.addEventListener("mouseup",stopDragHandler)

  canvas.addEventListener("mouseleave",stopDragHandler)

  canvas.addEventListener("keypress",(event) => {
    if (event.code === "Space") {
      updating = !updating
      event.stopPropagation()
      event.preventDefault()
      somethingChangedThisFrame = true
    }
  })

  canvas.addEventListener("wheel",(event) => {
    const scaling = event.deltaY * 0.01 * zoomRatioPerMouseWheelTick
    const newCanvasInnerHeight = canvasInnerHeight * (1 - scaling)
    canvasInnerHeight = newCanvasInnerHeight
    event.preventDefault()
    somethingChangedThisFrame = true
  })

  const extractGraph = (store) => {
    const nodes = store.titles.map(title => {

    })
  }
  extractGraph(store)

  // sort by increasing mass so most important nodes get rendered on top of less important nodes
  nodes = nodes.sort((a,b) => a.mass - b.mass)

  // simulate physics before render
  for (let i = 0; i < simulationStepsBeforeRender; i++) {
    physicsTick()
  }

  // slow down simulation before rendering
  // edit individual constants instead of one global constant for performance
  attraction *= slowdown
  friction *= slowdown
  centering *= slowdown * slowdown
  maxSizeRatioToApproximate *= slowdown

  requestAnimationFrame(update)

  if (startupTimeElement) startupTimeElement.innerText = Math.round(performance.now() - graphJsStartTime) * 0.001
  if (statusElement) statusElement.innerText = "Running"

  // return function to exit graph
  return () => (running = false)
}
