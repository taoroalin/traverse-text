let now = new Date(Date.now());
now.setDate(now.getDate() - 1);

let manyAttributes = [];
let refAttributes = [];
let database = new DQ();

const renderPage = (parentNode, entityId) => {
  const element = document.getElementById("page").content.cloneNode(true);
  element.querySelector(".page__title").innerText =
    database.eav[entityId]["node/title"];
  const childrenContainer = element.querySelector(".page__body");
  const children = database.eav[entityId]["block/children"];
  for (let child of children) {
    renderBlock(childrenContainer, child);
  }
  parentNode.appendChild(element);
};

const renderBlock = (parentNode, entityId) => {
  const element = document.getElementById("block").content.cloneNode(true);
  element.querySelector(".block__body").innerText =
    database.eav[entityId]["block/string"];
  const childrenContainer = element.querySelector(".block__children");
  const children = database.eav[entityId]["block/children"];
  if (children) {
    for (let child of children) {
      renderBlock(childrenContainer, child);
    }
  }
  parentNode.appendChild(element);
};

fetch("graphminer.edn").then((data) => {
  data.text().then((text) => {
    const roamEDN = parseEdn(text);
    const datoms = roamEDN[0].datoms;
    const schema = roamEDN[0].schema;
    for (let [k, v] of Object.entries(schema)) {
      if (v["db/cardinality"] === "db.cardinality/many") {
        manyAttributes.push(k);
      }
      if (v["db/valueType"] === "db.type/ref") {
        refAttributes.push(k);
      }
    }
    const stime = performance.now();
    for (let datom of datoms) {
      if (manyAttributes.includes(datom[1])) {
        database.addDatom(
          datom[0] + DQ.minEntityId,
          datom[1],
          refAttributes.includes(datom[1])
            ? datom[2] + DQ.minEntityId
            : datom[2]
        );
      } else {
        database.setDatom(
          datom[0] + DQ.minEntityId,
          datom[1],
          refAttributes.includes(datom[1])
            ? datom[2] + DQ.minEntityId
            : datom[2]
        );
      }
    }
    console.log(`loaded in ${performance.now() - stime}`);
    console.log(database);

    const todaysNotes = database.queryPull([
      DQ.$,
      "node/title",
      formatDate(now),
    ])[0];
    console.log(todaysNotes);

    renderPage(document.getElementById("app"), todaysNotes.entityId);
  });
});
