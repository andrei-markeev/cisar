module CSREditor {
    export class NewFileHelper {

        public static performNewFileCreation(filesList: FilesList, webpart: WebPartModel) {

            webpart.adding = false;
            webpart.loading = true;
            if (webpart.newFileName.indexOf('.js') == -1)
                webpart.newFileName += '.js';

            CSREditor.ChromeIntegration.evalAndWaitForResult(

                SPActions.getCode_createFileInSharePoint(filesList.filesPath.toLowerCase(), webpart.newFileName, webpart.id, webpart.ctxKey),
                SPActions.getCode_checkFileCreated(),

                (result, errorInfo) => {
                    webpart.loading = false;
                    if (errorInfo || result == "error") {
                        alert("There was an error when creating the file. Please check console for details.");
                        if (errorInfo)
                            console.log(errorInfo);
                    }
                    else if (result == "created") {
                        var fullUrl = (filesList.siteUrl + filesList.filesPath.replace(' ', '%20') + webpart.newFileName).toLowerCase();
                        var file = webpart.appendFileToList(fullUrl, true);
                        var templateText = this.generateTemplate(webpart, filesList.filesPath);

                        filesList.setEditorText(file.url, templateText, true);
                    }
                    else if (result == "existing") {
                        var fullUrl = (filesList.siteUrl + filesList.filesPath.replace(' ', '%20') + webpart.newFileName).toLowerCase();
                        webpart.appendFileToList(fullUrl, false);
                    }

                }

            );

        }

        private static generateTemplate(webpart: WebPartModel, filesPath: string) {

            if (!webpart.fields || webpart.fields.length == 0)
                webpart.fields = ['<field internal name>'];

            var fieldMarkup = '      //     Fields: {\r\n';
            for (var f = 0; f < webpart.fields.length; f++) {
                var field = webpart.fields[f];

                if (field == "Attachments" || field == "Created" || field == "Modified"
                    || field == "Author" || field == "Editor" || field == "_UIVersionString")
                    continue;

                fieldMarkup +=

                '      //         "' + field + '": {\r\n' +
                '      //             View: function(ctx) { return ""; },\r\n' +
                '      //             EditForm: function(ctx) { return ""; },\r\n' +
                '      //             DisplayForm: function(ctx) { return ""; },\r\n' +
                '      //             NewForm: function(ctx) { return ""; }\r\n' +
                ((f === webpart.fields.length - 1) ?
                    '      //         }\r\n'
                    :
                    '      //         },\r\n');

            };
            fieldMarkup += '      //     },\r\n';

            var wptype = webpart.isListForm ? "LFWP" : "XLV";

            return '// The file has been created, saved into "' + filesPath + '"\r\n' +
                '// and attached to the ' + wptype + ' via JSLink property.\r\n\r\n' +
                'SP.SOD.executeFunc("clienttemplates.js", "SPClientTemplates", function() {\r\n\r\n' +
                '  function getBaseHtml(ctx) {\r\n' +
                '    return SPClientTemplates["_defaultTemplates"].Fields.default.all.all[ctx.CurrentFieldSchema.FieldType][ctx.BaseViewID](ctx);\r\n' +
                '  }\r\n\r\n' +
                '  function init() {\r\n\r\n' +
                '    SPClientTemplates.TemplateManager.RegisterTemplateOverrides({\r\n\r\n' +
                '      // OnPreRender: function(ctx) { },\r\n\r\n' +
                '      Templates: {\r\n\r\n' +

                (webpart.isListForm ? '' :
                    '      //     View: function(ctx) { return ""; },\r\n' +
                    '      //     Header: function(ctx) { return ""; },\r\n' +
                    '      //     Body: function(ctx) { return ""; },\r\n' +
                    '      //     Group: function(ctx) { return ""; },\r\n' +
                    '      //     Item: function(ctx) { return ""; },\r\n'
                ) +

                fieldMarkup +

                (webpart.isListForm ? '' :
                    '      //     Footer: function(ctx) { return ""; }\r\n'
                ) +

                '\r\n' +
                '      },\r\n\r\n' +
                '      // OnPostRender: function(ctx) { },\r\n\r\n' +
                '      ListTemplateType: ' + webpart.listTemplateType + '\r\n\r\n' +
                '    });\r\n' +
                '  }\r\n\r\n' +
                '  RegisterModuleInit(SPClientTemplates.Utility.ReplaceUrlTokens("~siteCollection' + filesPath + webpart.newFileName + '"), init);\r\n' +
                '  init();\r\n\r\n' +
                '});\r\n';
        }
    }
}