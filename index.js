// State
let database = new DQ();
let editingBlock = null;
let oldestLoadedDailyNoteDate = null;

// Constants

const attributesICareAbout = [
  "node/title",
  "block/children",
  "block/string",
  "block/order",
  "block/open",
  "block/refs",
  "block/uid",
  "children/view-type",
  "create/time"
];

// Templates
const pageTemplate = document.getElementById("page").content.firstElementChild;
const blockTemplate = document.getElementById("block").content.firstElementChild;
const backrefsListTemplate = document.getElementById("backrefs-list").content.firstElementChild;

// Singleton elements
const searchElement = document.getElementById("search");
const pageFrame = document.getElementById("page-frame");
const searchInput = document.getElementById("search__input");

// Utils
const renderBlockBreadcrumb = (parentNode, blockId) => {
  const initialBeforeNode = document.createElement("div");
  let beforeNode = initialBeforeNode;
  let curBlockId = blockId;
  while (true) {
    const title = database.eav[curBlockId]["node/title"]
    if (title) {
      const titleElement = document.createElement("span");
      titleElement.innerText = title;
      parentNode.insertBefore(beforeNode, titleElement)
      beforeNode = titleElement;
    } else {
      curBlockId = database.vae[curBlockId]["block/children"]
      const content = document.createElement("span");
      content.innerText = truncateElipsis(database.eav[curBlock]["block/string"], 40)
      parentNode.insertBefore(beforeNode, content);
      beforeNode = content;
    }
    break;
  }
  initialBeforeNode.remove();
}

// App state transitions
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
  const title = element.firstElementChild;
  const body = element.children[1];

  title.innerText = database.eav[entityId]["node/title"];

  const children = database.eav[entityId]["block/children"];
  if (children) {
    for (let child of children) {
      renderBlock(body, child);
    }
  }

  const backrefs = database.vae[entityId]["block/refs"];
  if (backrefs) {
    const backrefsListElement = backrefsListTemplate.cloneNode(true);
    element.children[2].appendChild(backrefsListElement)
    for (let backref of backrefs) {
      renderBlock(backrefsListElement, backref);
    }
  }

  parentNode.appendChild(element);
};

const renderBlock = (parentNode, entityId) => {
  const element = blockTemplate.cloneNode(true);
  const body = element.firstElementChild;
  const childrenContainer = element.children[1];
  element.setAttribute("data-id", entityId);

  const string = database.eav[entityId]["block/string"]
  if (string) {
    renderBlockBody(body, string);
  }

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
      searchInput.value = "";
      searchInput.focus();
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
      searchElement.style.display = "none";
      event.preventDefault();
      return;
    }
  }
});

document.addEventListener("click", (event) => {
  if (event.target.className === "page-ref__body") {
    gotoPageTitle(event.target.innerText);
  } else if (event.target.closest(".tag")) {
    gotoPageTitle(event.target.closest(".tag").innerText.substring(1));
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
    if (true || attributesICareAbout.includes(datom[1]))
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
