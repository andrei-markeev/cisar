module CSREditor {
    export class FileModel {
        constructor(root: FilesList) {
            this.root = root;
            ko.track(this);
        }

        private root: FilesList;

        public url: string = '';
        public shortUrl: string = '';
        public justCreated: boolean = false;
        public published: boolean = false;
        public current: boolean = false;

        public makeFileCurrent() {
            if (this.root.currentFile)
                this.root.currentFile.current = false;
            this.current = true;
            this.root.currentFile = this;
            this.root.loadFileToEditor(this.url);
        }

        public publishFile() {
            ChromeIntegration.eval(SPActions.getCode_publishFileToSharePoint(this.url));
            this.published = true;
        }

        public removeFile() {
            if (confirm('Sure to move the file to recycle bin and unbind it from the webpart?')) {
                var url = this.url;
                url = Utils.cutOffQueryString(url.replace(this.root.siteUrl, '').replace(' ', '%20').toLowerCase());
                if (url[0] != '/')
                    url = '/' + url;
                this.root.setEditorText(null, '');
                CSREditor.ChromeIntegration.eval(SPActions.getCode_removeFileFromSharePoint(url));
                this.root.currentWebPart.files.remove(this);
            }
        }

    }
}