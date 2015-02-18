var B64: any;

module CSREditor {
    export class FilesList {

        public static filesPath = "/Style Library/";
        public static siteUrl = "";

        private static loadUrlToEditor: { (url: string): void };
        private static savingQueue: { [url: string]: any } = {};
        private static savingProcess: any = null;
        private static files: { [url: string]: number } = {};

        public static addFiles(urls: { [url: string]: number }, loadUrlToEditor: { (url: string): void }) {

            FilesList.loadUrlToEditor = loadUrlToEditor;

            for (var url in urls) {
                if (!FilesList.files[url]) {
                    FilesList.appendFileToList(url);
                    FilesList.files[url] = 1;
                }
            }

            (<HTMLDivElement>document.querySelector('.files > div.add')).onclick = function (ev: MouseEvent) {
                FilesList.displayAddNewFileUI();
            };

            (<HTMLDivElement>document.querySelector('.separator')).onclick = function (ev: MouseEvent) {
                if (document.body.className.indexOf("fullscreen") > -1)
                    document.body.className = document.body.className.replace("fullscreen", "");
                else
                    document.body.className += " fullscreen";
            };
        }

        private static appendFileToList(url, justcreated: boolean = false) {
            var filesDiv = document.querySelector('.files');
            var div = document.createElement("div");
            div.title = url;
            div.onclick = function (ev: MouseEvent) {
                FilesList.makeFileCurrent(url, div);
            };

            var removeButton = document.createElement('a');
            removeButton.onclick = function (ev: MouseEvent) {
                if (confirm('Sure to move the file to recycle bin and unbind it from the webpart?')) {
                    FilesList.removeFile(url);
                    div.parentNode.removeChild(div);
                }
                ev.preventDefault();
                ev.stopPropagation();
            };
            removeButton.className = "remove-button"
            removeButton.innerHTML = "╳";
            removeButton.title = "delete file"
            div.appendChild(removeButton);

            div.appendChild(document.createTextNode(url.substr(url.lastIndexOf('/') + 1)));

            if (justcreated)
                div.className = "justcreated";

            if (justcreated && filesDiv.querySelector('.add').nextSibling)
                filesDiv.insertBefore(div, filesDiv.querySelector('.add').nextSibling);
            else
                filesDiv.appendChild(div);

            return div;
        }

        private static makeFileCurrent(url: string, div: HTMLDivElement, loadContent: boolean = true) {
            var divs = document.querySelectorAll(".files > div.current");
            for (var j = 0; j < divs.length; j++) {
                (<HTMLDivElement>divs[j]).className = null;
            }

            div.className = "current";

            if (loadContent)
                FilesList.loadUrlToEditor(url);
        }

        private static displayAddNewFileUI() {

            if (document.querySelector('.files > div.add > input') == null) {

                var addDiv = document.querySelector('.files > div.add');
                var helpDiv = document.createElement('div');
                helpDiv.innerHTML = "Enter a filename.<br/>Path: '" + FilesList.filesPath + "'<br/>[Enter] to create the file, [ESC] to cancel.";
                var input = document.createElement('input');
                input.type = "text";
                input.onkeydown = function (event) {
                    if ((event.keyCode == 13 && input.value != "") || event.keyCode == 27) {

                        if (event.keyCode == 13) {
                            var newFileName = input.value;
                            if (!Utils.endsWith(newFileName, ".js"))
                                newFileName += ".js";

                            FilesList.performNewFileCreation(newFileName);
                        }

                        addDiv.removeChild(input);
                        addDiv.removeChild(helpDiv);
                        event.preventDefault();
                        event.stopPropagation();
                    }
                    else
                    {
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
                            return false;
                        }
                    }
                }
                addDiv.appendChild(input);
                addDiv.appendChild(helpDiv);
                input.focus();

            }

        }

        private static performNewFileCreation(newFileName: string) {

            CSREditor.ChromeIntegration.eval(

                SPActions.getCode_createFileInSharePoint(FilesList.filesPath.replace(' ', '%20').toLowerCase(), newFileName),

                function (result, errorInfo) {
                    if (!errorInfo) {

                        var handle = setInterval(function () {

                            CSREditor.ChromeIntegration.eval(

                                SPActions.getCode_checkFileCreated(),

                                function (result2, errorInfo) {
                                    if (errorInfo)
                                        console.log(errorInfo);
                                    else if (result2 != "wait") {
                                        clearInterval(handle);
                                        if (result2 == "created")
                                            FilesList.fileWasCreated(newFileName, result);
                                        else if (result2 == "error")
                                            alert("There was an error when creating the file. Please check console for details.");
                                    }

                                });

                        }, 1000);

                    }
                });

        }

        private static fileWasCreated(newFileName, result) {

            var fullUrl = (FilesList.siteUrl + FilesList.filesPath.replace(' ', '%20') + newFileName).toLowerCase();
            var div = <HTMLDivElement>document.querySelector('.files div[title="' + fullUrl + '"]');
            if (div == null)
                div = FilesList.appendFileToList(fullUrl, true);
            FilesList.makeFileCurrent(fullUrl, div, false);
            FilesList.files[fullUrl] = 1;

            var wptype = result.isListForm ? "LFWP" : "XLV";
            CSREditor.Panel.setEditorText(fullUrl,
                '// The file has been created, saved into "' + FilesList.filesPath + '"\r\n' +
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
                '  RegisterModuleInit(SPClientTemplates.Utility.ReplaceUrlTokens("~siteCollection' + FilesList.filesPath + newFileName + '"), init);\r\n' +
                '  init();\r\n\r\n' +
                '});\r\n',
                true
                );

        }

        public static refreshCSR(url: string, content: string) {

            url = Utils.cutOffQueryString(url.replace(FilesList.siteUrl, '').replace(' ', '%20').toLowerCase());
            if (url[0] != '/')
                url = '/' + url;

            content = content.replace(/\/\*.+?\*\/|\/\/.*(?=[\n\r])/g, '').replace(/\r?\n\s*|\r\s*/g, ' ').replace(/'/g, "\\'");

            CSREditor.ChromeIntegration.eval(SPActions.getCode_performCSRRefresh(url, content));

        }

        public static saveChangesToFile(url: string, content: string) {

            url = Utils.cutOffQueryString(url.replace(FilesList.siteUrl, '').replace(' ', '%20').toLowerCase());
            if (url[0] != '/')
                url = '/' + url;
            
            FilesList.savingQueue[url] = { content: content, cooldown: 5 };

            if (!FilesList.savingProcess) {
                FilesList.savingProcess = setInterval(function () {
                    for (var fileUrl in FilesList.savingQueue) {
                        FilesList.savingQueue[fileUrl].cooldown--;
                        if (FilesList.savingQueue[fileUrl].cooldown <= 0) {
                            CSREditor.ChromeIntegration.eval(SPActions.getCode_saveFileToSharePoint(fileUrl, B64.encode(FilesList.savingQueue[fileUrl].content)));
                            delete FilesList.savingQueue[fileUrl];
                        }
                    }
                }, 2000);
            }
        }

        public static removeFile(url: string) {
            url = Utils.cutOffQueryString(url.replace(FilesList.siteUrl, '').replace(' ', '%20').toLowerCase());
            if (url[0] != '/')
                url = '/' + url;
            CSREditor.Panel.setEditorText(null, '');
            CSREditor.ChromeIntegration.eval(SPActions.getCode_removeFileFromSharePoint(url));
        }


    }

}
