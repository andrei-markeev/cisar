module CSREditor {
    export class WebPartModel {

        constructor(root: FilesList, info: IWebPartInfoFromSP) {
            this.root = root;
            this.title = info.title;
            this.id = info.wpId;
            this.wpq = info.wpqId;
            this.isListForm = info.isListForm;
            this.ctxKey = info.ctxKey;
            this.listTemplateType = info.listTemplateType;
            this.fields = info.fields;

            ko.track(this);
        }

        private root: FilesList;

        public title: string;
        public id: string;
        public wpq: number;
        public isListForm: boolean;
        public ctxKey: string;
        public listTemplateType: number;
        public fields: string[];
        public files: FileModel[] = [];
        public adding: boolean = false;
        public loading: boolean = false;
        public newFileName: string = '';
        public jsLink: string = '';
        public editJSLinkMode: boolean = false;

        private fileFlags: { [url: string]: number } = {};

        public appendFileToList(url: string, justcreated: boolean = false) {
            if (!this.fileFlags[url]) {
                var file = new FileModel(this, this.root, url);
                file.justCreated = justcreated;
                this.files.push(file);
                if (justcreated) {
                    if (this.root.currentFile)
                        this.root.currentFile.current = false;
                    this.root.currentFile = file;
                    this.root.currentWebPart = this;
                    file.current = true;
                }
                this.fileFlags[url] = 1;
                return file;
            }
            else
                return null;
        }

        public displayAddNewFileUI(data) {
            this.newFileName = '';
            this.adding = true;
        }

        public displayChangePathDialog(data) {
            this.root.filesPathEntered = this.root.filesPath;
            this.root.pathRelativeToEntered = this.root.pathRelativeTo;
            this.root.changePathDialogShown = true;
        }

        public displayEditJSLinkUI(data) {
            for (var f of this.files)
                if (f.current) {
                    f.current = false;
                    this.root.currentFile = null;
                    this.root.currentWebPart = null;
                    this.root.setEditorText(null, '');
                    break;
                }
            this.loading = true;
            ChromeIntegration.evalAndWaitForResult(SPActions.getCode_getJSLink(this.id), SPActions.getCode_checkJSLinkRetrieved(), (result, errorInfo) => {
                this.loading = false;

                if (errorInfo)
                    console.log(errorInfo);

                if (errorInfo || result == 'error') {
                    alert('Error occured when fetching the JSLink data.');
                    return;
                }

                this.jsLink = result;
                this.editJSLinkMode = true;
            });
        }

        public saveJSLink() {
            this.editJSLinkMode = false;
            this.loading = true;
            ChromeIntegration.evalAndWaitForResult(SPActions.getCode_setJSLink(this.id, this.jsLink), SPActions.getCode_checkJSLinkSaved(), (result, errorInfo) => {
                this.loading = false;

                if (errorInfo)
                    console.log(errorInfo);

                if (errorInfo || result == 'error') {
                    alert('Error occured when saving the JSLink data! Check console for details.');
                    return;
                }

                this.root.reload();
            });
        }

        public cancelJSLinkEdit() {
            this.editJSLinkMode = false;
        }

        public fileNameInputKeyDown(data, event) {
            return Utils.safeEnterFileName(event, this.newFileName, () => { CSREditor.NewFileHelper.performNewFileCreation(this.root, this) }, () => { this.adding = false; });
        }

    }
}