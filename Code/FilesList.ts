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
                var wpDict: { [id: number]: WebPartModel } = {};
                for (var i = 0; i < result.length; i++) {
                    var wp = new WebPartModel(this, result[i]);
                    wpDict[wp.wpq] = wp;
                    this.webparts.push(wp);
                }
                ko.track(this);
                ko.applyBindings(this);

                var handle = setInterval(() => {

                    CSREditor.ChromeIntegration.eval(

                        SPActions.getCode_checkJSLinkInfoRetrieved(),

                        (result2, errorInfo) => {
                            if (errorInfo)
                                console.log(errorInfo);
                            else if (result2 != "wait") {
                                clearInterval(handle);
                                if (result2 == "error")
                                    alert("There was an error when creating the file. Please check console for details.");
                                else {
                                    for (var wpqId in result2) {
                                        for (var f = 0; f < result2[wpqId].length; f++)
                                            wpDict[wpqId].appendFileToList(result2[wpqId][f]);
                                    }
                                }
                            }

                        });

                }, 400);
            });
            this.webparts = [];


            (<HTMLDivElement>document.querySelector('.separator')).onclick = (ev: MouseEvent) => {
                if (document.body.className.indexOf("fullscreen") > -1)
                    document.body.className = document.body.className.replace("fullscreen", "");
                else
                    document.body.className += " fullscreen";
            };
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

        public refreshCSR(url: string, content: string) {

            this.currentFile.published = false;

            url = Utils.cutOffQueryString(url.replace(this.siteUrl, '').replace(' ', '%20').toLowerCase());
            if (url[0] != '/')
                url = '/' + url;

            content = content.replace(/\/\*.+?\*\/|\/\/.*(?=[\n\r])/g, '').replace(/\r?\n\s*|\r\s*/g, ' ').replace(/'/g, "\\'").replace(/\\/g, "\\\\");

            CSREditor.ChromeIntegration.eval(SPActions.getCode_performCSRRefresh(url, content, this.currentWebPart.wpq, this.currentWebPart.isListForm, this.currentWebPart.ctxKey));
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
