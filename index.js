// State
let database = null;
let editingBlock = null;
let oldestLoadedDailyNoteDate = null;

// Constants

// Templates
const pageTemplate = document.getElementById("page").content.firstElementChild;
const blockTemplate = document.getElementById("block").content.firstElementChild;
const backrefsListTemplate = document.getElementById("backrefs-list").content.firstElementChild;
const blockFocusFrameTemplate = document.getElementById("block-focus-frame").content.firstElementChild;

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
    const title = database.eav[curBlockId].title
    if (title) {
      const titleElement = document.createElement("span");
      titleElement.innerText = title;
      parentNode.insertBefore(beforeNode, titleElement)
      beforeNode = titleElement;
    } else {
      curBlockId = database.vae[curBlockId]["children"]
      const content = document.createElement("span");
      content.innerText = truncateElipsis(database.eav[curBlock].string, 40)
      parentNode.insertBefore(beforeNode, content);
      beforeNode = content;
    }
    break;
  }
  initialBeforeNode.remove();
}

// App state transitions
const gotoBlack = () => {
  oldestLoadedDailyNoteDate = null;
  document.removeEventListener("scroll", dailyNotesInfiniteScrollListener);
  pageFrame.textContent = "";
}

const gotoPageTitle = (title) => {
  const existingPage = (database.vae[title].title)[0];
  if (existingPage) {
    gotoBlack();
    renderPage(pageFrame, existingPage);
  }
};

const gotoDailyNotes = () => {
  gotoBlack();
  document.addEventListener("scroll", dailyNotesInfiniteScrollListener);
  oldestLoadedDailyNoteDate = new Date(Date.now());
  oldestLoadedDailyNoteDate.setDate(oldestLoadedDailyNoteDate.getDate() - 1);
  for (let i = 0; i < 10; i++) {
    const daysNotes =
      database.vae[formatDate(oldestLoadedDailyNoteDate)].title;
    if (daysNotes) {
      renderPage(pageFrame, (daysNotes)[0]);
      oldestLoadedDailyNoteDate.setDate(
        oldestLoadedDailyNoteDate.getDate() - 1
      );
    }
  }
};

// todo make this page look ok
const gotoBlock = (blockId) => {
  gotoBlack();
  const blockFocusFrame = blockFocusFrameTemplate.cloneNode(true);
  pageFrame.appendChild(blockFocusFrame);
  renderBlock(blockFocusFrame, blockId);
}

// Rendering
const renderPage = (parentNode, entityId) => {
  const element = pageTemplate.cloneNode(true);
  const title = element.firstElementChild;
  const body = element.children[1];

  title.innerText = database.eav[entityId].title;

  const children = database.eav[entityId]["children"];
  if (children) {
    for (let child of children) {
      renderBlock(body, child);
    }
  }
  /*
    const backrefs = database.vae[entityId][":block/refs"];
    if (backrefs) {
      const backrefsListElement = backrefsListTemplate.cloneNode(true);
      element.children[2].appendChild(backrefsListElement)
      for (let backref of backrefs) {
        renderBlock(backrefsListElement, backref);
      }
    }
  */
  parentNode.appendChild(element);
};

const renderBlock = (parentNode, entityId) => {
  const element = blockTemplate.cloneNode(true);
  const body = element.children[1];
  const childrenContainer = element.children[2];
  element.setAttribute("data-id", entityId);

  const string = database.eav[entityId].string
  if (string) {
    renderBlockBody(body, string);
  }

  const children = database.eav[entityId]["children"];
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
      database.vae[formatDate(oldestLoadedDailyNoteDate)].title;
    if (daysNotes) {
      renderPage(pageFrame, (daysNotes)[0]);
    }
  }
};

const saveHandler = () => {
  console.log("save")
}

const uploadHandler = () => {
  console.log("upload")

}

const downloadHandler = () => {
  console.log("download")
  const result = [];
  for (let pageId in database.aev["title"]) {
    console.log(pageId);
    result.push(database.pull(pageId));
  }
  const json = JSON.stringify(result);
  console.log(json);
}

document.addEventListener("input", (event) => {
  if (event.target.className === "block__body") {
    const id = event.target.parentNode.dataset.id;
    database.setDatom(id, ":block/string", event.target.value);
  }
});

document.addEventListener("keydown", (event) => {
  // Check for global shortcut keys
  if (event.key === "d" && event.ctrlKey) {
    uploadHandler()
    event.preventDefault()
    return;
  }
  if (event.key === "s" && event.ctrlKey && event.shiftKey) {
    downloadHandler()
    event.preventDefault()
    return;
  }
  if (event.key === "s" && event.ctrlKey) {
    saveHandler()
    event.preventDefault()
    return;
  }
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
        blocks = (document.querySelectorAll(".block__body"));
        const newActiveBlock = blocks[blocks.indexOf(event.target) + 1];
        window.getSelection().collapse(newActiveBlock, 0);
        break;
      case "ArrowUp":
        blocks = (document.querySelectorAll(".block__body"));
        blocks[blocks.indexOf(event.target) - 1].focus();
        break;
      case "ArrowLeft":
        if (window.getSelection().focusOffset === 0) {
          blocks = (document.querySelectorAll(".block__body"));
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
          blocks = (document.querySelectorAll(".block__body"));
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
  const closestBullet = event.target.closest(".block__bullet-hitbox")
  if (event.target.className === "page-ref__body") {
    gotoPageTitle(event.target.innerText);
  } else if (closestBullet) {
    gotoBlock(closestBullet.parentNode.dataset.id)
  } else if (event.target.className === "block-ref") {
    gotoBlock(event.target.dataset.id)
  } else if (event.target.closest(".tag")) {
    gotoPageTitle(event.target.closest(".tag").innerText.substring(1));
  } else if (event.target.id === "upload-button") {
    uploadHandler()
  } else if (event.target.id === "download-button") {
    downloadHandler()
  } else if (event.target.id === "save-button") {
    saveHandler()
  }
});

start = () => {
  // Load database
  const loadSTime = performance.now();
  database = new DQ({ many: [":node/subpages", ":vc/blocks", ":edit/seen-by", ":attrs/lookup", ":node/windows", ":node/sections", ":harc/v", ":block/refs", ":harc/a", "children", ":create/seen-by", ":node/links", ":query/results", ":harc/e", ":block/parents"] })
  for (let page of roamJSON) {
    database.push(page);
  }
  console.log(`loaded data into DQ in ${performance.now() - loadSTime}`);
  console.log(database)
  console.log(database.aev[":block/chidren"])
  gotoDailyNotes();
}
if (partnerLoaded) start();
partnerLoaded = true;

// console.log(
//   "Application state is stored as global variables. This means you can observe and change everything from the console. Some important globals are: database, editingBlock"
// );
