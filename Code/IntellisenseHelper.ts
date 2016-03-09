module CSREditor {

    export class IntellisenseHelper {

        private typeScriptService: TypeScriptService;
        private tooltipLastPos: CodeMirror.Position = { line: -1, ch: -1 };
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

        private joinParts(displayParts: ts.SymbolDisplayPart[]) {
            return displayParts.map(p => p.kind == "punctuation" || p.kind == "space" ? p.text : "<span class=\"" + p.kind + "\">" + p.text + "</span>").join("").replace('\n', '<br/>');
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

        private showAutoCompleteDropDown(cm: CodeMirror.Doc, changePosition: CodeMirror.Position) {
            var scriptPosition = cm.indexFromPos(changePosition) + 1;
            var completions = this.typeScriptService.getCompletions(scriptPosition);

            if (completions == null)
                return;

            $('.tooltip').remove();

            var list = [];
            for (var i = 0; i < completions.entries.length; i++) {
                var details = this.typeScriptService.getCompletionDetails(scriptPosition, completions.entries[i].name);
                if (details != null) {
                    list.push({
                        text: completions.entries[i].name,
                        displayText: completions.entries[i].name,
                        typeInfo: this.joinParts(details.displayParts),
                        kind: completions.entries[i].kind,
                        docComment: this.joinParts(details.documentation),
                        livePreview: false
                    });
                }
            }

            this.showCodeMirrorHint(cm, list);

        }

        private showFunctionTooltip(cm: CodeMirror.Doc, changePosition: CodeMirror.Position) {

            $('.tooltip').remove();

            var signatures = this.typeScriptService.getSignature(cm.indexFromPos(changePosition) + 1);

            if (signatures && signatures.items && signatures.selectedItemIndex >= 0) {

                var signature = signatures.items[signatures.selectedItemIndex];

                var paramsString = signature.parameters
                    .map(p => this.joinParts(p.displayParts))
                    .join(this.joinParts(signature.separatorDisplayParts));
                var signatureString = this.joinParts(signature.prefixDisplayParts) + paramsString + this.joinParts(signature.suffixDisplayParts);

                this.tooltipLastPos = changePosition;
                var cursorCoords = cm.getEditor().cursorCoords(cm.getCursor(), "page");
                var domElement = cm.getEditor().getWrapperElement();

                $(domElement).data('bs.tooltip', false).tooltip({
                    html: true,
                    title: '<div class="tooltip-typeInfo">' + signatureString + '</div>' + '<div class="tooltip-docComment">' + this.joinParts(signature.documentation) + '</div>',
                    trigger: 'manual', container: 'body', placement: 'bottom'
                });
                $(domElement).off('shown.bs.tooltip').on('shown.bs.tooltip', function () {
                    $('.tooltip').css('top', cursorCoords.bottom + "px").css('left', cursorCoords.left + "px")
            });
                $(domElement).tooltip('show');
            }
        }

        public scriptChanged(cm: CodeMirror.Doc, changeText: string, changePos: CodeMirror.Position) {
            if (changeText == '.') {
                this.showAutoCompleteDropDown(cm, changePos);
            }
            else if (changeText == '(' || changeText == ',') {
                this.showFunctionTooltip(cm, changePos);
            }
            else if (changeText == ')') {
                $('.tooltip').remove();
            }
        }
    }
}