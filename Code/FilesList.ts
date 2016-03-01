var B64: any;

module CSREditor {
    export class FilesList {

        public changePathDialogShown: boolean = false;

        public loading: boolean;
        public currentWebPart: WebPartModel;
        public currentFile: FileModel;
        public webparts: WebPartModel[];
        public otherFiles: FileModel[];

        public fileError: string = null;

        public loadFileToEditor: { (url: string): void };
        public setEditorText: { (url: string, text: string, newlyCreated?: boolean): void };

        public pathRelativeToOptions: string[] = ['~sitecollection', '~site'];
        public pathRelativeTo: string;
        public pathRelativeToEntered: string = "";
        public filesPath: string;
        public filesPathEntered: string = "";
        public siteUrl: string = "";
        public webUrl: string = "";
        public siteServerRelativeUrl: string = "";
        public webServerRelativeUrl: string = "";
        public domainPart: string = "";

        public personalView: boolean = false;

        constructor(loadUrlToEditor: { (url: string): void }, setEditorText: { (url: string, text: string, newlyCreated?: boolean): void }) {
            this.loadFileToEditor = loadUrlToEditor;
            this.setEditorText = setEditorText;
            this.filesPath = localStorage['filesPath'] || "/Style Library/";
            this.pathRelativeTo = localStorage['pathRelativeTo'] || "~sitecollection";

            this.reload();

            ko.track(this);
            ko.getObservable(this, 'filesPath').subscribe(function (newValue) {
                localStorage['filesPath'] = newValue;
            });
            ko.getObservable(this, 'pathRelativeTo').subscribe(function (newValue) {
                localStorage['pathRelativeTo'] = newValue;
            });
            ko.applyBindings(this);

            (<HTMLDivElement>document.querySelector('.separator')).onclick = (ev: MouseEvent) => {
                if (document.body.className.indexOf("fullscreen") > -1)
                    document.body.className = document.body.className.replace("fullscreen", "");
                else
                    document.body.className += " fullscreen";
            };
        }

        public reload() {

            this.loading = true;
            this.webparts = [];
            this.otherFiles = [];
            this.currentWebPart = null;
            this.currentFile = null;
            this.personalView = false;
            this.fileError = null;

            ChromeIntegration.eval("_spPageContextInfo", (result, errorInfo) => {
                if (!errorInfo) {
                    this.siteUrl = result.siteAbsoluteUrl.toLowerCase();
                    this.webUrl = result.webAbsoluteUrl.toLowerCase();
                    this.siteServerRelativeUrl = result.siteServerRelativeUrl.toLowerCase();
                    this.webServerRelativeUrl = result.webServerRelativeUrl.toLowerCase();
                    this.domainPart = result.siteServerRelativeUrl == '/' ? this.siteUrl : this.siteUrl.replace(result.siteServerRelativeUrl, '');

                    this.pathRelativeToOptions.removeAll();
                    this.pathRelativeToOptions.push('~sitecollection');
                    if (result.webServerRelativeUrl != result.siteServerRelativeUrl)
                        this.pathRelativeToOptions.push('~site');

                    ChromeIntegration.getAllResources(this.siteUrl, (urls: { [url: string]: number; }) => {
                        this.addOtherFiles(Object.keys(urls));
                        this.loadWebParts();
                    });
                }
            });

        }

        private loadWebParts() {

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

                CSREditor.ChromeIntegration.waitForResult(SPActions.getCode_checkJSLinkInfoRetrieved(), (jsLinkInfo, errorInfo) => {

                    this.loading = false;

                    if (errorInfo || jsLinkInfo == "error") {
                        if (errorInfo) console.log(errorInfo);
                        alert("There was an error when getting list of files. Please check console for details.");
                        return;
                    }

                    if (jsLinkInfo == "personal") {
                        this.personalView = true;
                        return;
                    }

                    for (var wpqId in jsLinkInfo) {

                        jsLinkInfo[wpqId].forEach(url => {

                            var addedFile = wpDict[wpqId].appendFileToList(url);

                            if (addedFile != null) {
                                for (var o = this.otherFiles.length - 1; o >= 0; o--) {
                                    if (this.otherFiles[o].baseUrl == addedFile.url)
                                        this.otherFiles.remove(this.otherFiles[o]);
                                }
                            }

                        });
                    }

                });

            });
        }

        public pathInputKeyDown(data, event) {
            return Utils.safeEnterPath(event, this.filesPathEntered, this.fixupFilesPath.bind(this), () => { this.changePathDialogShown = false; });
        }

        private fixupFilesPath() {
            if (this.filesPathEntered[0] != '/')
                this.filesPathEntered = '/' + this.filesPathEntered;

            if (this.filesPathEntered[this.filesPathEntered.length - 1] != '/')
                this.filesPathEntered = this.filesPathEntered + '/';

            this.changePathDialogShown = false;
            this.filesPath = this.filesPathEntered;
            this.pathRelativeTo = this.pathRelativeToEntered;
        }

        public addOtherFiles(fileUrls: string[]) {
            for (var i = 0; i < fileUrls.length; i++) {
                var fileModel = new FileModel(null, this, fileUrls[i]);
                this.otherFiles.push(fileModel);
            }
        }

        private savingQueue: { [url: string]: any } = {};
        private savingProcess: any = null;

        public refreshCSR(url: string, content: string) {

            this.currentFile.published = false;

            if (this.currentFile.paused)
                return;

            url = Utils.cutOffQueryString(url.replace(this.siteUrl, '').replace(' ', '%20').toLowerCase());
            if (url[0] != '/')
                url = '/' + url;

            content = content.replace(/\r?\n\s*|\r\s*/g, ' ').replace(/\\/g, "\\\\").replace(/'/g, "\\'");

            CSREditor.ChromeIntegration.eval(SPActions.getCode_performCSRRefresh(url, content));
        }

        public saveChangesToFile(url: string, content: string, saveNow?: boolean) {

            url = Utils.toRelative(url, this.domainPart);
            
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
