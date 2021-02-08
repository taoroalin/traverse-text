const maxEntityId = -1
const manyAttributes = { "lines": true,":drawing/lines": true,":node/subpages": true,":vc/blocks": true,":edit/seen-by": true,":attrs/lookup": true,":node/windows": true,":node/sections": true,":harc/v": true,":block/refs": true,":harc/a": true,"children": true,":create/seen-by": true,":node/links": true,":query/results": true,":harc/e": true,":block/parents": true }

const indexGet1 = (index,key1) => {
  if (index[key1] === undefined) {
    index[key1] = {}
  }
  return index[key1]
}
const indexGet2 = (index,key1,key2) => {
  if (index[key1] === undefined) {
    index[key1] = {}
  }
  const level = index[key1]
  if (level[key2] === undefined) {
    level[key2] = []
  }
  return level[key2]
}
const indexHas2 = (index,key1,key2) => {
  return index[key1] && index[key1][key2]
}

// negative numbers are entity ids

const roamJsonToDatabase = (graphName,roamJson) => {
  database = {
    nextEntityId: maxEntityId,
    graphName: graphName,
    eav: {},
    aev: {},
    vae: {},
    changeStack: [],
    currentChanges: []
  }
  for (let page of roamJson) {
    databasePush(page)
  }
}

const eavToDatabase = (graphName,eav) => {
  database = {
    nextEntityId: maxEntityId,
    graphName: graphName,
    eav: eav,
    aev: {},
    vae: {},
    changeStack: [],
    currentChanges: []
  }
  for (let ke in eav) {
    const av = eav[ke]
    for (let ka in av) {
      if (database.aev[ka] === undefined) {
        database.aev[ka] = {}
      }
      const v = av[ka]
      database.aev[ka][ke] = v
      if (typeof v !== "object") {
        if (database.vae[v] === undefined) {
          database.vae[v] = {}
        }
        const ae = database.vae[v]
        if (ae[ka] === undefined)
          ae[ka] = []
        ae[ka].push(ke)
      } else if (v instanceof Array) {
        for (let sv of v) {
          if (database.vae[sv] === undefined) {
            database.vae[sv] = {}
          }
          const ae = database.vae[sv]
          if (ae[ka] === undefined)
            ae[ka] = []
          ae[ka].push(ke)
        }
      }
    }
  }
}

const databaseNewEntity = () => {
  database.nextEntityId -= 1
  return database.nextEntityId + 1
}


// modify the database while maintaining indices, but without storing diff or calling listeners

const databaseAdd = (entity,attribute,value) => {
  database.nextEntityId = Math.min(database.nextEntityId,entity - 1)
  indexGet2(database.eav,entity,attribute).push(value)
  indexGet2(database.aev,attribute,entity).push(value)

  if (typeof value !== "object") {
    indexGet2(database.vae,value,attribute).push(entity)
  }
}

const databaseSet = (entity,attribute,value) => {
  database.nextEntityId = Math.min(database.nextEntityId,entity - 1)
  indexGet1(database.eav,entity)[attribute] = value
  indexGet1(database.aev,attribute)[entity] = value

  if (typeof value !== "object") {
    indexGet2(database.vae,value,attribute).push(entity)
  }
}

const databaseSetAll = (entity,attribute,value) => {
  const oldValues = database.eav[entity][attribute]
  database.aev[attribute][entity] = value
  database.eav[entity][attribute] = value
  for (let oldValue of oldValues) {
    database.vae[oldValue][attribute] = database.vae[oldValue][attribute].filter(e => e !== entity) // @to-perf ofc this is slow @slow @idkhowtosearchmycode
  }
  for (let value of value) {
    if (database.vae[value] === undefined) {
      database.vae[value] = {}
    }
    const ae = database.vae[value]
    if (ae[attribute] === undefined) {
      ae[attribute] = []
    }
    ae[attribute].push(entity)
  }
}


// Modify the database while maintaining undo stack, calling listeners, and persisting changes.

const databaseChange = (change,commitMain,commitWorker) => {
  const [op,entity,attribute,value] = change
  if (op === "set") {
    databaseSet(entity,attribute,value)
  } else if (op === "add") {
    databaseAdd(entity,attribute,value)
  } else if (op === "setAll") {
    databaseSetAll(entity,attribute,value)
  }
  if (op !== "add" && change.length > 5)
    change.push(database.eav[entity][attribute])
  database.currentChanges.push(change)
  if (commitMain) {
    saveWorker.postMessage(["change",database.currentChanges])
    database.changeStack.push(database.currentChanges)
    database.currentChanges = []
  }
  if (commitWorker) {
    database.changeStack.push(database.currentChanges)
    database.currentChanges = []
  }
}

// no redo yet
const databaseUndo = () => {
  const changeSet = database.changeStack.pop()
  for (let i = changeSet.length - 1; i >= 0; i--) {
    const change = changeSet[i]
    if (op === "set") {
      databaseSet(change[1],change[2],change[4])
    } else if (op === "add") {
      databaseAdd(change[1],change[2],change[4])
    } else if (op === "setAll") {
      databaseSetAll(change[1],change[2],change[4])
    }
  }
  if (saveWorker !== undefined) {
    saveWorker.postMessage(["undo",null]) // standard to send len 2 array. second will be ignored
  }
}


// Push / Pull : convert objects to rdf and back

const databasePull = (entityId,includeId = false) => {
  // Keep track of seen entities to capture recursive data structures
  const entityIdToObj = {}
  const pull = (entityId) => {
    const result = {}
    if (includeId) result.entityId = entityId
    entityIdToObj[entityId] = result
    const entity = indexGet1(database.eav,entityId)
    for (let attribute in entity) {
      const value = entity[attribute]
      if (attribute === ":block/refs") {
        result[attribute] = value.map(uid => ({ ":block/uid": uid }))
      } else if (attribute === "refs") {
        result[attribute] = value.map(uid => ({ "uid": uid }))
      } else if (attribute === ":create/user" || attribute === ":edit/user") {
        result[attribute] = { ":user/uid": value }
      } else if (manyAttributes[attribute]) {
        result[attribute] = []
        for (let v of value) {
          if (typeof v === "number" && v <= maxEntityId) {
            if (entityIdToObj[v])
              result[attribute].push(entityIdToObj[v])
            else result[attribute].push(pull(v))
          } else result[attribute].push(v)
        }
      } else {
        if (typeof value === "number" && value <= maxEntityId) {
          if (entityIdToObj[value])
            result[attribute] = entityIdToObj[value]
          else result[attribute] = pull(value)
        } else result[attribute] = value
      }
    }
    return result
  }
  return pull(entityId)
}

const databasePush = (obj,objId) => {
  if (objId === undefined) objId = databaseNewEntity(database)
  const push = (obj,objId) => {
    for (let attribute in obj) {
      const value = obj[attribute]
      if (typeof value !== "object") {
        databaseSet(objId,attribute,value)
      } else if (value instanceof Array) {
        if (attribute === ":block/refs") {
          for (let x of value) {
            databaseAdd(objId,attribute,x[":block/uid"])
          }
        } else if (attribute === "refs") {
          for (let x of value) {
            databaseAdd(objId,attribute,x["uid"])
          }
        } else {
          for (let setElement of value) {
            if (typeof setElement !== "object" || setElement instanceof Array) {
              databaseAdd(objId,attribute,setElement)
            } else {
              let elId = databaseNewEntity(database)
              databaseAdd(objId,attribute,elId) // could pull attr check in here out of loop @to-perf
              push(setElement,elId)
            }
          }
        }
      } else if (attribute === ":create/user" || attribute === ":edit/user") {
        databaseSet(objId,attribute,value[":user/uid"])
      } else {
        let valId = databaseNewEntity(database)
        databaseSet(objId,attribute,valId)
        push(value,valId)
      }
    }
  }
  push(obj,objId)
  return objId
}
// ACTUAL CODE START----------------------------------------------------------------------------------------------

let idb = null
let database = null

const dbReq = indexedDB.open("microroam",1)
dbReq.onsuccess = (event) => {
  idb = event.target.result
}

onmessage = (event) => {

  const operation = event.data[0]
  const data = event.data[1]

  if (operation === "db") {
    console.log("setting database")
    console.log(data)
    database = data
  } else if (operation === "save") {
    database = data
    saveDatabase()

  } else if (operation === "change") {
    console.log("change")
    for (let i = 0; i < data.length - 1; i++) {
      databaseChange(data[i],false)
    }
    databaseChange(data[data.length - 1],false,true)
    saveDatabase()
  } else if (operation === "undo") {
    databaseUndo(database)
    saveDatabase()
  }
}

const saveDatabase = () => {
  const transaction = idb.transaction(["graphs"],"readwrite")
  const store = transaction.objectStore("graphs")
  const req = store.put({ graphName: database.graphName,graph: JSON.stringify(database) })
  req.onsuccess = () => console.log("success")

  req.onerror = (event) => {
    console.log("save error")
    console.log(event)
  }
}