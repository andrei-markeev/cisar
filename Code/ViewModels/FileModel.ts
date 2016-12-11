module CSREditor {
    export class FileModel {
        constructor(wp: ListWebpart | SearchWebpart, root: FilesList, url: string) {
            this.root = root;
            this.wp = wp;

            url = Utils.cutOffQueryString(url.replace(/^https?:\/\/[^\/]+/, '').toLowerCase().replace(/ /g, '%20'));
            if (url.indexOf("_catalogs/masterpage/display%20templates") != -1 && url.endsWith(".js")) {
                url = url.slice(0, -3) + ".html";
                this.isDisplayTemplate = true;
            }
            this.url = url;
            this.shortUrl = url.substr(url.lastIndexOf('/') + 1);

            ko.track(this);
        }

        private root: FilesList;
        public wp: ListWebpart | SearchWebpart;

        public isDisplayTemplate: boolean = false;
        public displayTemplateUniqueId: string = '';
        public displayTemplateData: any;
        public displayTemplateUrl: string = '';
        public url: string = '';
        public shortUrl: string = '';
        public justCreated: boolean = false;
        public published: boolean = false;
        public current: boolean = false;
        public paused: boolean = false;
        public cloning: boolean = false;
        public cloningInProgress: boolean = false;
        public cloneName: string = '';

        public makeFileCurrent() {
            if (this.root.currentFile) {
                this.root.currentFile.cloning = false;
                this.root.currentFile.current = false;
            }
            this.current = true;
            this.root.currentFile = this;
            this.root.currentWebPart = this.wp;
            this.root.panel.loadUrlToEditor(this.url);
        }

        public publishFile() {
            ChromeIntegration.eval(SPActions.getCode_publishFileToSharePoint(this.url));
            this.published = true;
        }

        public removeFile() {
            if (confirm('Sure to move the file to recycle bin and unbind it from the webpart?')) {
                var url = Utils.toRelative(this.url, this.root.domainPart);
                this.root.panel.setEditorText(null, '');
                CSREditor.ChromeIntegration.eval(SPActions.getCode_removeFileFromSharePoint(url, this.wp != null ? this.wp.id : null));
                this.root.currentWebPart.files.remove(this);
            }
        }

        public cloneFile() {
            this.cloneName = "";
            this.cloning = true;
        }
        public confirmCloning() {
            this.cloning = false;
            this.cloningInProgress = true;
            var path = this.url.replace(/\/[^\/]+$/, '');
            var ext = this.url.match(/\.[^\/\.]+$/)[0];
            if (this.cloneName.indexOf(ext) == -1)
                this.cloneName += ext;
            NewFileHelper.createFile({
                path: path, 
                fileName: this.cloneName,
                content: this.root.panel.getEditorTextRaw() 
            }, (alreadyExists) => {
                if (!alreadyExists) {
                    ChromeIntegration.evalAndWaitForResult(
                        SPActions.getCode_loadDisplayTemplate(path + "/" + this.cloneName),
                        SPActions.getCode_checkDisplayTemplateLoaded(),
                        (result, errorInfo) => {
                            this.cloningInProgress = false;
                            if (!errorInfo && result != "error")
                                this.root.reload();
                        });
                }
            });
        }
        public cancelCloning() {
            this.cloning = false;
        }

        public pauseOrResume() {
            this.paused = !this.paused;
        }

    }
}