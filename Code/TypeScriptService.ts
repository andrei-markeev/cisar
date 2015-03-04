module CSREditor {

    class TypeScriptServiceHost implements TypeScript.Services.ILanguageServiceShimHost {
        private scriptVersion: {[fn: string]: number} = {};
        private libText: string = "";
        private libTextLength: number = 0;
        private text: { [fn: string]: string } = {};
        private changes: {
            [fn: string]: TypeScript.TextChangeRange[]
        } = {};

        constructor(libText: string) {
            this.libText = libText;
            this.libTextLength = libText.length;
            this.scriptVersion['csr-editor.ts'] = 0;
            this.text['csr-editor.ts'] = '';
            this.changes['csr-editor.ts'] = [];
            this.scriptVersion['live.ts'] = 0;
            this.text['live.ts'] = '';
            this.changes['live.ts'] = [];
        }

        log(message) { console.log("tsHost: " + message); }
        information() { return true; }
        debug() { return true; }
        warning() { return true; }
        error() { return true; }
        fatal() { return true; }
        getCompilationSettings() { return "{ \"noLib\": true }"; }
        getScriptFileNames() { return "[\"libs.ts\", \"live.ts\", \"csr-editor.ts\"]" }
        getScriptVersion(fn) { return this.scriptVersion[fn]; }
        getScriptIsOpen(fn) { return true; }
        getLocalizedDiagnosticMessages() { return ""; }
        getCancellationToken() { return null; }
        getScriptByteOrderMark(fn) { return 0; }

        resolveRelativePath() { return null; }
        fileExists(fn) { return null; }
        directoryExists(dir) { return null; }
        getParentDirectory(dir) { return null; }
        getDiagnosticsObject() { return null; }

        getScriptSnapshot(fn) {
            var snapshot, snapshotChanges, snapshotVersion;
            if (fn == 'libs.ts')
            {
                snapshot = TypeScript.ScriptSnapshot.fromString(this.libText);
                snapshotChanges = [];
                snapshotVersion = 0;
            }
            else {
                snapshot = TypeScript.ScriptSnapshot.fromString(this.text[fn]);
                snapshotChanges = this.changes[fn];
                snapshotVersion = this.scriptVersion[fn];
            }
            return {
                getText: function (s, e) { return snapshot.getText(s, e); },
                getLength: function () { return snapshot.getLength(); },
                getLineStartPositions: function () { return "[" + snapshot.getLineStartPositions().toString() + "]" },
                getTextChangeRangeSinceVersion: function (version) {
                    if (snapshotVersion == 0 || snapshotChanges.length == 0)
                        return null;
                    var result = TypeScript.TextChangeRange.collapseChangesAcrossMultipleVersions(snapshotChanges.slice(version - snapshotVersion));
                    return "{ \"span\": { \"start\": " + result.span().start() + ", \"length\": " + result.span().length() + " }, \"newLength\": " + result.newLength() + " }";
                }
            };
        }

        public getLibLength() { return this.libTextLength; }
        public scriptChanged(fn, newText, startPos=0, changeLength=0) {
            this.scriptVersion[fn]++;
            this.text[fn] = newText;
            if (startPos>0 || changeLength > 0)
                this.changes[fn].push(new TypeScript.TextChangeRange(new TypeScript.TextSpan(startPos, changeLength), newText.length));
        }
    }

    export class TypeScriptService {
        private tsServiceShim: TypeScript.Services.ILanguageServiceShim;
        private tsHost: TypeScriptServiceHost;

        constructor() {

            var self = this;
            var client = new XMLHttpRequest();
            client.open('GET', 'Scripts/typings/libs.d.ts');
            client.onreadystatechange = function () {
                if (client.readyState != 4)
                    return;

                self.tsHost = new TypeScriptServiceHost(client.responseText);
                var tsFactory = new TypeScript.Services.TypeScriptServicesFactory();
                self.tsServiceShim = tsFactory.createLanguageServiceShim(self.tsHost);
            }
            client.send();
        }

        public scriptChanged(newText, startPos, changeLength) {
            this.tsHost.scriptChanged('csr-editor.ts', newText, startPos, changeLength);
        }
        public windowChanged(newText) {
            this.tsHost.scriptChanged('live.ts', newText);
        }

        public getSymbolInfo(position) {
            return this.tsServiceShim.languageService["getSymbolInfoAtPosition"]('csr-editor.ts', position);
        }

        public getCompletions(position) {
            return this.tsServiceShim.languageService.getCompletionsAtPosition('csr-editor.ts', position, true);
        }

        public getCompletionDetails(position, name) {
            return this.tsServiceShim.languageService.getCompletionEntryDetails('csr-editor.ts', position, name);
        }

        public getSignature(position) {
            return this.tsServiceShim.languageService.getSignatureAtPosition('csr-editor.ts', position);
        }

        public getErrors(): TypeScript.Diagnostic[]{
            var syntastic = this.tsServiceShim.languageService.getSyntacticDiagnostics('csr-editor.ts');
            var semantic = this.tsServiceShim.languageService.getSemanticDiagnostics('csr-editor.ts');
            return syntastic.concat(semantic);
        }
    }

}