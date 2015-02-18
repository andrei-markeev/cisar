module CSREditor {
    export class ChromeIntegration {

        public static setResourceAddedListener(siteUrl: string, callback: { (url:string): void }) {
            if (window["chrome"] && chrome.devtools) {
                chrome.devtools.inspectedWindow.onResourceAdded.addListener(function (resource) {
                    var resUrl = Utils.cutOffQueryString(resource.url.toLowerCase().replace(' ', '%20'));

                    if (Utils.endsWith(resUrl, ".js") && resUrl.indexOf(siteUrl) == 0 && resUrl.indexOf('/_layouts/') == -1)
                        callback(Utils.cutOffQueryString(resource.url));

                });
            }
        }

        public static setNavigatedListener(callback) {
            if (window["chrome"] && chrome.devtools) {
                chrome.devtools.network.onNavigated.addListener(callback);
            }
        }

        public static getAllResources(siteUrl: string, callback: { (urls: { [url: string]: number }): void }) {
            if (window["chrome"] && chrome.devtools) {

                chrome.devtools.inspectedWindow.getResources(function (resources) {
                    var urls: { [url: string]: number } = {};
                    for (var i = 0; i < resources.length; i++) {

                        var resUrl = Utils.cutOffQueryString(resources[i].url.toLowerCase().replace(' ', '%20'));

                        if (Utils.endsWith(resUrl, ".js") && resUrl.indexOf(siteUrl) == 0 && resUrl.indexOf('/_layouts/') == -1)
                            urls[Utils.cutOffQueryString(resources[i].url)] = 1;
                    }
                    callback(urls);
                });

            }
            else
                callback({});
        }

        public static getResourceContent(url: string, callback) {
            chrome.devtools.inspectedWindow.getResources(function (resources) {
                url = Utils.cutOffQueryString(url.toLowerCase().replace(' ', '%20'));
                for (var i = 0; i < resources.length; i++) {
                    var resUrl = Utils.cutOffQueryString(resources[i].url.toLowerCase().replace(' ', '%20'));
                    if (resUrl == url || (url[0] == "/" && Utils.endsWith(resUrl, url))) {
                        resources[i].getContent(function (content, encoding) {
                            callback(content || "");
                        });
                        return;
                    }
                }
                callback("");
            });
        }

        public static setResourceContent(url: string, content, callback?) {
            chrome.devtools.inspectedWindow.getResources(function (resources) {
                url = Utils.cutOffQueryString(url.toLowerCase().replace(' ', '%20'));
                for (var i = 0; i < resources.length; i++) {
                    var resUrl = Utils.cutOffQueryString(resources[i].url.toLowerCase().replace(' ', '%20'));
                    if (resUrl == url || (url[0] == "/" && Utils.endsWith(resUrl, url))) {
                        resources[i].setContent(content, false, callback);
                        return;
                    }
                }
            });
        }

        public static eval(code: string, callback?: (result: any, errorInfo: any) => void) {
            if (window["chrome"] && chrome.devtools) {
                chrome.devtools.inspectedWindow.eval(code, callback || function (result, errorInfo) {
                    if (errorInfo) console.log(errorInfo);
                });
            }
        }

        public static executeInContentScriptContext(code) {

            if (!window["chrome"] || !chrome.tabs)
                return false;

            chrome.tabs.executeScript({
                code: code
            });

            return true;

        }

    }
}