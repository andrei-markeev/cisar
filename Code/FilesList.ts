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

                CSREditor.ChromeIntegration.waitForResult(SPActions.getCode_checkJSLinkInfoRetrieved(), (jsLinkInfo, errorInfo) => {

                    this.loading = false;

                    if (errorInfo || jsLinkInfo == "error")
                    {
                        if (errorInfo) console.log(errorInfo);
                        alert("There was an error when getting list of files. Please check console for details.");
                        return;
                    }

                    for (var wpqId in jsLinkInfo) {

                        jsLinkInfo[wpqId].forEach(url => {

                            var addedFile = wpDict[wpqId].appendFileToList(url);

                            if (addedFile != null) {
                                for (var o = this.otherFiles.length - 1; o >= 0; o--) {
                                    if (this.otherFiles[o].url == addedFile.url)
                                        this.otherFiles.remove(this.otherFiles[o]);
                                }
                            }

                        });
                    }

                });
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
                () => {
                    if (this.filesPath[0] != '/')
                        this.filesPath = '/' + this.filesPath;

                    this.changePathDialogShown = false;

                    if (this.filesPath[this.filesPath.length - 1] != '/')
                        this.filesPath = this.filesPath + '/';
                },
                () => { this.changePathDialogShown = false; }
            );
        }


        public addOtherFiles(fileUrls: string[]) {
            for (var i = 0; i < fileUrls.length; i++) {
                var url = fileUrls[i];
                url = Utils.cutOffQueryString(url.replace(/^https?:\/\/[^\/]+/, '').toLowerCase().replace(/ /g, '%20'));
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

            content = content.replace(/\/\*.+?\*\/|\/\/.*(?=[\n\r])/g, '').replace(/\r?\n\s*|\r\s*/g, ' ').replace(/\\/g, "\\\\").replace(/'/g, "\\'");

            CSREditor.ChromeIntegration.eval(SPActions.getCode_performCSRRefresh(url, content));
        }

        public saveChangesToFile(url: string, content: string, saveNow?: boolean) {

            url = Utils.cutOffQueryString(url.replace(this.siteUrl, '').replace(' ', '%20').toLowerCase());
            if (url[0] != '/')
                url = '/' + url;
            
            this.savingQueue[url] = { content: content, cooldown: 3 };
            if (saveNow)
                this.savingQueue[url].cooldown = 1;

            if (!this.savingProcess) {
                this.savingProcess = setInterval(() => {
                    for (var fileUrl in this.savingQueue) {
                        this.savingQueue[fileUrl].cooldown--;
                        if (this.savingQueue[fileUrl].cooldown <= 0) {
                            CSREditor.ChromeIntegration.evalAndWaitForResult(
                                SPActions.getCode_saveFileToSharePoint(fileUrl, B64.encode(this.savingQueue[fileUrl].content)),
                                SPActions.getCode_checkFileSaved(),
                                (result, errorInfo) => {
                                    if (errorInfo || result == "error") {
                                        alert("Error occured when saving file " + fileUrl + ". Please check console for details.");
                                        if (errorInfo)
                                            console.log(errorInfo);
                                    }
                                }
                            );
                            delete this.savingQueue[fileUrl];
                        }
                    }
                }, 2000);
            }
        }


    }
}
