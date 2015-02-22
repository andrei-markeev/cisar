module CSREditor {
    export class WebPartModel {

        constructor(root: FilesList) {
            this.root = root;
            ko.track(this);
        }

        private root: FilesList;

        public files: FileModel[] = [];
        private fileFlags: { [url: string]: number } = {};

        public appendFileToList(url, justcreated: boolean = false) {
            if (!this.fileFlags[url]) {
                var file = new FileModel(this.root);
                file.url = url;
                file.shortUrl = url.substr(url.lastIndexOf('/') + 1);
                file.justCreated = justcreated;
                this.files.push(file);
                if (justcreated) {
                    if (this.root.currentFile)
                        this.root.currentFile.current = false;
                    this.root.currentFile = file;
                    file.current = true;
                }
                this.fileFlags[url] = 1;
            }
        }


        public adding: boolean = false;
        public loading: boolean = false;
        public newFileName: string = '';

        public displayAddNewFileUI(data) {
            this.newFileName = '';
            this.adding = true;
        }

        public fileNameInputKeyDown(data, event) {
            return this.enterFileName(event, this.newFileName,() => { this.performNewFileCreation() },() => { this.adding = false; });
        }

        public enterFileName(event, value, okCallback, cancelCallback) {
            if ((event.keyCode == 13 && value != "") || event.keyCode == 27) {

                if (event.keyCode == 13)
                    okCallback();
                else
                    cancelCallback();

                event.preventDefault();
                event.stopPropagation();
            }
            else {
                var safe = false;
                if (event.keyCode >= 65 && event.keyCode <= 90)
                    safe = true;
                if (event.keyCode >= 48 && event.keyCode <= 57 && event.shiftKey == false)
                    safe = true;
                if ([8, 35, 36, 37, 38, 39, 40, 46, 189].indexOf(event.keyCode) > -1)
                    safe = true;
                if (event.keyCode == 190 && event.shiftKey == false)
                    safe = true;
                if (event.char == "")
                    safe = true;

                if (!safe) {
                    event.preventDefault();
                    event.stopPropagation();
                    console.groupEnd();
                    return false;
                }
            }
            return true;
        }

        private performNewFileCreation() {

            this.adding = false;
            this.loading = true;
            if (this.newFileName.indexOf('.js') == -1)
                this.newFileName += '.js';

            CSREditor.ChromeIntegration.eval(

                SPActions.getCode_createFileInSharePoint(this.root.filesPath.replace(' ', '%20').toLowerCase(), this.newFileName),

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
                                            this.fileWasCreated(this.newFileName, result);
                                        else if (result2 == "error")
                                            alert("There was an error when creating the file. Please check console for details.");
                                    }

                                });

                        }, 1000);

                    }
                });

        }

        private fileWasCreated(newFileName, result) {

            var fullUrl = (this.root.siteUrl + this.root.filesPath.replace(' ', '%20') + newFileName).toLowerCase();
            this.appendFileToList(fullUrl, true);

            var wptype = result.isListForm ? "LFWP" : "XLV";
            this.root.setEditorText(fullUrl,
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

                (result.isListForm ? '' :
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

                (result.isListForm ? '' :
                    '      //     Footer: function(ctx) { return ""; }\r\n'
                    ) +

                '\r\n' +
                '      },\r\n\r\n' +
                '      // OnPostRender: function(ctx) { },\r\n\r\n' +

                (result.isListForm ? '' :
                    '      BaseViewID: ' + result.baseViewId + ',\r\n'
                    ) +

                '      ListTemplateType: ' + result.listTemplate + '\r\n\r\n' +
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