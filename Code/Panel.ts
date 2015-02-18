module CSREditor {

    export class Panel {
        private editorCM: CodeMirror.Editor;
        private typeScriptService: CSREditor.TypeScriptService;
        private intellisenseHelper: CSREditor.IntellisenseHelper;
        private fileName = null;
        private newFilesContent = {};

        private static instance: CSREditor.Panel;
        
        public static start() {

            Panel.instance = new Panel();
            Panel.instance.initialize();
        }

        private initialize() {
            Panel.instance.typeScriptService = new CSREditor.TypeScriptService();
            Panel.instance.editorCM = Panel.instance.initEditor();
            Panel.instance.intellisenseHelper = new CSREditor.IntellisenseHelper(Panel.instance.typeScriptService, Panel.instance.editorCM);

            var loadUrlToEditor = function (url: string) {
                if (url in Panel.instance.newFilesContent)
                    Panel.setEditorText(url, Panel.instance.newFilesContent[url]);
                else {
                    ChromeIntegration.getResourceContent(url, function (text: string) {
                        Panel.setEditorText(url, text);
                    });
                }
            }

            ChromeIntegration.eval("_spPageContextInfo.siteAbsoluteUrl", function (result, errorInfo) {
                if (!errorInfo) {
                    var siteUrl = result.toLowerCase();
                    CSREditor.FilesList.siteUrl = siteUrl;
                    ChromeIntegration.getAllResources(siteUrl, function (urls: { [url: string]: number; }) {
                        CSREditor.FilesList.addFiles(urls, loadUrlToEditor);
                    });
                    ChromeIntegration.setResourceAddedListener(siteUrl, function (url: string) {
                        var urls: { [url: string]: number; } = {};
                        urls[url] = 1;
                        CSREditor.FilesList.addFiles(urls, loadUrlToEditor);
                    });
                }
            });

        }

        private initEditor() {

            var editor = CodeMirror.fromTextArea(<HTMLTextAreaElement>document.getElementById("editor"), {
                lineNumbers: true,
                matchBrackets: true,
                mode: "text/typescript",
                readOnly: true,
                extraKeys: {
                    "Ctrl-K": "toggleComment"
                }
            });

            editor.on("change", function (editor, changeList) { Panel.instance.processChanges(editor.getDoc(), changeList) });
            return editor;
        }

        public static setEditorText(url:string, text: string, newlyCreated: boolean = false) {
            Panel.instance.fileName = url;
            Panel.instance.editorCM.getDoc().setValue(text);
            Panel.instance.editorCM.setOption("readOnly", url == null);
            if (newlyCreated)
                Panel.instance.newFilesContent[url] = text;
            ChromeIntegration.eval(SPActions.getCode_retrieveFieldsInfo(), function (result, errorInfo) {
                var fieldNames = [];
                for (var i = 0; i < result.length; i++) {
                    fieldNames.push(result[i].Name);
                }
                Panel.instance.intellisenseHelper.setFieldInternalNames(fieldNames);
            });
        }

        private processChanges(cm: CodeMirror.Doc, changeObj?: CodeMirror.EditorChangeLinkedList) {

            if (!changeObj)
                return;

            Panel.instance.typeScriptService.scriptChanged(cm.getValue(), cm.indexFromPos(changeObj.from), cm.indexFromPos(changeObj.to) - cm.indexFromPos(changeObj.from));

            var url = Panel.instance.fileName;
            if (url != null) {
                var text = cm.getValue();
                FilesList.refreshCSR(url, text);
                FilesList.saveChangesToFile(url, text);
                if (url in Panel.instance.newFilesContent)
                    Panel.instance.newFilesContent[url] = text;
                else
                    ChromeIntegration.setResourceContent(url, text);
            }

            Panel.instance.intellisenseHelper.scriptChanged(cm, changeObj);

            Panel.instance.checkSyntax(cm);

        }

        private static checkSyntaxTimeout: number = 0;
        private checkSyntax(cm: CodeMirror.Doc) {
            var allMarkers = cm.getAllMarks();
            for (var i = 0; i < allMarkers.length; i++) {
                allMarkers[i].clear();
            }

            if (Panel.checkSyntaxTimeout)
                clearTimeout(Panel.checkSyntaxTimeout);

            Panel.checkSyntaxTimeout = setTimeout(function () {
                var errors = Panel.instance.typeScriptService.getErrors();
                for (var i = 0; i < errors.length; i++) {
                    cm.markText(cm.posFromIndex(errors[i].start()), cm.posFromIndex(errors[i].start() + errors[i].length()), {
                        className: "syntax-error",
                        title: errors[i].text()
                    });
                }
            }, 1500);
        }

    }

}
