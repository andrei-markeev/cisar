var B64: any;

module CSREditor {
    export class FilesList {

        constructor(loadUrlToEditor: { (url: string): void }, setEditorText: { (url: string, text: string, newlyCreated?: boolean): void }) {
            this.loadFileToEditor = loadUrlToEditor;
            this.setEditorText = setEditorText;
            CSREditor.ChromeIntegration.eval(SPActions.getCode_listCsrWebparts(), (result, errorInfo) => {
                if (errorInfo) {
                    console.log(errorInfo);
                    return;
                }
                for (var i = 0; i < result.length; i++) {
                    var wp = new WebPartModel(this, result[i].title, result[i].wpId, result[i].wpqId, result.isListForm);
                    this.webparts.push(wp);
                }
                if (this.webparts.length > 0)
                    this.currentWebPart = this.webparts[0];
                ko.track(this);
                ko.applyBindings(this);
            });
            this.webparts = [];
        }

        public currentWebPart: WebPartModel;
        public currentFile: FileModel;
        public webparts: WebPartModel[];

        public loadFileToEditor: { (url: string): void };
        public setEditorText: { (url: string, text: string, newlyCreated?: boolean): void };

        public get filesPath(): string {
            return localStorage['filesPath'] || "/Style Library/";
        }
        public set filesPath(value: string) {
            localStorage['filesPath'] = value;
        }
        public siteUrl: string = "";


        private savingQueue: { [url: string]: any } = {};
        private savingProcess: any = null;

        public addFiles(urls: { [url: string]: number }) {

            for (var url in urls) {
                this.currentWebPart.appendFileToList(url);
            }

            (<HTMLDivElement>document.querySelector('.separator')).onclick = (ev: MouseEvent) => {
                if (document.body.className.indexOf("fullscreen") > -1)
                    document.body.className = document.body.className.replace("fullscreen", "");
                else
                    document.body.className += " fullscreen";
            };
        }

        public refreshCSR(url: string, content: string) {

            for (var i = 0; i < this.currentWebPart.files.length; i++) {
                if (this.currentWebPart.files[i].url == url)
                    this.currentWebPart.files[i].published = false;
            }

            url = Utils.cutOffQueryString(url.replace(this.siteUrl, '').replace(' ', '%20').toLowerCase());
            if (url[0] != '/')
                url = '/' + url;

            content = content.replace(/\/\*.+?\*\/|\/\/.*(?=[\n\r])/g, '').replace(/\r?\n\s*|\r\s*/g, ' ').replace(/'/g, "\\'");

            CSREditor.ChromeIntegration.eval(SPActions.getCode_performCSRRefresh(url, content));
        }

        public saveChangesToFile(url: string, content: string) {

            url = Utils.cutOffQueryString(url.replace(this.siteUrl, '').replace(' ', '%20').toLowerCase());
            if (url[0] != '/')
                url = '/' + url;
            
            this.savingQueue[url] = { content: content, cooldown: 5 };

            if (!this.savingProcess) {
                this.savingProcess = setInterval(() => {
                    for (var fileUrl in this.savingQueue) {
                        this.savingQueue[fileUrl].cooldown--;
                        if (this.savingQueue[fileUrl].cooldown <= 0) {
                            CSREditor.ChromeIntegration.eval(SPActions.getCode_saveFileToSharePoint(fileUrl, B64.encode(this.savingQueue[fileUrl].content)));
                            delete this.savingQueue[fileUrl];
                        }
                    }
                }, 2000);
            }
        }


    }
}
