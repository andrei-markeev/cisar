module CSREditor
{
    export class SearchWebpart {

        constructor(root: FilesList, info: ISearchWebpartFromSP) {
            this.root = root;
            this.title = info.title;
            this.wpId = info.wpId;
            this.controlTemplate = this.controlTemplateSaved = info.controlTemplate;
            this.groupTemplate = this.groupTemplateSaved = info.groupTemplate;
            this.itemTemplate = this.itemTemplateSaved = info.itemTemplate;
            this.itemBodyTemplate = this.itemBodyTemplateSaved = info.itemBodyTemplate;

            ko.track(this);

            ko.getObservable(this, 'controlTemplate').subscribe(newValue => setTimeout(this.checkDirty.bind(this),0));
            ko.getObservable(this, 'groupTemplate').subscribe(newValue => setTimeout(this.checkDirty.bind(this),0));
            ko.getObservable(this, 'itemTemplate').subscribe(newValue => setTimeout(this.checkDirty.bind(this),0));
            ko.getObservable(this, 'itemBodyTemplate').subscribe(newValue => setTimeout(this.checkDirty.bind(this),0));
        }

        private root: FilesList;
        private wpId: string;
        public title: string;

        public controlTemplate: string;
        public groupTemplate: string;
        public itemTemplate: string;
        public itemBodyTemplate: string;

        public files: FileModel[] = [];

        private controlTemplateSaved: string;
        private groupTemplateSaved: string;
        private itemTemplateSaved: string;
        private itemBodyTemplateSaved: string;

        public editing: boolean = false;
        public saved: boolean = true;
        public loading: boolean = false;
        public error: string = "";

        public saveTemplates()
        {
            this.loading = true;
            
            ChromeIntegration.evalAndWaitForResult(
                SPActions.getCode_setTemplates(this.wpId, this.controlTemplate, this.groupTemplate, this.itemTemplate, this.itemBodyTemplate),
                SPActions.getCode_checkTemplatesSaved(),
                (result, errorInfo) => {
                    if (errorInfo || result == "error") {
                        errorInfo && console.log(errorInfo);
                        this.loading = false;
                        this.error = (errorInfo && errorInfo.value) || "check console for details";
                        return;
                    }

                    this.controlTemplateSaved = this.controlTemplate;
                    this.groupTemplateSaved = this.groupTemplate;
                    this.itemTemplateSaved = this.itemTemplate;
                    this.itemBodyTemplateSaved = this.itemBodyTemplate;
                    this.saved = true;
                    this.loading = false;
                    this.editing = false;

                });
        }

        public startEditing()
        {
            this.editing = true;
        }

        public cancelEditing()
        {
            this.editing = false;
            this.error = "";
        }

        private checkDirty(property, newValue)
        {
            this.error = "";
            this.saved = 
               (this.controlTemplateSaved == this.controlTemplate &&
                this.groupTemplateSaved == this.groupTemplate &&
                this.itemTemplateSaved == this.itemTemplate &&
                this.itemBodyTemplateSaved == this.itemBodyTemplate);
        }

    }
}