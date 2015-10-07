module CSREditor {
    export class WebPartModel {

        constructor(root: FilesList, info) {
            this.root = root;
            this.title = info.title;
            this.id = info.wpId;
            this.wpq = info.wpqId;
            this.isListForm = info.isListForm;
            this.ctxKey = info.ctxKey;
            this.listTemplateType = info.listTemplateType;
            ko.track(this);
        }

        private root: FilesList;
        public title: string;
        public id: string;
        public wpq: number;
        public isListForm: boolean;
        public ctxKey: string;
        public listTemplateType: number;

        public files: FileModel[] = [];
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


        public adding: boolean = false;
        public loading: boolean = false;
        public newFileName: string = '';

        public displayAddNewFileUI(data) {
            this.newFileName = '';
            this.adding = true;
        }

        public displayChangePathDialog(data) {
            this.root.changePathDialogShown = true;
        }

        public fileNameInputKeyDown(data, event) {
            return Utils.safeEnterFileName(event, this.newFileName,() => { this.performNewFileCreation() },() => { this.adding = false; });
        }

        private performNewFileCreation() {

            this.adding = false;
            this.loading = true;
            if (this.newFileName.indexOf('.js') == -1)
                this.newFileName += '.js';

            CSREditor.ChromeIntegration.eval(

                SPActions.getCode_createFileInSharePoint(this.root.filesPath.replace(' ', '%20').toLowerCase(), this.newFileName, this.id, this.ctxKey),

                (result, errorInfo) => {
                    if (!errorInfo) {

                        var handle = setInterval(() => {

                            CSREditor.ChromeIntegration.eval(

                                SPActions.getCode_checkFileCreated(),

                                (result2, errorInfo) => {
                                    if (errorInfo)
                                        console.log(errorInfo);
                                    else if (result2 != "wait") {
                                        this.loading = false;
                                        clearInterval(handle);
                                        if (result2 == "created")
                                            this.fileWasCreated(this.newFileName);
                                        else if (result2 == "existing")
                                        {
                                            var fullUrl = (this.root.siteUrl + this.root.filesPath.replace(' ', '%20') + this.newFileName).toLowerCase();
                                            this.appendFileToList(fullUrl, false);
                                        }
                                        else if (result2 == "error")
                                            alert("There was an error when creating the file. Please check console for details.");
                                    }

                                });

                        }, 1000);

                    }
                });

        }

        private fileWasCreated(newFileName) {

            var fullUrl = (this.root.siteUrl + this.root.filesPath.replace(' ', '%20') + newFileName).toLowerCase();
            var file = this.appendFileToList(fullUrl, true);

            var wptype = this.isListForm ? "LFWP" : "XLV";
            this.root.setEditorText(file.url,
                '// The file has been created, saved into "' + this.root.filesPath + '"\r\n' +
                '// and attached to the ' + wptype + ' via JSLink property.\r\n\r\n' +
                'SP.SOD.executeFunc("clienttemplates.js", "SPClientTemplates", function() {\r\n\r\n' +
                '  function getBaseHtml(ctx) {\r\n' +
                '    return SPClientTemplates["_defaultTemplates"].Fields.default.all.all[ctx.CurrentFieldSchema.FieldType][ctx.BaseViewID](ctx);\r\n' +
                '  }\r\n\r\n' +
                '  function init() {\r\n\r\n' +
                '    SPClientTemplates.TemplateManager.RegisterTemplateOverrides({\r\n\r\n' +
                '      // OnPreRender: function(ctx) { },\r\n\r\n' +
                '      Templates: {\r\n\r\n' +

                (this.isListForm ? '' :
                    '      //     View: function(ctx) { return ""; },\r\n' +
                    '      //     Header: function(ctx) { return ""; },\r\n' +
                    '      //     Body: function(ctx) { return ""; },\r\n' +
                    '      //     Group: function(ctx) { return ""; },\r\n' +
                    '      //     Item: function(ctx) { return ""; },\r\n'
                    ) +

                '      //     Fields: {\r\n' +
                '      //         "<fieldInternalName>": {\r\n' +
                '      //             View: function(ctx) { return ""; },\r\n' +
                '      //             EditForm: function(ctx) { return ""; },\r\n' +
                '      //             DisplayForm: function(ctx) { return ""; },\r\n' +
                '      //             NewForm: function(ctx) { return ""; },\r\n' +
                '      //         }\r\n' +
                '      //     },\r\n' +

                (this.isListForm ? '' :
                    '      //     Footer: function(ctx) { return ""; }\r\n'
                    ) +

                '\r\n' +
                '      },\r\n\r\n' +
                '      // OnPostRender: function(ctx) { },\r\n\r\n' +
                '      ListTemplateType: ' + this.listTemplateType + '\r\n\r\n' +
                '    });\r\n' +
                '  }\r\n\r\n' +
                '  RegisterModuleInit(SPClientTemplates.Utility.ReplaceUrlTokens("~siteCollection' + this.root.filesPath + newFileName + '"), init);\r\n' +
                '  init();\r\n\r\n' +
                '});\r\n',
                true
                );

        }



    }
}