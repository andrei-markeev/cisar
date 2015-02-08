module CSREditor {

    export class Utils {
        public static endsWith(s, suffix) {
            return s.indexOf(suffix, s.length - suffix.length) !== -1;
        }
        public static cutOffQueryString(s) {
            if (s.indexOf('?') > 0)
                s = s.substr(0, s.indexOf('?'));
            return s;
        }
    }

    export class Panel {
        private editorCM: CodeMirror.Editor;
        private typeScriptService: CSREditor.TypeScriptService;
        private loadingData = false;
        private tooltipLastPos = { line: -1, ch: -1 };
        private changed = false;
        private doNotSave = false;

        private static instance: CSREditor.Panel;
        
        public static start() {

            Panel.instance = new Panel();
            Panel.instance.initialize();
        }

        private initialize() {
            Panel.instance.typeScriptService = new CSREditor.TypeScriptService();
            Panel.instance.editorCM = Panel.instance.initEditor();

            Panel.instance.changed = false;
            Panel.instance.loadingData = false;

            localStorage["fileName"] = null;

            var loadUrlToEditor = function (url: string) {
                CSREditor.ChromeIntegration.getResourceContent(url, function (text: string) {
                    Panel.setEditorText(url, text);
                });
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

        public static isChanged() {
            return Panel.instance.changed;
        }

        private initEditor() {

            var editor = CodeMirror.fromTextArea(<HTMLTextAreaElement>document.getElementById("editor"), {
                lineNumbers: true,
                matchBrackets: true,
                mode: "text/typescript",
                readOnly: true
            });

            editor.on("cursorActivity", function (cm) {
                if (cm.getDoc().getCursor().line != Panel.instance.tooltipLastPos.line || cm.getDoc().getCursor().ch < Panel.instance.tooltipLastPos.ch) {
                    $('.tooltip').remove();
                }
            });

            editor.on("change", function (editor, changeList) { Panel.instance.processChanges(editor.getDoc(), changeList) });
            return editor;
        }

        public static setEditorText(url:string, text: string) {
            localStorage["fileName"] = url;
            Panel.instance.editorCM.getDoc().setValue(text);
            Panel.instance.editorCM.setOption("readOnly", url == null);
        }

        private showCodeMirrorHint(cm: CodeMirror.Doc, list) {
            list.sort(function (l, r) {
                if (l.displayText > r.displayText) return 1;
                if (l.displayText < r.displayText) return -1;
                return 0;
            });

            cm.getEditor()["showHint"]({
                completeSingle: false,
                hint: function (cm) {
                    var cur = cm.getCursor();
                    var token = cm.getTokenAt(cur);
                    var completionInfo = null;
                    var show_words = [];
                    if (token.string == ".") {
                        for (var i = 0; i < list.length; i++) {
                            if (list[i].livePreview == false)
                                show_words.push(list[i]);
                        }

                        completionInfo = { from: cur, to: cur, list: show_words };
                    }
                    else if (token.string == "," || token.string == "(") {

                        completionInfo = { from: cur, to: cur, list: list };

                    }
                    else {
                        for (var i = 0; i < list.length; i++) {
                            if (list[i].text.toLowerCase().indexOf(token.string.toLowerCase()) > -1)
                                show_words.push(list[i]);
                        }

                        completionInfo = {
                            from: { line: cur.line, ch: token.start },
                            to: { line: cur.line, ch: token.end },
                            list: show_words
                        };
                    }

                    var tooltip;
                    CodeMirror.on(completionInfo, "select", function (completion, element) {
                        $('.tooltip').remove();
                        if (completion.typeInfo) {
                            $(element).tooltip({
                                html: true,
                                title: '<div class="tooltip-typeInfo">' + completion.typeInfo + '</div>' + '<div class="tooltip-docComment">' + completion.docComment.replace('\n', '<br/>') + '</div>',
                                trigger: 'manual', container: 'body', placement: 'right'
                            });
                            $(element).tooltip('show');
                        }
                    });
                    CodeMirror.on(completionInfo, "close", function () {
                        $('.tooltip').remove();
                    });

                    return completionInfo;
                }
            });
        }

        private showAutoCompleteDropDown(cm: CodeMirror.Doc, changePosition) {
            var scriptPosition = cm.indexFromPos(changePosition) + 1;
            var completions = Panel.instance.typeScriptService.getCompletions(scriptPosition);

            if (completions == null)
                return;

            $('.tooltip').remove();

            var list = [];
            for (var i = 0; i < completions.entries.length; i++) {
                var details = Panel.instance.typeScriptService.getCompletionDetails(scriptPosition, completions.entries[i].name);
                list.push({
                    text: completions.entries[i].name,
                    displayText: completions.entries[i].name,
                    typeInfo: details.type,
                    kind: completions.entries[i].kind,
                    docComment: details.docComment,
                    className: "autocomplete-" + completions.entries[i].kind,
                    livePreview: false
                });
            }

            Panel.instance.showCodeMirrorHint(cm, list);

        }

        private showFunctionTooltip(cm: CodeMirror.Doc, changePosition) {

            $('.tooltip').remove();

            var signature = Panel.instance.typeScriptService.getSignature(cm.indexFromPos(changePosition) + 1);

            if (signature) {

                Panel.instance.tooltipLastPos = changePosition;
                var cursorCoords = cm.getEditor().cursorCoords(cm.getCursor(), "page");
                var domElement = cm.getEditor().getWrapperElement();

                $(domElement).data('bs.tooltip', false).tooltip({
                    html: true,
                    title: '<div class="tooltip-typeInfo">' + signature.formal[0].signatureInfo + '</div>' + '<div class="tooltip-docComment">' + signature.formal[0].docComment.replace('\n', '<br/>') + '</div>',
                    trigger: 'manual', container: 'body', placement: 'bottom'
                });
                $(domElement).off('shown.bs.tooltip').on('shown.bs.tooltip', function () {
                    $('.tooltip').css('top', cursorCoords.bottom + "px").css('left', cursorCoords.left + "px")
            });
                $(domElement).tooltip('show');
            }
        }

        private processChanges(cm: CodeMirror.Doc, changeObj?: CodeMirror.EditorChangeLinkedList) {

            if (!changeObj)
                return;

            Panel.instance.changed = true;
            Panel.instance.typeScriptService.scriptChanged(cm.getValue(), cm.indexFromPos(changeObj.from), cm.indexFromPos(changeObj.to) - cm.indexFromPos(changeObj.from));
            if (Panel.instance.doNotSave == false) {

                var url = localStorage["fileName"];
                if (url != "null") {
                    FilesList.refreshCSR(url, cm.getValue());
                    FilesList.saveChangesToFile(url, cm.getValue());
                    Panel.instance.changed = false;
                }
            }

            if (changeObj.text.length == 1 && (changeObj.text[0] == '.' || changeObj.text[0] == ' ')) {
                Panel.instance.showAutoCompleteDropDown(cm, changeObj.to);
                return;
            }
            else if (changeObj.text.length == 1 && (changeObj.text[0] == '(' || changeObj.text[0] == ',')) {
                Panel.instance.showFunctionTooltip(cm, changeObj.to);
            }
            else if (changeObj.text.length == 1 && changeObj.text[0] == ')') {
                $('.tooltip').remove();
            }

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
