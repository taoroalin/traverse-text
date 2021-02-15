const page = (string) => {
  console.log(store.pages[store.pagesByTitle[string]])
}

const log = () => {
  user.logging = true
  saveUser()
  saveWorker.postMessage(["user",user])
}

const nolog = () => {
  user.logging = false
  saveUser()
  saveWorker.postMessage(["user",user])
}