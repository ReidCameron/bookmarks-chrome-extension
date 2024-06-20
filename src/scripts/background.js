chrome.action.onClicked.addListener((tab) => {
    ( async ()=>{
        await chrome.tabs.sendMessage(tab.id, {cmd: "open_palette"});
    })();
    
    return true;
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.cmd === "read_file") {
        (async () => {
            const response = await fetch(chrome.runtime.getURL( request.filepath ));
            const response_text = await response.text();
            sendResponse(response_text);
        })();
    } else if (request.cmd === "search_bookmarks"){
        (async ()=>{
            var bookmarks;
            if(request.query){
                bookmarks = await chrome.bookmarks.search( request.query );
            } else {
                bookmarks = await chrome.bookmarks.getTree();
            }
            sendResponse(bookmarks);
        })();
    } else if (request.cmd === "get_favicon"){
        (async () => {
            var response = await fetch(request.url);
            if (response.status == 404){
                //Remove subdomains until image is found (up to 2 subdomains)
                let parts = request.url.split('https://www.google.com/s2/favicons?sz=32&domain=')[1].split('.');
                const numChecks = 2;
                for(let splitPos = 1; splitPos < numChecks + 1; splitPos++){
                    if(parts.length <= numChecks) break;

                    const newUrl = 'https://www.google.com/s2/favicons?sz=32&domain=' + parts.slice(splitPos).join('.');
                    if(newUrl == request.url) break;

                    response = await fetch(newUrl);
                    if(response.status != 404) break;
                }
                
            }
            var blob = await response.blob();
            var blob64 = await blobToBase64(blob);
            sendResponse(blob64);
        })();
    }

    return true;
});

function blobToBase64(blob) {
    return new Promise((resolve, _) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}