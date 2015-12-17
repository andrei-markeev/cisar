module CSREditor {

    class TypeScriptServiceHost implements ts.LanguageServiceHost {
        private scriptVersion: {[fn: string]: number } = {};
        private libText: string = "";
        private libTextLength: number = 0;
        private text: { [fn: string]: string } = {};
        private changes: {
            [fn: string]: ts.TextChangeRange[]
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

        getCompilationSettings() { return <ts.CompilerOptions>{ removeComments: true, target: ts.ScriptTarget.ES5 }; }

        getScriptFileNames() { return ["libs.ts", "live.ts", "csr-editor.ts"]; }
        getScriptVersion(fn) { return (this.scriptVersion[fn] || 0).toString(); }
        getScriptSnapshot(fn) {
            var snapshot, snapshotChanges, snapshotVersion;
            if (fn == 'libs.ts')
                return ts.ScriptSnapshot.fromString(this.libText);
            else
                return ts.ScriptSnapshot.fromString(this.text[fn]);
        }

        getCurrentDirectory() { return ""; }
        getDefaultLibFileName() { return "libs.ts"; }

        public scriptChanged(fn, newText, startPos=0, changeLength=0) {
            this.scriptVersion[fn]++;
            this.text[fn] = newText;
            if (startPos > 0 || changeLength > 0)
                this.changes[fn].push(ts.createTextChangeRange(ts.createTextSpan(startPos, changeLength), newText.length));
        }
    }

    export class TypeScriptService {
        private tsService: ts.LanguageService;
        private tsHost: TypeScriptServiceHost;

        constructor() {

            var self = this;
            var client = new XMLHttpRequest();
            client.open('GET', 'Scripts/typings/libs.d.ts');
            client.onreadystatechange = function () {
                if (client.readyState != 4)
                    return;

                self.tsHost = new TypeScriptServiceHost(client.responseText);
                self.tsService = ts.createLanguageService(self.tsHost, ts.createDocumentRegistry());
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
            return this.tsService.getEncodedSemanticClassifications('csr-editor.ts', position);
        }

        public getCompletions(position) {
            return this.tsService.getCompletionsAtPosition('csr-editor.ts', position);
        }

        public getCompletionDetails(position, name) {
            return this.tsService.getCompletionEntryDetails('csr-editor.ts', position, name);
        }

        public getSignature(position) {
            return this.tsService.getSignatureHelpItems('csr-editor.ts', position);
        }

        public getErrors(): ts.Diagnostic[]{
            var syntastic = this.tsService.getSyntacticDiagnostics('csr-editor.ts');
            var semantic = this.tsService.getSemanticDiagnostics('csr-editor.ts');
            return syntastic.concat(semantic);
        }

        public getJs() {
            return this.tsService.getEmitOutput('csr-editor.ts').outputFiles[0].text;
        }
    }

}