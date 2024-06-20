/* TABLE OF CONTENTS ///////
----------------------------
1 - Global Vars
2 - Extension Init
3 - Key Events
4 - Bookmarks API
5 - Palette Display
6 - Search Logic
7 - Selection
8 - Data Handling
9 - Commands
/// END TABLE OF CONTENTS */

/* 1 - Global Vars */
const selectors = {
    overlay: "#bcp-overlay",
    palette: "#bcp-palette",
    list: "#bcp-bookmarks",
    input: "#bcp-input--input",
    "x-icon": "#bcp-input--x-icon",
    type: "#bcp-input--type span",
    leftMessage: "#bcp-message--left",
    rightMessage: "#bcp-message--right"
}
const elements = Object.assign({}, selectors);
const templates = {group: '', bookmark: '', command: ''};
window.bcp = {
    open : false,
    selected: null,
    bookmarkGroups: [],
    commandGroups: [],
    init: false,
    isScrolling : false,
    config: {},
    mode: "bookmarks" // or commands
};

/* 2 - Extension Init */
( async ()=>{
    //Store config from storage
    bcp.config = await getStoredData();

    //Add Palette Modal to DOM
    const html = await chrome.runtime.sendMessage({cmd: "read_file", filepath: 'src/palette.html'});
    const css = await chrome.runtime.sendMessage({cmd: "read_file", filepath: 'src/styles/palette.css'});
    const bcp_element = document.createElement('div');
    bcp_element.setAttribute('id', 'bcp-extension');
    const theme = (bcp.config.theme == "auto") ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : bcp.config.theme;
    bcp_element.setAttribute('theme', theme);
    bcp_element.innerHTML = `<style name="bcp-extension-styles">${css}</style>` + html;
    document.body.appendChild(bcp_element);
    
    //Store DOM References
    Object.entries(elements).forEach((kv)=>{
        elements[kv[0]] = document.querySelector(kv[1]);
    })

    //Store Group HTML
    templates.group = await chrome.runtime.sendMessage({cmd: "read_file", filepath: 'src/templates/group.html'});
    templates.bookmark = await chrome.runtime.sendMessage({cmd: "read_file", filepath: 'src/templates/bookmark.html'});
    templates.command = await chrome.runtime.sendMessage({cmd: "read_file", filepath: 'src/templates/command.html'});

    /* Listeners */
    //Palette Visibility
    elements.overlay.addEventListener('click',(ev)=>{
        setTimeout(()=>{
            togglePalette(); //wait for animation, then toggle
        }, 100)
        
        ev.stopImmediatePropagation();
    });
    elements.palette.addEventListener('click',(ev)=>{
        ev.stopImmediatePropagation();
    });
    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {
          if (request.cmd === "open_palette") togglePalette();
        }
    );
    //Search
    elements.input.addEventListener('input', (ev)=>{
        const status = search(ev.target.value);
        if(status) initPalette();
        refreshPalette();
        resetSelection({mode : "firstAvailable"});
    });
    elements['x-icon'].addEventListener('click', (ev)=>{
        elements.input.value = "";
        const status = search();
        if(status) initPalette();
        refreshPalette();
        resetSelection({mode : "first"});
     });
})();

/* 3 - Key Events */
( async ()=>{
    //open palette when open key is pressed
    window.addEventListener('keydown', async (event)=>{
        //Visibility
        const [modifier, key] = bcp.config.openKeybind.split('+');
        if( (!modifier || (modifier && event[modifier])) && event.key === key ){
            togglePalette();
        } else if( event.key === 'Escape' ){
            togglePalette(false);
        } else if( event.key === 'Enter' ){
            if(bcp.mode === "bookmarks"){
                if (event.metaKey){
                    window.open(bcp.selected.url);
                } else {
                    window.location.assign(bcp.selected.url);
                }
            } else {
                bcp.selected.run(parseArgs(elements.input.value));
            }
        } if(bcp.open){
            //Selection
            if(event.key == "ArrowDown"){
                setScrollTimeout();
                setSelection(nextVisibleIndex({direction : "down"}));
            } else if (event.key == "ArrowUp"){
                setScrollTimeout();
                setSelection(nextVisibleIndex({direction : "up"}));
            }
        }
    });
})();

//Set timeout to disable mouse selection event after arrow movement
var scrollTimer;
function setScrollTimeout(){
    bcp.isScrolling = true;
    if(scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(()=>{ bcp.isScrolling = false }, 450); //TODO: Better solution needed if possible
}

/* 4 - Bookmarks API */
//Get bookmarks using Chrome API
async function getAllBookmarks(){
    const bookmarks = await chrome.runtime.sendMessage({cmd: "search_bookmarks", query: ""});
    bcp.bookmarkGroups = transformTree(bookmarks[0].children[0]).concat(transformTree(bookmarks[0].children[1]));
}

//Convert bookmarks to array of groups
function transformTree(tree, parentTitle=""){
    let groups = [];

    const directChildren = tree.children.filter( item => !item.children );
    const title = tree.title || 'untitled';
    const groupTitle = parentTitle ? parentTitle + ' > ' + title : title;
    if(directChildren.length){
        groups.push({
            title: groupTitle,
            bookmarks: directChildren.map(bookmark => ({
                icon: 'https://www.google.com/s2/favicons?sz=32&domain=' + (new URL(bookmark.url)).origin,
                title: bookmark.title,
                url: bookmark.url
            })),
        });
    }

    const subTrees = tree.children.filter( item => item.children );
    subTrees.forEach((subtree)=>{
        groups = groups.concat( transformTree(subtree, groupTitle) )
    })

    return groups;
}

/* 5 - Palette Display */
//Toggle Palette Visibility
async function togglePalette(state = null){
    const isHidden = elements.overlay.classList.contains('bcp-hidden');

    //Update Bookmarks
    if(isHidden && !bcp.init && state != false){
        await getAllBookmarks();
        initPalette();
    } else {
        resetSelection({mode : "first"}); //Select first bookmark
        search(); //Set all bookmarks to visible
        refreshPalette(); //Update visible bookmarks on DOM
    }

    //Update Palette
    elements.overlay.classList.toggle('bcp-hidden', state != null ? state : !isHidden);
    bcp.open = isHidden && state != false;
    if(bcp.open) elements.input.focus();
}

//Update the DOM
function refreshPalette(){
    //Update bookmarks/commands
    const groups = bcp.mode === "bookmarks" ? bcp.bookmarkGroups : bcp.commandGroups;
    const itemType = bcp.mode === "bookmarks" ? "bookmarks" : "commands";
    groups.forEach((group)=>{
        group.element.classList.toggle('bcp-hidden-display', !group.visible)
        group[itemType].forEach((command)=>{
            command.element.classList.toggle('bcp-hidden-display', !command.visible)
        });
    });

    //Updates Messages
    if(bcp.mode === "bookmarks"){
        elements.type.innerHTML = "Bookmarks";
        elements.leftMessage.innerHTML = 'Tip: Search for bookmarks or type <code>></code> to start a command.';
        // elements.rightMessage.innerHTML = '';
    } else {
        elements.type.innerHTML = "Commands";
        elements.leftMessage.innerHTML = bcp.selected.hint || bcp.selected.title;
    }
}

//Initialize Palette on DOM
function initPalette(){
    const groups = bcp.mode === "bookmarks" ? bcp.bookmarkGroups : bcp.commandGroups;
    const itemType = bcp.mode === "bookmarks" ? "bookmarks" : "commands";
    const templateType = bcp.mode === "bookmarks" ? "bookmark" : "command"; //TODO: Don't look at the repitition

    //Create Elements
    let index = 0;
    const groupHTML = groups.map((group, groupIndex)=>{
        const list = group[itemType].map((item)=>{
            item.index = index++;
            item.visible = item.visible != null ? item.visible : true;
            return renderTemplate(templates[templateType], {...item, index: item.index});
        }).join('');
        group.index = groupIndex;
        group.visible = group.visible != null ? group.visible : true;
        return renderTemplate(templates.group, {title: group.title, list, index: groupIndex});
    }).join('');
    elements.list.innerHTML = groupHTML;

    //Link DOM Elements to Objects and Handle Icons
    groups.forEach((group, gIdx)=>{
        group.element = document.querySelector(`.bcp-group[data-bcp-index="${group.index}"]`);
        group[itemType].forEach(async(item, itemIdx)=>{
            //Reference Bookmark Element
            item.element = document.querySelector(`.bcp-bookmark[data-bcp-index="${item.index}"]`);

            //Selection Logic
            item.element.addEventListener('mouseover', ()=>{
                if(bcp.init && bcp.open && !bcp.isScrolling){
                    setSelection(item, false);
                }
            });

            //Add Icon Image URL to <img> Element //TODO: Consider loading in bookmarks/icons as needed or caching.
            /* Explanation ----------------------------------------------------------------------------
                Adding the icon directly to the DOM may result in a missing image after a 301 redirect.
                Instead, the background script can retry for a working favicon until one is found, and
                then return that (as a base64 string since a blob can't be sent in a message). */
            if( bcp.mode === "bookmarks" ){
                const img = item.element.querySelector('.bcp-bookmark--img');
                if(item.index > 11) img.setAttribute("loading","lazy");// Apply lazy loading approx. below fold.
                img.src = await chrome.runtime.sendMessage({cmd: "get_favicon", url: item.icon});
            }

            //End of init DOM Manipulation
            if(groups.length-1 === gIdx && group[itemType].length-1 === itemIdx){
                resetSelection({mode : "first"});
                bcp.init = true;
            } 
        });
    });
}

//Combine props with template
function renderTemplate(template, props){
    //Poor man's templating
    let code = template;
    Object.entries(props).forEach((kv)=>{
        code = code.replaceAll('{{'+kv[0]+'}}', kv[1]);
    });
    return code;
}

/* 6 - Search Logic */
//Determine which bookmarks should be visible based on the search query
function search(query=""){
    var ret = 0; //set to 1 to rebuild item templates
    var searchQuery = query;
    if(query.startsWith('>')){
        //Command Mode
        if(bcp.mode !== "commands") ret = 1; //causes DOM items to rebuild 
        bcp.mode = "commands";
        searchQuery = query.slice(1).split(" ")[0];
    } else {
        //Search Mode
        if(bcp.mode !== "bookmarks") ret = 1;
        bcp.mode = "bookmarks";
    }

    const groups = bcp.mode === "bookmarks" ? bcp.bookmarkGroups : bcp.commandGroups;
    const itemType = bcp.mode === "bookmarks" ? "bookmarks" : "commands";
    groups.forEach((group)=>{
        let groupVisible = false;
        group[itemType].forEach((item)=>{
            if(
                item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (bcp.mode === "commands" && item.command.toLowerCase().includes(searchQuery.toLowerCase()))
            ){
                item.visible = true;
                groupVisible = true;
            } else {
                item.visible = false;
            }
        })
        group.visible = groupVisible;
    });

    return ret;
}

/* 7 - Selection */
//Set the selected bookmark and unselect others on DOM then scroll to selected bookmark
function setSelection(selectedItem, scroll = true){
    bcp.selected = selectedItem;
    const groups = bcp.mode === "bookmarks" ? bcp.bookmarkGroups : bcp.commandGroups;
    const itemType = bcp.mode === "bookmarks" ? "bookmarks" : "commands";
    groups.forEach((group)=>{
        group[itemType].forEach((item)=>{
            if(item.index == selectedItem.index){
                item.element.classList.add('bcp-selected');
                // Keep selection visible by scrolling
                const behavior = (checkVisible(item.element) && "smooth") || "instant"; //For holding down arrow keys
                if(scroll) item.element.scrollIntoView({behavior});
            } else {
                item.element.classList.remove('bcp-selected');
            }
        });
    });
}

//Determine how the next bookmark should be selected
function resetSelection(props){
    const groups = bcp.mode === "bookmarks" ? bcp.bookmarkGroups : bcp.commandGroups;
    const itemType = bcp.mode === "bookmarks" ? "bookmarks" : "commands";
    if(props.mode == "first"){
        setSelection(groups[0][itemType][0], false);
        elements.list.scrollTo(0, 0);
    } else if(props.mode == "firstAvailable"){
        setSelection(nextVisibleIndex({direction: "down", mode: "first"}));//Find first available while going from top to bottom
    } else if(props.mode == "next"){
        //TODO: Not needed
        setSelection(nextVisibleIndex({direction: "down"}));
    }
}

//Choose the next visible bookmark
function nextVisibleIndex(props){
    //direction = true -> low to high, direction = false -> high to low
    const groups = bcp.mode === "bookmarks" ? bcp.bookmarkGroups : bcp.commandGroups;
    const itemType = bcp.mode === "bookmarks" ? "bookmarks" : "commands";
    let next = null;
    if(props.direction == "down"){
        down:
        for(let i = 0; i < groups.length; i++){
            let group = groups[i];
            for(let j = 0; j < group[itemType].length; j++){
                let item = group[itemType][j];
                if((props.mode == "first" || item.index > bcp.selected.index) && item.visible){
                    next = item;
                    break down;
                }
            }
        }
    } else {
        up:
        for(let i = groups.length - 1; i >= 0; i--){
            let group = groups[i];
            for(let j = group[itemType].length - 1; j >= 0; j--){
                let item = group[itemType][j];
                if((props.mode == "first" || item.index < bcp.selected.index) && item.visible){
                    next = item;
                    break up;
                }
            }
        }
    }
    return next !== null ? next : bcp.selected;
}

//Determine if bookmark is visible to control scroll type
function checkVisible(elem) {
    const bounds = elem.getBoundingClientRect();
    const {top, bottom} = elements.palette.getBoundingClientRect();
    return bounds.top > top && bounds.top < bottom;
}

/* 8 - Data Handling */
const defaults = {
    theme : "auto", //auto, light, dark
    fontSize: "regular", //small, regular, large
    width: "regular", //small, regular, large
    sort : "stored", //(recently used, recently updated, alphabetic, stored (current, default))
    linkAction : "replace", //replace, new
    includeTitlesInSearch : false,
    enableStats : false,
    openKeybind : "metaKey+b",
}
async function getStoredData(){
    const result = await chrome.storage.local.get(["data"]);
    if(result.data){
        return JSON.parse(result.data);
    } else {
        await chrome.storage.local.set({ data : JSON.stringify(defaults)});
        return defaults;
    }
}

async function setStoredData(updates){
    const storeData = Object.assign(await getStoredData(), updates);
    await chrome.storage.local.set({ data : JSON.stringify(storeData)});
}

async function restoreDefault(){
    await setStoredData(defaults);
}

/* 9 - Commands */
function parseArgs(str){
    const argsObj = {};
    str?.slice(1)?.match(/\w+:".*?"/g)?.forEach((arg)=>{
        const [k,v] = arg.split(':');
        argsObj[k] = v;
    });
    return argsObj
}
bcp.commandGroups = [
    {
        title: 'Bookmarks',
        commands: [
            {
                title: "Add Bookmark",
                command: 'add',
                args: ['title', 'url'],
                run: async function(args){
                    console.log(this.title, args)
                    // await chrome.runtime.sendMessage({cmd: "add_bookmark", args: parsedArgs})
                },
            },
            {
                title: "Remove Bookmark",
                command: 'remove',
                args: ['title', 'url'],
                run: async function(args){
                    console.log(this.title, args)
                    // await chrome.runtime.sendMessage({cmd: "remove_bookmark", args})
                },
            },
            {
                title: "Edit Bookmark",
                command: 'edit',
                args: ['title', 'newTitle', 'url','newURL'],
                run: async function(args){
                    console.log(this.title, args)
                    // await chrome.runtime.sendMessage({cmd: "edit_bookmark", args})
                },
            },
        ]
    },
    {
        title: 'Palette',
        commands: [
            {
                title: "Set Theme",
                command: 'theme',
                args: ['mode'],
                run: async function(args){
                    console.log(this.title, args)
                }
            },
            {
                title: "Set Font Size",
                command: 'set font',
                args: ['font'],
                run: async function(args){
                    console.log(this.title, args)
                },
            },
            {
                title: "Sort By",
                command: 'sort-by',
                args: ['sort'],
                run: async function(args){
                    console.log(this.title, args)
                }
            },
        ]
    },
    {
        title: 'Other Commands',
        commands: [
            {
                title: "Help",
                command: 'help',
                args: [],
                run: async function(args){
                    console.log(this.title, args)
                    window.open("https://github.com/reidCameron")
                }
            }
        ]
    }
];