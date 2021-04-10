
const hashPassword = (password, email) => {
  const middlePepper = "76pCgT0lW6ES9yjt01MeH"
  const beginPepper = "CeoPPOv9rIq6O7YiYlSFX"
  const endPepper = "Rzw1dagomQGpoo2s7iGE3lYL2yruaJDGrUk6bFCvz"

  const saltAndPeppered = `${beginPepper}${password}${middlePepper}${email}${endPepper}`
  const buffer = textEncoder.encode(saltAndPeppered)
  const hashed = await crypto.subtle.digest("SHA-512", buffer)
  const passwordHashBuffer = new Uint8Array(hashed)
  let passwordHash = ""
  for (let i = 0; i < passwordHashBuffer.length; i++) {
    passwordHash += String.fromCharCode(passwordHashBuffer[i])
  }
  passwordHash = btoa(passwordHash)
  passwordHash = passwordHash.replaceAll("/", "-").replaceAll("+", "_").replaceAll("=", "")
  return passwordHash
}


class UserManagerClass {
  constructor() {
    this.user = { s: { graphName: "default", theme: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "light", topBar: "visible", logging: false, spellcheck: false, editingSpotlight: true } }
    let userText = localStorage.getItem("user")
    if (userText) {
      this.user = JSON.parse(userText)
      this.applySettings()
      this.overwriteFromServer() // could track local vs server settings changes, but that's for another time
    }

  }

  async login(email, password) {
    const passwordHash = await hashPassword(password, email)
    const response = await fetch(`${apiUrl}/auth`, { method: "POST", headers: { h: passwordHash } })
    if (response.status === 200) {
      this.user = await response.json()
      this.saveToLocalStorage()
      invalidateStores()
    } else {
      notifyText("Don't know that username + password.")
    }
  }

  async signup(email, username, password) {
    const passwordHash = await hashPassword(password, email)
    const jsonBody = JSON.stringify({ h: passwordHash, u: username, e: email, s: this.user.s })
    const headers = new Headers()
    headers.set('body', jsonBody)
    const response = await fetch(`${apiUrl}/signup`, { method: "POST", headers })
    if (response.status === 200) {
      this.user = await response.json()
      saveUser()
      invalidateStores()
    } else {
      const responseText = await response.json()
      notifyText(responseText)
    }
  }

  setSetting(key, val) {
    this.user.s[key] = val
    this.apply()
  }

  apply() {
    this.applyUserToDOM()
    this.saveToLocalStorage()
    this.saveToServer()
  }

  applyUserToDOM() {

    showTopBar = () => {
      topBar.style.marginTop = "0px"
      topBarHiddenHitbox.style.display = "none"
    }

    hideTopBar = () => {
      topBar.style.marginTop = "-36px"
      topBarHiddenHitbox.style.display = "block"
    }

    document.body.className = this.user.s.theme
    if (this.user.s.topBar === "visible") this.showTopBar()
    else this.hideTopBar()

    document.body.spellcheck = this.user.s.spellcheck
    document.body.dataset['editingspotlight'] = this.user.s.editingSpotlight

    if (user.h) {
      topButtons["Sign Out"].style.display = "block"
      topButtons["Sign Up"].style.display = "none"
      topButtons["Login"].style.display = "none"
    } else {
      topButtons["Sign Out"].style.display = "none"
      topButtons["Sign Up"].style.display = "block"
      topButtons["Login"].style.display = "block"
    }
  }

  saveToLocalStorage() {
    localStorage.setItem("user", JSON.stringify(this.user))
  }

  saveToServer() {
    const headers = new Headers()
    headers.set('h', this.user.h)
    headers.set('body', JSON.stringify(this.user.s))
    const response = await fetch(`${apiUrl}/settings`,
      { headers })
    if (response.status !== 200) {
      console.log("failed to save settings")
    }
  }

  async overwriteFromServer() {
    const headers = new Headers()
    headers.set('h', this.user.h)
    const response = await fetch(`${apiUrl}/auth`,
      { headers })
    if (response.status !== 200) {
      console.log("failed to save settings")
      return
    }
    const json = await response.json()
    this.user = json
    this.apply()
  }
}
const userManager = new UserManagerClass()