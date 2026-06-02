/**
 * Quick-Journal-Page-Back – Foundry VTT V13 & V14
 */

// Hooks.events in console to investigate Hooks
//CONFIG.debug.hooks = true

let pageHistory = null;

class JournalHistoryManager {
    constructor(maxLength) {
        this.MAX_LENGTH = maxLength-1; // Max. Seiten pro Nutzer (aus den Einstellungen)
        this.userHistories = new Map(); // Key: User ID, Value: Array<PageID>
        this.connectedUser= new Set(); //active user tracking - results in unique key in map
        this.forwardHistory= [];
        this.backwardHistory= [];
        this._buttonAction = 0; //0 not pressed, 1 = forward, 2 = backward, 3 = any button
        this.suppressedPageUuid = null; // added tracker of supressedUUID
        this.historyIndex = -1;
        // Wenn ein Benutzer verbunden wird, leeren wir seine Historie neu (oder laden sie aus Storage)
    }

set buttonAction(button){
      this._buttonAction = button;
}

get buttonAction(){
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

async goForward(){

const activeUser = game.user.id;
let JournalList = this.getHistoryList(activeUser)

const backHistoryLength =JournalList.length;

console.log("QJPB:5 I WENT FOWARD - index is: ",this.historyIndex)
if(this.historyIndex>backHistoryLength-1){this.historyIndex=backHistoryLength-1;}
console.log("QJPB:5 I WENT FOWARD - index is after check is: ",this.historyIndex)
this.historyIndex = this.historyIndex-1;
if(this.historyIndex<0){this.historyIndex=0};


if(backHistoryLength>this.historyIndex && this.historyIndex<backHistoryLength){

  console.log("QJPB:5 Forward History Index: ",this.historyIndex)
const uuid = JournalList[this.historyIndex];
console.log("QJPB:5 Forward Page UUID: ",uuid)
this.buttonAction = 3; // open by code
this.suppressNextPage(uuid); //add
//pageHistory.buttonAction = 3;
console.log("QJPB:5 Forward Button State before code open: ",this.buttonAction)
//console.log("QJPB:== Page History before code open ",pageHistory)
await openJournalAndShowPage(uuid);
//this.buttonAction = 0; //restore old setting
console.log("QJPB:5 Forward Button State: ",this.buttonAction)

}}

async goBackward(){
console.log("QJPB:5 I WENT BACK",this.historyIndex)
const activeUser = game.user.id;
console.log("QJPB:5 Back game user id");
let JournalList = this.getHistoryList(activeUser)
console.log("QJPB:5 Back history list",this.historyIndex);
if(this.historyIndex===-1){this.historyIndex=0}
console.log("QJPB:5 Back history after historyIndex===-1",this.historyIndex);
const backHistoryLength = JournalList.length;
this.historyIndex = this.historyIndex+1;
if(this.historyIndex>backHistoryLength-1){this.historyIndex=backHistoryLength-1;}

if(backHistoryLength>this.historyIndex && this.historyIndex<backHistoryLength){
if(this.historyIndex>this.MAX_LENGTH){this.historyIndex=this.MAX_LENGTH};
console.log("QJPB:5 ende");
  
    
// Usage:
console.log("QJPB:5 History Index: ",this.historyIndex)
const uuid = JournalList[this.historyIndex];
console.log("QJPB:5 Page UUID: ",uuid)
this.buttonAction = 3; // open by code
this.suppressNextPage(uuid); //added
//pageHistory.buttonAction = 3;
console.log("QJPB:5 Button State before code open: ",this.buttonAction)
//console.log("QJPB:== Page History before code open ",pageHistory)
await openJournalAndShowPage(uuid);
//this.buttonAction = 0; //restore old setting
console.log("QJPB:5 Button State after show page: ",this.buttonAction);
console.log("QJPB:5 List of Pages after showPage: ", this.userHistories);

//const journal = await fromUuid(JournalList[0]);
//journal.sheet.render(true);
  }}
    //=== "Other functions of the objekt" ===
    // creates the history list or removes it from the array (on connect or disconnect) - making sure shaky connects do not play havoc
  manageHistoryListExistence(userId){
      if (this.connectedUser.has(userId)){
           if (!this.userHistories.has(userId)) {
            this.userHistories.set(userId, []); // Initialisiere die Historie für diesen Nutzer
        }
      } else {
         if (this.userHistories.has(userId)) {
            this.userHistories.delete(userId); // Verwirft die Historie für diesen Nutzer
        }
      }
  }

  getHistoryList(userId){
    if (this.connectedUser.has(userId)){
      return this.userHistories.get(userId);
    } else {
      return [];
    }

  }

  // Speichert die ID der aktuell angesehenen Seite und pflegt die Historie auf MAX_LENGTH.
  // @param {string} pageId - Die UUID der Journal Page.
  addHistoryPage(pageId){

        const activeUser = game.user.id;
        let currentHistoryList = this.getHistoryList(activeUser)
        
        // adds a new page at the sart of the array
        currentHistoryList.unshift(pageId); 
        //this.historyIndex = -1; // No manual selection of page took place so reset historyIndex
        // Kürze das Array, falls es zu lang wird
        if (currentHistoryList.length > this.MAX_LENGTH) {
            currentHistoryList = currentHistoryList.slice(0, this.MAX_LENGTH);
        }
        
        if (currentHistoryList.length >=1){
          if (this.connectedUser.has(activeUser)){
            //if (this.userHistories.has(userId)) { // not necessary I think after all currentHistory List must be 1 or more
            this.userHistories.set(activeUser, currentHistoryList);
            //}
          }
        }
        }
  }

  ;

Hooks.once("init", () => {
console.log("QJPB: INIT highest zIndex",foundry.applications.api.ApplicationV2._maxZ)

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
            const entryId = this.document.id;
    
        })
    };
  
  Hooks.on("userConnected", (user, connected) => {
    // user data with id and/or uuid
    //connected = true/false
    console.log("QJPB: User on userConnected1: ",user);
    
            if (connected) {
            pageHistory.connectedUser.add(user.id);
            pageHistory.manageHistoryListExistence(user.id);
          }
            if(!connected) {
            pageHistory.connectedUser.delete(user.id);
            pageHistory.manageHistoryListExistence(user.id);
          };
  });

  // Register settings
  game.settings.register("quick-journal-page-back", "historyLength", {
    name: game.i18n.localize("QJPB.HistoryLength") || "Verlaufslänge",
    hint: game.i18n.localize("QJPB.HistoryLengthHint") || "Maximale gespeicherte Seiten pro Benutzer.",
    scope: "client",
    config: true,
    type: Number,
    default: 20,
    range: { min: 1, max: 50, step:1 }
  });
  
console.log("QJPB: Quick-Journal-Page-Back initialized");
});

Hooks.once("ready",() => {
console.log("QJPB: Ready Hook Entered ==> List of users at start:", game.users.contents);

            let activeUsers = game.users.contents;
            if (activeUsers.length>=1) { //this should not be a problem if there allways should be on active user

              activeUsers.forEach((user, index) => {
                if (user.active){
                  console.log("QJPB: Show active users: ", user.name)
                  pageHistory.connectedUser.add(user.id)
                  pageHistory.manageHistoryListExistence(user.id);
                }
              });
                //console.log("QJPB: connected user: ",pageHistory.connectedUser);
                //console.log("QJPB: pageHistories: ",pageHistory.userHistories);
            }
        
    pageHistory.MAX_LENGTH = (game.settings.get("quick-journal-page-back", "historyLength") ?? 30)-1;

})

Hooks.on("renderJournalEntryPageSheet", (data) => {
//console.log("QJPB: renderJournalEntryPageSheet ",data);

//foundry.applications.api.ApplicationV2._maxZ
console.log("QJPB: Actuall highest zIndex",foundry.applications.api.ApplicationV2._maxZ)
if (data.position.zIndex>100){ //this is a "fix" for GM Screenwhich has azIndex of 100. 
                              //It assumes any journal opened manually later on the GUI will have a higher zIndex and stack on the GUI
const activeUser = game.user.id;
const pageId = data?.document?.uuid;
  if (!pageHistory) {
    console.log("QJPB: PageHistory not initialized yet; skip or queue the view");
    return;
  }

console.log("QJPB: Page Entry rendering; ",pageId)
console.log("QJPB: Direkt info: ",pageHistory.userHistories)
console.log("QJPB: List of Pages: ",pageHistory.getHistoryList(activeUser))
//console.log("QJPB: Button Action Status Entry State: ",pageHistory.buttonAction);
// add return before page is added and reset page
if (pageHistory.shouldSkipHistoryPage(pageId)) {
  //console.log("QJPB: page navigation skipped: ", pageId);
  return;
}

if (pageHistory.buttonAction === 0){
  if (pageHistory.historyIndex >-1){
   //replace the old history list with the history from the current index onward as the user branched
    const historyFromIndex= pageHistory.getHistoryList(activeUser).slice(pageHistory.historyIndex)
    pageHistory.userHistories.set(activeUser, historyFromIndex)
  }
  pageHistory.addHistoryPage(pageId)
  pageHistory.historyIndex = -1;
}
}
});

// Render or Journal open/rendering function
function qjpbButtonCreation(sheet, html) {
    //console.log("== A journal was rendered (opened)");


    //get the container div holding the prev, add page and next button
    const container = html.querySelector("aside.journal-sidebar .action-buttons.flexrow");
    const containerTag = container.tagName
    //console.log("Container Tag is:",containerTag)

    // create the Back button
    const buttonBack = document.createElement('button');
    buttonBack.className = 'qjp-back';  // add own class for possible later styling
    buttonBack.title = game.i18n.localize("QJPB.Back");         // Native title for tooltip
    buttonBack.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i>';  // Font awesom icon/classes
    //add listener to the back button
    buttonBack.addEventListener('click', async () => {
      //console.log("QJPB: Back");
      if (pageHistory) {
        pageHistory.buttonAction = 2;
        await pageHistory.goBackward()
      } else {console.log("QJPB: pageHistory not yet initialized");}
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
      } else {console.log("QJPB: pageHistory not yet initialized");}
      ;});

    //check if container for buttons allready exists if Quick-Journal-Page-Sort ist allready installed/initialized
    const qjpContainer = html.querySelector(".qjp-buttons");

    if (!qjpContainer) {
    // create group div for new Buttons
    const newDiv = document.createElement('div');
    newDiv.classList.add('flexrow', 'qjp-buttons','qjpb');  // buttonS class added to div
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
    ui.notifications.error("Page not found for UUID: " + uuid);
    return;
  }

  // Get the parent of the page which is a journal 
  const journal = page.parent;
  // Make sure a journal was found and it is of "type" JournalEntry
  if (!journal || journal.documentName !== "JournalEntry") {
    ui.notifications.error("Parent journal not found or of wrong type.");
    return;
  }

  const pageId = page.id;

  // Open the journal and render it
  await journal.sheet.render(true);

  // Jump to the page inside the journal (which is allready rendered)
  journal.sheet.goToPage(pageId);

}

