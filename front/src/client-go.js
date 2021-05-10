const clientGo = {
  middlePepper: "76pCgT0lW6ES9yjt01MeH",
  beginPepper: "CeoPPOv9rIq6O7YiYlSFX",
  endPepper: "Rzw1dagomQGpoo2s7iGE3lYL2yruaJDGrUk6bFCvz",

  hashPassword: async (password, email) => {
    const saltAndPeppered = `${beginPepper}${password}${middlePepper}${email}${endPepper}`
    const buffer = textEncoder.encode(saltAndPeppered)
    const hashed = await crypto.subtle.digest("SHA-256", buffer)
    const passwordHashBuffer = new Uint8Array(hashed)
    return btoa(String.fromCharCode(...passwordHashBuffer));
  },

  login: (email, password) => {
    const passwordHash = await hashPassword(password, email)
    const response = await fetch(`${nodeJsServerUrl}/auth`, { method: "POST", headers: { h: passwordHash } })
    if (response.status === 200) {
      user = await response.json()
      saveUser()
      invalidateLocal()
      console.log(user)
    } else {
      notifyText("Don't know that username + password.")
    }
  },

  signup: (email, username, password) => {
    const passwordHash = await hashPassword(password, email)
    const jsonBody = JSON.stringify({ h: passwordHash, u: username, e: email, s: user.s })
    console.log(jsonBody)
    const response = await fetch(`${nodeJsServerUrl}/signup`, { method: "POST", body: jsonBody })
    if (response.status === 200) {
      console.log(response)
      user = await response.json()
      saveUser()
      invalidateLocal()
      console.log(`signed up`)
    } else {
      const responseText = await response.json()
      notifyText(responseText)
    }
  },

  requestWrapper: async (endpoint, headers, body) => {
    headers.h = user.h
    const response = await fetch(`${nodeJsServerUrl}/${endpoint}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      })
    const json = await response.json()
    return { status: response.status, body: json }
  },

  get: async (graphName) => {
    const response = await clientGo.requestWrapper(`create/${graphName}`, {}, blox)
    return response.status == 200 ? undefined : response.status
  },

  create: async (graphName, blox) => {

  },

  edit: async (graphName, syncCommitId, edits) => {

  },

  compact: async (graphName, beginCommitId, endCommitId) => {

  },
}

// idElements.loginForm.addEventListener("submit", async (event) => {
//   event.preventDefault()
//   const email = idElements.loginEmail.value
//   idElements.loginEmail.value = ""
//   const password = idElements.loginPassword.value
//   idElements.loginPassword.value = ""
//   login(email, password)
// })

// idElements.signupForm.addEventListener("submit", async (event) => {
//   event.preventDefault()
//   const email = idElements.signupEmail.value
//   idElements.signupEmail.value = ""
//   const username = idElements.signupUsername.value
//   idElements.signupUsername.value = ""
//   const password = idElements.signupPassword.value
//   idElements.signupPassword.value = ""
//   signup(email, username, password)
// })
