module CSREditor {

    export class Panel {
        private editorCM: CodeMirror.Editor;
        private typeScriptService: CSREditor.TypeScriptService;
        private intellisenseHelper: CSREditor.IntellisenseHelper;
        private filesList: CSREditor.FilesList;
        private fileName = null;
        private modifiedFilesContent = {};
        private needSave = false;

        public static start() {
            var panel = new Panel();
            panel.initialize();
        }

        private initialize() {
            this.typeScriptService = new CSREditor.TypeScriptService();
            this.editorCM = this.initEditor();
            this.intellisenseHelper = new CSREditor.IntellisenseHelper(this.typeScriptService, this.editorCM);

            this.filesList = new CSREditor.FilesList(this);
            this.loadWindowKeys();

            ChromeIntegration.setNavigatedListener((pageUrl) => {
                ChromeIntegration.waitForResult(SPActions.getCode_checkPageIsLoaded(), () => {
                    this.setEditorText(null, "");
                    this.filesList.reload();
                    this.loadWindowKeys();
                });
            });
        }

        private loadWindowKeys() {

            ChromeIntegration.eval("keys(window)", (result, errorInfo) => {
                if (!errorInfo) {
                    var windowTS = '';
                    var completions = this.typeScriptService.getCompletions(0);
                    var existingSymbols = {};
                    if (completions != null) {
                        for (var i = 0; i < completions.entries.length; i++)
                            existingSymbols[completions.entries[i].name] = 1;
                    }
                    for (var k = 0; k < result.length; k++) {
                        if (typeof existingSymbols[result[k]] == 'undefined' && /^[\$a-zA-Z_][\$a-zA-Z0-9_]+$/.test(result[k]))
                            windowTS += 'var ' + result[k] + ': any;';
                    }
                    this.typeScriptService.windowChanged(windowTS);
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

            editor.on("change", (editor, changeList) => { this.processChanges(editor.getDoc(), changeList) });
            return editor;
        }

        public loadUrlToEditor(url: string) {
            if (url in this.modifiedFilesContent)
                this.setEditorText(url, this.modifiedFilesContent[url]);
            else {
                // clear content and make readonly while loading
                this.setEditorText(null, '');

                ChromeIntegration.evalAndWaitForResult(SPActions.getCode_getFileContent(url), SPActions.getCode_checkFileContentRetrieved(), (result, errorInfo) => {
                    if (errorInfo || result == "error") {
                        this.setEditorText(null, "");
                        this.filesList.fileError = "There was an error opening file '" + url + "'.<br/>Check console for details.";
                    }
                    else if (result == "notFound") {
                        var isOtherFile = false;
                        for (var otherFile of this.filesList.otherFiles) {
                            if (otherFile.url == url) {
                                isOtherFile = true;
                                break;
                            }
                        }

                        this.setEditorText(null, "");
                        if (isOtherFile)
                            this.filesList.fileError = "File is referenced by the page but was not found: " + url;
                        else
                            this.filesList.fileError = "File '" + url + "' is referenced by JSLink but was not found.<br/>If you want to remove it from JSLink, use delete icon (<i class='fa fa-trash-o'></i>) next to the filename.";
                    }
                    else
                        this.setEditorText(url, result);
                });
            }
        }

        public setEditorText(url: string, text: string, newlyCreated: boolean = false) {
            this.filesList.fileError = null;
            this.fileName = url;
            this.editorCM.setOption("mode", url != null && url.endsWith(".js") ? "text/typescript" : "text/html");
            this.needSave = false;
            this.editorCM.getDoc().setValue(text);
            this.editorCM.setOption("readOnly", url == null);

            if (url == null)
                return;

            this.needSave = true;

            if (newlyCreated) {
                this.modifiedFilesContent[url] = text;
                this.filesList.saveChangesToFile(url, text, true);
            }
            
            this.intellisenseHelper.setFieldInternalNames([]);
            if (!this.filesList.currentWebPart || this.filesList.currentWebPart instanceof SearchWebpart)
                return;
            
            var wp = this.filesList.currentWebPart;
            ChromeIntegration.eval(SPActions.getCode_retrieveFieldsInfo(wp.ctxKey), (result, errorInfo) => {
                var fieldNames = [];
                for (var i in result) {
                    var f = result[i].Name;
                    if (wp.isListForm && (f == "Attachments" || f == "Created" || f == "Modified" || f == "Author" || f == "Editor" || f == "_UIVersionString"))
                        continue;

                    fieldNames.push(result[i].Name);
                }
                this.intellisenseHelper.setFieldInternalNames(fieldNames);
            });
        }

        public getEditorTextRaw()
        {
            return this.editorCM.getDoc().getValue();
        }

        private processChanges(cm: CodeMirror.Doc, changeObj?: CodeMirror.EditorChangeLinkedList) {

            if (!changeObj)
                return;

            var isTS = this.editorCM.getOption("mode") == "text/typescript";
            var isHtml = this.editorCM.getOption("mode") == "text/html";

            if (isTS)
                this.typeScriptService.scriptChanged(cm.getValue(), cm.indexFromPos(changeObj.from), cm.indexFromPos(changeObj.to) - cm.indexFromPos(changeObj.from));

            var url = this.fileName;
            if (url != null) {

                var text = cm.getValue();
                var transformer = new DisplayTemplateTransformer(text, this.filesList.currentFile.displayTemplateUniqueId, this.filesList.currentFile.displayTemplateData);

                if (isTS)
                    this.filesList.refreshCSR(url, this.typeScriptService.getJs());
                else if (isHtml)
                {
                    try
                    {
                        var jsContent = transformer.Transform();
                        
                        this.filesList.refreshCSR(url, jsContent);
                        this.typeScriptService.scriptChanged(jsContent, 0, 0);
                    }
                    catch(e)
                    {
                        console.log(e);
                    }
                }

                if (this.needSave)
                {
                    this.filesList.saveChangesToFile(url, text);
                    this.modifiedFilesContent[url] = text;
                }

                if (changeObj.text.length == 1)
                    this.intellisenseHelper.scriptChanged(cm, changeObj.text[0], transformer.GetPositionInJs(cm.indexFromPos(changeObj.to)+1));
                this.checkSyntax(cm, transformer);
            }
        }

        private static checkSyntaxTimeout: number = 0;
        private checkSyntax(cm: CodeMirror.Doc, transformer: DisplayTemplateTransformer) {
            var allMarkers = cm.getAllMarks();
            for (var i = 0; i < allMarkers.length; i++) {
                allMarkers[i].clear();
            }

            if (Panel.checkSyntaxTimeout)
                clearTimeout(Panel.checkSyntaxTimeout);

            Panel.checkSyntaxTimeout = setTimeout(() => {
                var errors = this.typeScriptService.getErrors();
                for (var i = 0; i < errors.length; i++) {
                    var text = "";
                    if (typeof errors[i].messageText == "string")
                        text = <string>errors[i].messageText;
                    else {
                        var chain = <ts.DiagnosticMessageChain>errors[i].messageText;
                        var texts = [];
                        while (chain.next) {
                            texts.push(chain.messageText);
                            chain = chain.next;
                        }
                        text = texts.join('\n  ');
                    }

                    var start = transformer.GetPositionInHtml(errors[i].start);
                    var end = transformer.GetPositionInHtml(errors[i].start + errors[i].length);
                    
                    if (start != -1 && end != -1)
                        cm.markText(cm.posFromIndex(start), cm.posFromIndex(end), {
                            className: "syntax-error",
                            title: text
                        });
                }
            }, 1500);
        }

    }

}
