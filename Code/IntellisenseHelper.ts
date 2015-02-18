module CSREditor {

    export class IntellisenseHelper {

        private typeScriptService: TypeScriptService;
        private tooltipLastPos = { line: -1, ch: -1 };
        private fieldNames = [];

        constructor (typeScriptService: TypeScriptService, editor: CodeMirror.Editor) {
            this.typeScriptService = typeScriptService;
            editor.on("cursorActivity", (cm) => {
                if (cm.getDoc().getCursor().line != this.tooltipLastPos.line || cm.getDoc().getCursor().ch < this.tooltipLastPos.ch) {
                    $('.tooltip').remove();
                }
            });

        }

        public setFieldInternalNames(fieldNames: string[]) {
            this.fieldNames = fieldNames;
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
                            if (list[i].text.toLowerCase().indexOf(token.string.toLowerCase().replace(/\"$/, '')) > -1)
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
            var completions = this.typeScriptService.getCompletions(scriptPosition);

            if (completions == null)
                return;

            $('.tooltip').remove();

            var list = [];
            for (var i = 0; i < completions.entries.length; i++) {
                var details = this.typeScriptService.getCompletionDetails(scriptPosition, completions.entries[i].name);
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

            this.showCodeMirrorHint(cm, list);

        }

        private showFunctionTooltip(cm: CodeMirror.Doc, changePosition) {

            $('.tooltip').remove();

            var signature = this.typeScriptService.getSignature(cm.indexFromPos(changePosition) + 1);

            if (signature) {

                this.tooltipLastPos = changePosition;
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

        private showFieldInternalNamesDropDown(cm: CodeMirror.Doc, changePosition: CodeMirror.Position) {
            var position = cm.indexFromPos(changePosition) + 1;
            var symbolInfo = this.typeScriptService.getSymbolInfo(position);
            var typeMembers = symbolInfo.symbol.type.getMembers();
            if (typeMembers.length == 4
                && typeMembers[0].name == "View"
                && typeMembers[1].name == "EditForm"
                && typeMembers[2].name == "DisplayForm"
                && typeMembers[3].name == "NewForm") {

                var list = [];
                for (var i = 0; i < this.fieldNames.length; i++) {
                    // field internal names
                    list.push({
                        text: '"' + this.fieldNames[i] + '"',
                        displayText: this.fieldNames[i],
                        docComment: "",
                        livePreview: true
                    });
                }

                this.showCodeMirrorHint(cm, list);

            }
        }

        public scriptChanged(cm: CodeMirror.Doc, changeObj?: CodeMirror.EditorChangeLinkedList) {
            if (changeObj.text.length == 1 && (changeObj.text[0] == '.' || changeObj.text[0] == ' ')) {
                this.showAutoCompleteDropDown(cm, changeObj.to);
                return;
            }
            else if (changeObj.text.length == 1 && (changeObj.text[0] == '(' || changeObj.text[0] == ',')) {
                this.showFunctionTooltip(cm, changeObj.to);
            }
            else if (changeObj.text.length == 1 && changeObj.text[0] == ')') {
                $('.tooltip').remove();
            }
            else if ((changeObj.from.ch > 0 && cm.getRange({ ch: changeObj.from.ch - 1, line: changeObj.from.line }, changeObj.from) == '"')
                || changeObj.text.length == 1 && changeObj.text[0] == '"') {
                this.showFieldInternalNamesDropDown(cm, changeObj.to);
            }
        }

    }
}