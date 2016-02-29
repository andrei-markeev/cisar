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

        private fileFlags: { [url: string]: number } = {};

        public appendFileToList(url: string, justcreated: boolean = false) {
            url = Utils.cutOffQueryString(url.replace(/^https?:\/\/[^\/]+/, '').toLowerCase().replace(/ /g, '%20'));
            if (!this.fileFlags[url]) {
                var file = new FileModel(this, this.root);
                file.url = url;
                file.shortUrl = url.substr(url.lastIndexOf('/') + 1);
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

        public fileNameInputKeyDown(data, event) {
            return Utils.safeEnterFileName(event, this.newFileName, () => { CSREditor.NewFileHelper.performNewFileCreation(this.root, this) }, () => { this.adding = false; });
        }

    }
}