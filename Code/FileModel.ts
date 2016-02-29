module CSREditor {
    export class FileModel {
        constructor(wp: WebPartModel, root: FilesList) {
            this.root = root;
            this.wp = wp;
            ko.track(this);
        }

        private root: FilesList;
        private wp: WebPartModel;

        public url: string = '';
        public shortUrl: string = '';
        public justCreated: boolean = false;
        public published: boolean = false;
        public current: boolean = false;
        public paused: boolean = false;

        public makeFileCurrent() {
            if (this.root.currentFile)
                this.root.currentFile.current = false;
            this.current = true;
            this.root.currentFile = this;
            this.root.currentWebPart = this.wp;
            this.root.loadFileToEditor(this.url);
        }

        public publishFile() {
            ChromeIntegration.eval(SPActions.getCode_publishFileToSharePoint(this.url));
            this.published = true;
        }

        public removeFile() {
            if (confirm('Sure to move the file to recycle bin and unbind it from the webpart?')) {
                var url = Utils.toRelative(this.url, this.root.domainPart);
                this.root.setEditorText(null, '');
                CSREditor.ChromeIntegration.eval(SPActions.getCode_removeFileFromSharePoint(url, this.wp != null ? this.wp.id : null));
                this.root.currentWebPart.files.remove(this);
            }
        }

        public pauseOrResume() {
            this.paused = !this.paused;
        }

    }
}