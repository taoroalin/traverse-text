// State
let database = new DQ();
let editingBlock = null;
let oldestLoadedDailyNoteDate = null;

// Constants

const attributesICareAbout = [
  "block/children",
  "block/string",
  "node/title",
  "block/order",
  "block/open",
];

// Templates
const pageTemplate = document.getElementById("page").content;
const blockTemplate = document.getElementById("block").content;

const searchElement = document.getElementById("search");
const pageFrame = document.getElementById("page-frame");

const gotoPageTitle = (title) => {
  oldestLoadedDailyNoteDate = null;
  document.removeEventListener("scroll", dailyNotesInfiniteScrollListener);

  const existingPage = Array.from(database.vae[title]["node/title"])[0];
  if (existingPage) {
    pageFrame.textContent = "";
    renderPage(pageFrame, existingPage);
  }
};

const gotoDailyNotes = () => {
  document.removeEventListener("scroll", dailyNotesInfiniteScrollListener);
  document.addEventListener("scroll", dailyNotesInfiniteScrollListener);
  pageFrame.textContent = "";
  oldestLoadedDailyNoteDate = new Date(Date.now());
  oldestLoadedDailyNoteDate.setDate(oldestLoadedDailyNoteDate.getDate() - 1);
  for (let i = 0; i < 10; i++) {
    const daysNotes =
      database.vae[formatDate(oldestLoadedDailyNoteDate)]["node/title"];
    if (daysNotes) {
      renderPage(pageFrame, Array.from(daysNotes)[0]);
      oldestLoadedDailyNoteDate.setDate(
        oldestLoadedDailyNoteDate.getDate() - 1
      );
    }
  }
};

// Rendering
const renderPage = (parentNode, entityId) => {
  const element = pageTemplate.cloneNode(true);
  const title = element.firstElementChild.firstElementChild;
  const body = element.firstElementChild.children[1];
  title.innerText = database.eav[entityId]["node/title"];
  const children = database.eav[entityId]["block/children"];
  if (children) {
    for (let child of children) {
      renderBlock(body, child);
    }
  }
  parentNode.appendChild(element);
};

const renderBlock = (parentNode, entityId) => {
  const element = blockTemplate.cloneNode(true);
  const body = element.firstElementChild.firstElementChild;
  const childrenContainer = element.firstElementChild.children[1];
  element.firstElementChild.setAttribute("data-id", entityId);
  renderBlockBody(body, database.eav[entityId]["block/string"]);
  const children = database.eav[entityId]["block/children"];
  if (children) {
    for (let child of children) {
      renderBlock(childrenContainer, child);
    }
  }
  parentNode.appendChild(element);
};

// Global event listeners that switch on active element, as a possibly more performant, simpler option than propagating through multiple event handlers

const dailyNotesInfiniteScrollListener = (event) => {
  const fromBottom =
    pageFrame.getBoundingClientRect().bottom - window.innerHeight;
  if (fromBottom < 700) {
    oldestLoadedDailyNoteDate.setDate(oldestLoadedDailyNoteDate.getDate() - 1);
    const daysNotes =
      database.vae[formatDate(oldestLoadedDailyNoteDate)]["node/title"];
    if (daysNotes) {
      renderPage(pageFrame, Array.from(daysNotes)[0]);
    }
  }
};

document.addEventListener("input", (event) => {
  if (event.target.className === "block__body") {
    const id = event.target.parentNode.dataset.id;
    database.setDatom(id, "block/string", event.target.value);
  }
});

document.addEventListener("keydown", (event) => {
  // Check for global shortcut keys
  if (event.key === "m" && event.ctrlKey) {
    if (document.body.className === "light-mode") {
      document.body.className = "dark-mode";
    } else {
      document.body.className = "light-mode";
    }
    event.preventDefault();
    return;
  }
  if (event.key === "d" && event.altKey) {
    gotoDailyNotes();
    event.preventDefault();
    return;
  }
  if (event.key === "Escape") {
    // if escape key, get rid of ALL modal / popup whatevers, don't care which one we're in right now
    searchElement.style.display = "none";
    return;
  }
  if (event.ctrlKey && event.key === "u") {
    if (searchElement.style.display === "none") {
      searchElement.style.display = "block";
      document.getElementById("search__input").focus();
    } else {
      searchElement.style.display = "none";
    }
    event.preventDefault();
    return;
  }

  // Check for actions based on active element
  if (
    document.activeElement &&
    document.activeElement.className === "block__body"
  ) {
    let blocks;
    switch (event.key) {
      case "Enter":
        break;
      case "Tab":
        if (event.shiftKey) {
        } else {
        }
        event.preventDefault();
        break;
      case "ArrowDown":
        blocks = Array.from(document.querySelectorAll(".block__body"));
        const newActiveBlock = blocks[blocks.indexOf(event.target) + 1];
        window.getSelection().collapse(newActiveBlock, 0);
        break;
      case "ArrowUp":
        blocks = Array.from(document.querySelectorAll(".block__body"));
        blocks[blocks.indexOf(event.target) - 1].focus();
        break;
      case "ArrowLeft":
        if (window.getSelection().focusOffset === 0) {
          blocks = Array.from(document.querySelectorAll(".block__body"));
          blocks[blocks.indexOf(document.activeElement) - 1].focus();
          // TODO it only goes to second last, .collapse doesn't select after the last char
          window
            .getSelection()
            .collapse(
              document.activeElement.firstChild,
              document.activeElement.innerText.length
            );
        }
        break;
      case "ArrowRight":
        if (
          window.getSelection().focusOffset ===
          document.activeElement.innerText.length
        ) {
          blocks = Array.from(document.querySelectorAll(".block__body"));
          blocks[blocks.indexOf(document.activeElement) + 1].focus();
        }
        break;
    }
  } else if (
    document.activeElement &&
    document.activeElement.id === "search__input"
  ) {
    if (event.key === "Enter") {
      gotoPageTitle(event.target.value);
      event.preventDefault();
      return;
    }
  }
});

document.addEventListener("click", (event) => {
  if (event.target.className === "page-ref__body") {
    gotoPageTitle(event.target.innerText);
  }
});

async function start() {
  // Load database
  const response = await fetch("test-data/graphminer.edn");
  const ednText = await response.text();
  const roamEDN = parseEdn(ednText);
  const datoms = roamEDN[0].datoms;
  const schema = roamEDN[0].schema;
  let manyAttributes = [];
  let refAttributes = [];
  for (let [k, v] of Object.entries(schema)) {
    if (v["db/cardinality"] === "db.cardinality/many") {
      manyAttributes.push(k);
    }
    if (v["db/valueType"] === "db.type/ref") {
      refAttributes.push(k);
    }
  }
  const loadSTime = performance.now();
  for (let datom of datoms) {
    if (attributesICareAbout.includes(datom[1]))
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
  console.log(`loaded data into DQ in ${performance.now() - loadSTime}`);

  gotoDailyNotes();

  let textLength = 0;
  const bs = database.aev["block/string"];
  for (let k in bs) {
    textLength += bs[k].length;
  }
  console.log(`my text is ${textLength} long`);
  // console.log(JSON.stringify(database.eav));
}

start();

// console.log(
//   "Application state is stored as global variables. This means you can observe and change everything from the console. Some important globals are: database, editingBlock"
// );
