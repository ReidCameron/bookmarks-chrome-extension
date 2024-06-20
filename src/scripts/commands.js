// const commandGroups = [
//     {
//         group: 'Bookmarks',
//         commands: [
//             {
//                 title: "Create Bookmark",
//                 command: 'create',
//                 args: ['title', 'url'],
//                 run: async function(parsedArgs){
//                     await chrome.runtime.sendMessage({cmd: "create_bookmark", args: parsedArgs})
//                 },
//             },
//             {
//                 title: "Remove Bookmark",
//                 command: 'remove',
//                 args: ['title', 'url'],
//                 run: async function(parsedArgs){
//                     await chrome.runtime.sendMessage({cmd: "remove_bookmark", args: parsedArgs})
//                 },
//             },
//             {
//                 title: "Edit Bookmark",
//                 command: 'edit',
//                 args: ['title', 'newTitle', 'url','newURL'],
//                 run: async function(parsedArgs){
//                     await chrome.runtime.sendMessage({cmd: "edit_bookmark", args: parsedArgs})
//                 },
//             },
//         ]
//     },
//     {
//         group: 'Palette',
//         commands: [
//             {
//                 title: "Change Font Size",
//                 command: 'set font',
//                 args: ['font'],
//                 run: async function(parsedArgs){
//                     //if (!parsedArgs.size) return;//this.error()
//                     //chrome.storage.local.set(parsedArgs.size)
//                 },
//             },
//             {
//                 title: "Change Theme",
//                 command: 'theme',
//                 args: ['mode'],
//                 run: async function(parsedArgs){}
//             },
//             {
//                 title: "Sort By",
//                 command: 'sort-by',
//                 args: ['sort'],
//                 run: async function(parsedArgs){}
//             },
//         ]
//     }
// ];

// function runCommand(command){

// }

/* Command Ideas
    * Open Bookmark in new tab as a toggle setting
    * --Also maybe hold control to open in new tab
    * enable stats on which are used the most'
    * flag to include titles in search
    * Bookmark CRUD
    * Appearance stuff (theme, font-size, font-color, width, etc.)
    * Sorting options (most recently used, most recently updated, alphabetic groups, as stored (current, default))
    * config commands can all have the same format -> ">config {property_name}:{value}"
    *   reset config using -> ">config reset"
*/