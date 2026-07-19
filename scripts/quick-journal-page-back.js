/**
 * Quick-Journal-Page-Back – Foundry VTT V13 & V14
 * A small plugin that adds a history cache for visited pages and allows to navigate forward and backward.
 */

// Hooks.events in console to investigate Hooks
//CONFIG.debug.hooks = true

let pageHistory = null;

class JournalHistoryManager {
  // If a user connects we delete his history cache and also manage each user seperately 
  // TODO: Was a first good idea and works but check if this makes sense as the data seems scoped anyway
  constructor(maxLength) {
    this.MAX_LENGTH = maxLength - 1; // Max stored history pages for each user
    this.userHistories = new Map(); // Key: User ID, Value: Array<PageID>
    this.connectedUser = new Set(); //active user tracking - results in unique key in map
    this._buttonAction = 0; //0 not pressed, 1 = forward, 2 = backward, 3 = any button
    this.suppressedPageUuid = null; // added tracker of supressedUUID
    this.historyIndex = -1;

  }

  set buttonAction(button) {
    this._buttonAction = button;
  }

  get buttonAction() {
    return this._buttonAction
  }

  //added: suppress page
  suppressNextPage(pageUuid) {
    this.suppressedPageUuid = pageUuid;
  }
  // addes skipHistory
  shouldSkipHistoryPage(pageUuid) {
    if (this.suppressedPageUuid !== pageUuid) {
      return false;
    } else {
      this.suppressedPageUuid = null;
      this.buttonAction = 0;
      return true;
    }
  }

  async goForward() {

    const activeUser = game.user.id; //get the active user to retrieve HIS list
    let JournalList = this.getHistoryList(activeUser) //get the users history List

    const backHistoryLength = JournalList.length; //get the current length of the history list
    if (this.historyIndex > backHistoryLength - 1) { this.historyIndex = backHistoryLength - 1; } // make sure the index for the tracking cannot go beyond the actuall JournalList length
    this.historyIndex = this.historyIndex - 1;
    if (this.historyIndex < 0) { this.historyIndex = 0 };// make sure the index for the tracking cannot go below the actuall JournalList index which is 0 for arrays

    if (backHistoryLength > this.historyIndex && this.historyIndex < backHistoryLength) { //make sure historyIndex is in between max and min of JournalList length

      const uuid = JournalList[this.historyIndex]; //get the uuid of the PAGE which is a FULL foundry UUUID -->Journal.xxx.Page.yyy from the JournalList
      this.buttonAction = 3; // indicate action was triggered by button and not manually
      this.suppressNextPage(uuid); //So do not add any page we are just navigating
      await openJournalAndShowPage(uuid); //Navigate to page according to history in JournalList

    }
  }

  async goBackward() {
    const activeUser = game.user.id;
    let JournalList = this.getHistoryList(activeUser)

    if (this.historyIndex === -1) { this.historyIndex = 0 } // if the history index is -1 it was reset by a manual navigation and we need to start our index at 0

    const backHistoryLength = JournalList.length;
    this.historyIndex = this.historyIndex + 1;
    if (this.historyIndex > backHistoryLength - 1) { this.historyIndex = backHistoryLength - 1; }

    if (backHistoryLength > this.historyIndex && this.historyIndex < backHistoryLength) {
      if (this.historyIndex > this.MAX_LENGTH) { this.historyIndex = this.MAX_LENGTH }; // make sure we cannot go back more than defined in settings

      const uuid = JournalList[this.historyIndex];
      this.buttonAction = 3; // indicate action was triggered by button and not manually
      this.suppressNextPage(uuid);
      await openJournalAndShowPage(uuid);
      //this.buttonAction = 0; //restore old setting
    }
  }


  //=== "Other functions of the objekt" ===
  // creates the history list or removes it from the array (on connect or disconnect) - making sure shaky connects do not play havoc
  manageHistoryListExistence(userId) {
    if (this.connectedUser.has(userId)) {
      if (!this.userHistories.has(userId)) {
        this.userHistories.set(userId, []); // Init the history for the user
      }
    } else {
      if (this.userHistories.has(userId)) {
        this.userHistories.delete(userId); // Drop the history for the user
      }
    }
  }

  getHistoryList(userId) {
    if (this.connectedUser.has(userId)) {
      return this.userHistories.get(userId);
    } else {
      return [];
    }

  }

  // Adds the Journal+Page ID of a visited page and makes sure it does not exceed MAX_LENGTH.
  // @param {string} pageId - Die UUID der Journal Page.
  addHistoryPage(pageId) {

    const activeUser = game.user.id;
    let currentHistoryList = this.getHistoryList(activeUser)

    // adds a new page at the sart of the array
    currentHistoryList.unshift(pageId);
    //this.historyIndex = -1; // No manual selection of page took place so reset historyIndex

    // shorten the array if it exceeds the defined lenght
    if (currentHistoryList.length > this.MAX_LENGTH) {
      currentHistoryList = currentHistoryList.slice(0, this.MAX_LENGTH);
    }

    if (currentHistoryList.length >= 1) {
      if (this.connectedUser.has(activeUser)) {
        //if (this.userHistories.has(userId)) { // not necessary I think after all currentHistory List must be 1 or more
        this.userHistories.set(activeUser, currentHistoryList);
        //}
      }
    }
  }
}

;

Hooks.once("init", () => {

  // init an object to hold Page History
  pageHistory = new JournalHistoryManager(30);
  const version = game.version;  // e.g., "12.999"
  const major = parseInt(version.split('.')[0]);  // result is integer 12 or 13

  // sheet and html are passed down to the following functions making sure the html of the respective button is changed
  if (major <= 12) {
    Hooks.on("renderJournalSheet", (sheet, html, data) => {
      //console.log("QJPB: Version 12 found");
      let qjpsButtonExists = html[0].querySelector("aside.journal-sidebar .qjpb") ?? false;
      if (qjpsButtonExists) return;
      qjpbButtonCreation(sheet, html[0])
    })
  }
  if (major >= 13) {
    //console.log("QJPB: Version 13+ found");
    Hooks.on("renderJournalEntrySheet", (sheet, html, data) => {
      const qjpsButtonExists = html.querySelector("aside.journal-sidebar .qjpb") ?? false;
      if (qjpsButtonExists) return;
      qjpbButtonCreation(sheet, html)
    })
  };

  Hooks.on("userConnected", (user, connected) => {
    // user data with id and/or uuid
    //connected = true/false
    //console.log("QJPB: User on userConnected1: ",user);

    if (connected) {
      pageHistory.connectedUser.add(user.id);
      pageHistory.manageHistoryListExistence(user.id);
    }
    if (!connected) {
      pageHistory.connectedUser.delete(user.id);
      pageHistory.manageHistoryListExistence(user.id);
    };
  });

  // Register settings
  game.settings.register("quick-journal-page-back", "historyLength", {
    name: game.i18n.localize("QJPB.HistoryLength"),
    hint: game.i18n.localize("QJPB.HistoryLengthHint"),
    scope: "client",
    config: true,
    type: Number,
    default: 20,
    range: { min: 2, max: 50, step: 1 }
  });

  game.settings.register("quick-journal-page-back", "qjpbFontSize", {
    name: game.i18n.localize("QJPB.settings.qjpbFontSize.name"),
    hint: game.i18n.localize("QJPB.settings.qjpbFontSize.hint"),
    scope: "client",
    config: true,
    type: Number,
    default: 18,
    range: { min: 8, max: 32, step: 1 }
  });

  const fontSize = game.settings.get("quick-journal-page-back", "qjpbFontSize");
  document.documentElement.style.setProperty("--qjpb-font-size", `${fontSize}px`)

  console.log("QJPB: Quick-Journal-Page-Back has been initialized");
});

Hooks.once("ready", () => {
  //console.log("QJPB: Ready Hook Entered ==> List of users at start:", game.users.contents);

  let activeUsers = game.users.contents;
  if (activeUsers.length >= 1) { //this should not be a problem if there allways should be on active user but better safe than sorry

    activeUsers.forEach((user, index) => {
      if (user.active) {
        pageHistory.connectedUser.add(user.id)
        pageHistory.manageHistoryListExistence(user.id);
      }
    });
  }

  pageHistory.MAX_LENGTH = (game.settings.get("quick-journal-page-back", "historyLength") ?? 30) - 1;

})

Hooks.on("renderJournalEntryPageSheet", (data) => {
  //console.log("QJPB: Entered renderJournalEntryPageSheet ",data);

  //This gets the ID of the parent sheet of the current opened Page where the page is embedded in 
  const checkPageParentEmbedding = data.document.sheet.page.parent.sheet.id
  // This checks if the sheet is embeded in a journal APP. Apps is an Objekt/Set with all sheets with keys/properties of embeded sheet id's
  const pageInApps = data.document.sheet.page.parent.apps

  // If the id which is a journal ID is a key of the apps object then the page is embeded in a Journal
  if (checkPageParentEmbedding in pageInApps) {
    const activeUser = game.user.id;
    const pageId = data?.document?.uuid;
    if (!pageHistory) {
      console.error(game.i18n.localize("QJPB.error.pagelHistoryNotInit"));
      return;
    }

    // add return before page is added and reset page
    if (pageHistory.shouldSkipHistoryPage(pageId)) {
      //console.log("QJPB: page navigation skipped: ", pageId);
      return;
    }

    if (pageHistory.buttonAction === 0) {
      if (pageHistory.historyIndex > -1) {
        //replace the old history list with the history from the current index onward as the user branched with his manual entry
        const historyFromIndex = pageHistory.getHistoryList(activeUser).slice(pageHistory.historyIndex)
        pageHistory.userHistories.set(activeUser, historyFromIndex)
      }
      pageHistory.addHistoryPage(pageId)
      pageHistory.historyIndex = -1;
    }
  }
});

// Hook/Create our buttons into the Journal sidebar
function qjpbButtonCreation(sheet, html) {

  //get the container div holding the prev, add page and next button
  const container = html.querySelector("aside.journal-sidebar .action-buttons.flexrow");
  const containerTag = container.tagName
  //console.log("Container Tag is:",containerTag)

  // create the Back button
  const buttonBack = document.createElement('button');
  buttonBack.className = 'qjp-back';  // add own class for possible later styling
  buttonBack.title = game.i18n.localize("QJPB.Back");         // Native title for tooltip
  buttonBack.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i>';  // Font awesome icon/classes

  //add listener to the back button
  buttonBack.addEventListener('click', async () => {
    //console.log("QJPB: Back button was triggered");
    if (pageHistory) {
      pageHistory.buttonAction = 2;
      await pageHistory.goBackward()
    } else {
      console.error(game.i18n.localize("QJPB.error.pagelHistoryNotInit"));
    }
  });


  // create the Forward button
  const buttonForward = document.createElement('button');
  buttonForward.className = 'qjp-forward'; // add own class for possible later styling
  buttonForward.title = game.i18n.localize("QJPB.Forward"); // Native title for tooltip
  buttonForward.innerHTML = '<i class="fa-solid fa-rotate-right"></i>';  //  font awesom icon/classes
  //add listener to the forward button
  buttonForward.addEventListener('click', async () => {
    //console.log("QJPB: Forward")
    if (pageHistory) {
      pageHistory.buttonAction = 1;
      await pageHistory.goForward()
    } else { console.log("QJPB: pageHistory not yet initialized"); }
    ;
  });

  //check if container for buttons allready exists if Quick-Journal-Page-Sort ist allready installed/initialized
  const qjpContainer = html.querySelector(".qjp-buttons");

  if (!qjpContainer) {
    // create group div for new Buttons
    const newDiv = document.createElement('div');
    newDiv.classList.add('flexrow', 'qjp-buttons', 'qjpb');  // buttons class for qjp-BACK added to div
    //adding buttons to new group div
    newDiv.appendChild(buttonForward);
    newDiv.appendChild(buttonBack);


    //create group div which will hold the old buttons
    const buttonsDiv = document.createElement(containerTag);
    // give the new group the old styling classed of the old group
    buttonsDiv.classList.add('action-buttons', 'flexrow');
    //move the old buttons into the new div
    //DOM nodes can only exist in one place in the document at a time. When appendChild() moves a node, 
    //it automatically removes it from its previous parent.
    while (container.firstChild) {
      buttonsDiv.appendChild(container.firstChild);
    }

    //add both divs for new and old buttons to previous container
    container.appendChild(newDiv);
    container.appendChild(buttonsDiv);
    //remove the class flexrow from the previous container but keep action-buttons as it styles the container to be on the bottom of the pane
    container.classList.remove('flexrow');
  } else {
    //console.log("QJPB: SORT was first");
    qjpContainer.classList.add('qjpb');
    qjpContainer.prepend(buttonForward); // put the button as first in the row if Quick-Journal-PAge Sort is firt initialiazed
    qjpContainer.appendChild(buttonBack); // put the button as last in the row if Quick-Journal-PAge Sort is firt initialiazed
  }


};

/**
 * Open a journal, jump to a specific page from a full JournalPage UUID
 * @param {string} uuid - Full page UUID
 */
async function openJournalAndShowPage(uuid) {
  // Resolve the page from the (full) UUID
  const page = await fromUuid(uuid);
  if (!page) {
    ui.notifications.error(game.i18n.localize("QJPB.error.pagelNotFound") + uuid);
    console.error(game.i18n.localize("QJPB.error.pagelNotFound") + uuid);
    return;
  }

  // Get the parent of the page which is a journal 
  const journal = page.parent;
  // Make sure a journal was found and it is of "type" JournalEntry
  if (!journal || journal.documentName !== "JournalEntry") {
    ui.notifications.error(game.i18n.localize("QJPB.error.journalNotFound"));
    console.error(game.i18n.localize("QJPB.error.journalNotFound"));
    return;
  }

  const pageId = page.id;

  // Open the journal and render it
  await journal.sheet.render(true);

  // Jump to the page inside the journal (which is allready rendered)
  journal.sheet.goToPage(pageId);

}

