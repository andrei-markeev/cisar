var B64: any;

module CSREditor {
    export class FilesList {

        public changePathDialogShown: boolean = false;
        public loading: boolean;
        public currentWebPart: WebPartModel;
        public currentFile: FileModel;
        public webparts: WebPartModel[];
        public otherFiles: FileModel[] = [];

        public loadFileToEditor: { (url: string): void };
        public setEditorText: { (url: string, text: string, newlyCreated?: boolean): void };

        public filesPath: string;
        public siteUrl: string = "";

        constructor(loadUrlToEditor: { (url: string): void }, setEditorText: { (url: string, text: string, newlyCreated?: boolean): void }) {
            this.loadFileToEditor = loadUrlToEditor;
            this.setEditorText = setEditorText;
            this.webparts = [];
            this.loading = true;
            this.filesPath = localStorage['filesPath'] || "/Style Library/";

            CSREditor.ChromeIntegration.eval(SPActions.getCode_listCsrWebparts(),(result, errorInfo) => {
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
                ko.getObservable(this, 'filesPath').subscribe(function (newValue) {
                    localStorage['filesPath'] = newValue;
                });
                ko.applyBindings(this);

                var handle = setInterval(() => {

                    CSREditor.ChromeIntegration.eval(

                        SPActions.getCode_checkJSLinkInfoRetrieved(),

                        (result2, errorInfo) => {
                            if (errorInfo)
                                console.log(errorInfo);
                            else if (result2 != "wait") {
                                clearInterval(handle);
                                this.loading = false;
                                if (result2 == "error")
                                    alert("There was an error when getting list of files. Please check console for details.");
                                else {
                                    for (var wpqId in result2) {
                                        for (var f = 0; f < result2[wpqId].length; f++) {
                                            var addedFile = wpDict[wpqId].appendFileToList(result2[wpqId][f]);

                                            if (addedFile != null) {
                                                for (var o = this.otherFiles.length - 1; o >= 0; o--) {
                                                    if (this.otherFiles[o].url == addedFile.url)
                                                        this.otherFiles.remove(this.otherFiles[o]);
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                        });

                }, 400);
            });


            (<HTMLDivElement>document.querySelector('.separator')).onclick = (ev: MouseEvent) => {
                if (document.body.className.indexOf("fullscreen") > -1)
                    document.body.className = document.body.className.replace("fullscreen", "");
                else
                    document.body.className += " fullscreen";
            };
        }

        public pathInputKeyDown(data, event) {
            return Utils.safeEnterPath(
                event,
                this.filesPath,
                () => { this.changePathDialogShown = false; },
                () => { this.changePathDialogShown = false; }
            );
        }


        public addOtherFiles(fileUrls: string[]) {
            for (var i = 0; i < fileUrls.length; i++) {
                var url = fileUrls[i];
                url = Utils.cutOffQueryString(url.replace(this.siteUrl,'').toLowerCase().replace(/ /g, '%20'));
                var fileModel = new FileModel(null, this);
                fileModel.url = url;
                fileModel.shortUrl = url.substr(url.lastIndexOf('/') + 1);
                fileModel.justCreated = false;
                fileModel.current = false;
                this.otherFiles.push(fileModel);
            }
        }


        private savingQueue: { [url: string]: any } = {};
        private savingProcess: any = null;

        public refreshCSR(url: string, content: string) {

            this.currentFile.published = false;

            url = Utils.cutOffQueryString(url.replace(this.siteUrl, '').replace(' ', '%20').toLowerCase());
            if (url[0] != '/')
                url = '/' + url;

            content = content.replace(/\/\*.+?\*\/|\/\/.*(?=[\n\r])/g, '').replace(/\r?\n\s*|\r\s*/g, ' ').replace(/'/g, "\\'").replace(/\\/g, "\\\\");

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
