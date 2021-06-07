let graphState = "unknown"
let navLoaded = false


const startupFn = async () => {
  await Promise.all([
    mut.initUser(),
    mut.connectIdb()
  ])
  mut.sessionStateFromHash()
  mut.loadGraphName(sessionState.graphName, (errorCode) => {
    if (errorCode) {
      graphState = "error"
      if (navLoaded) {
        render.notifyText("Could not find that graph name")
      }
    } else {
      graphState = "loaded"
      if (navLoaded) {
        renderSessionState()
      }
    }
  })
}
startupFn()