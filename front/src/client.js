/**
could have a wrapper that keeps track of what requests (fns) are in flight. Wrapper could also que requests so that one finishes before the next. That would ensure the server and client see events in the same order (the first time without client re-ordering time)
 */

/**
These functions don't modify client side state!
 */
//Status Code 888 means: request timed out
const clientGo = {
  // this async await stuff looks like it would add 0.3ms or something
  // if it adds much more than that would have to switch to callbacks
  fetch: async (url, options, timeout = clientGo.defaultTimeout) => {
    const abortController = new AbortController()
    options.signal = abortController.signal
    const timeoutPromise = promisify(() => setTimeout(() => {
      abortController.abort()
      return { status: 888 }
    }, timeout))
    return await Promise.race([fetch(goServerUrl + "/" + url, options), timeoutPromise])
  },

  isTherePendingRequest: () => {
    return clientGo.pendingRequest === null
  },

  defaultTimeout: 2000,
  lastRequestTimedOut: false,

  graphWebsockets: {},

  login: async (passwordHash) => {
    const response = await clientGo.fetch(`auth`, { method: "POST", headers: { h: passwordHash } })
    if (response.status === 200) {
      user = await response.json()
      console.log(user)
      return user
    }
  },

  signup: async (email, username, passwordHash) => {
    const jsonBody = JSON.stringify({ h: passwordHash, u: username, e: email, s: user.s })
    console.log(jsonBody)
    const response = await clientGo.fetch(`signup`, { method: "POST", body: jsonBody })
    if (response.status === 200) {
      const serverUser = await response.json()
      return serverUser
    }
  },

  get: async (graphName) => {
    const response = await clientGo.fetch(`get/${graphName}`, { headers: { h: user.h } })
    if (response.status === 200) {
      const json = await response.json()
      return json
    }
    return response.status
  },
  /**
  qualified blox is 
  {graphName, commitId, blox}
   */
  create: async (qualifiedBlox) => {
    const response = await clientGo.fetch(`create`, { headers: { h: user.h }, method: "POST", body: JSON.stringify(qualifiedBlox) })
    return response.status === 200 ? undefined : response.status
  },

  write: async (qualifiedBlox) => {
    const response = await clientGo.fetch(`write`, { headers: { h: user.h }, method: "POST", body: JSON.stringify(qualifiedBlox) })
    return response.status === 200 ? undefined : response.status
  },

  connectGraphWebsocket: (graphName, onconnect, onedit, onclose) => {
    const ws = new WebSocket(`${goServerUrl}/websocket/${graphName}/${user.h}`)
    clientGo.graphWebsockets[graphName] = ws
    ws.onmessage = onedit

    ws.onclose = onclose

    ws.onerror = () => {
      onconnect("no connecty")
    }

    ws.onopen = () => {
      onconnect()
    }
  },

  disconnectGraphWebsocket: async (graphName) => {
    clientGo.graphWebsockets[graphName].close()
    delete clientGo.graphWebsockets[graphName]
  },

  edit: async (graphName, commit) => {
    const ws = clientGo.graphWebsockets[graphName]
    if (!ws) {
      throw new Error(`no websocket connected for ${graphName}`)
    }

    ws.send(JSON.stringify({ type: "edit", data: commit }))
  },

  logError: async (text) => {
    const response = await clientGo.fetch(`error/`, { method: "POST", body: text })
  },

  log: async (text) => {
    const response = await clientGo.fetch(`log/`, { method: "POST", body: text })
  },

  settings: async (settings) => {
    const response = await clientGo.fetch("settings/", { headers: { h: user.h }, method: "POST", body: JSON.stringify(settings) })
    return response.status === 200 ? undefined : response.status
  }
}
