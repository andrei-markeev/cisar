var CSREditor;
(function (CSREditor) {
    var ChromeIntegration = (function () {
        function ChromeIntegration() {
        }
        ChromeIntegration.setResourceAddedListener = function (siteUrl, callback) {
            if (window["chrome"] && chrome.devtools) {
                chrome.devtools.inspectedWindow.onResourceAdded.addListener(function (resource) {
                    var resUrl = CSREditor.Utils.cutOffQueryString(resource.url.toLowerCase().replace(' ', '%20'));
                    if (CSREditor.Utils.endsWith(resUrl, ".js") && resUrl.indexOf(siteUrl) == 0 && resUrl.indexOf('/_layouts/') == -1)
                        callback(CSREditor.Utils.cutOffQueryString(resource.url));
                });
            }
        };
        ChromeIntegration.setNavigatedListener = function (callback) {
            if (window["chrome"] && chrome.devtools) {
                chrome.devtools.network.onNavigated.addListener(callback);
            }
        };
        ChromeIntegration.getAllResources = function (siteUrl, callback) {
            if (window["chrome"] && chrome.devtools) {
                chrome.devtools.inspectedWindow.getResources(function (resources) {
                    var urls = {};
                    for (var i = 0; i < resources.length; i++) {
                        var resUrl = CSREditor.Utils.cutOffQueryString(resources[i].url.toLowerCase().replace(' ', '%20'));
                        if (CSREditor.Utils.endsWith(resUrl, ".js") && resUrl.indexOf(siteUrl) == 0 && resUrl.indexOf('/_layouts/') == -1)
                            urls[CSREditor.Utils.cutOffQueryString(resources[i].url)] = 1;
                    }
                    callback(urls);
                });
            }
            else
                callback({});
        };
        ChromeIntegration.getResourceContent = function (url, callback) {
            chrome.devtools.inspectedWindow.getResources(function (resources) {
                url = CSREditor.Utils.cutOffQueryString(url.toLowerCase().replace(' ', '%20'));
                for (var i = 0; i < resources.length; i++) {
                    var resUrl = CSREditor.Utils.cutOffQueryString(resources[i].url.toLowerCase().replace(' ', '%20'));
                    if (resUrl == url || (url[0] == "/" && CSREditor.Utils.endsWith(resUrl, url))) {
                        resources[i].getContent(function (content, encoding) {
                            callback(content || "", false);
                        });
                        return;
                    }
                }
                callback("", true);
            });
        };
        ChromeIntegration.setResourceContent = function (url, content, callback) {
            chrome.devtools.inspectedWindow.getResources(function (resources) {
                url = CSREditor.Utils.cutOffQueryString(url.toLowerCase().replace(' ', '%20'));
                for (var i = 0; i < resources.length; i++) {
                    var resUrl = CSREditor.Utils.cutOffQueryString(resources[i].url.toLowerCase().replace(' ', '%20'));
                    if (resUrl == url || (url[0] == "/" && CSREditor.Utils.endsWith(resUrl, url))) {
                        resources[i].setContent(content, false, callback);
                        return;
                    }
                }
            });
        };
        ChromeIntegration.eval = function (code, callback) {
            if (window["chrome"] && chrome.devtools) {
                chrome.devtools.inspectedWindow.eval(code, callback || function (result, errorInfo) {
                    if (errorInfo)
                        console.log(errorInfo);
                });
            }
        };
        ChromeIntegration.waitForResult = function (getResultsCode, callback) {
            var handle = setInterval(function () {
                CSREditor.ChromeIntegration.eval(getResultsCode, function (result, errorInfo) {
                    if (result != "wait") {
                        clearInterval(handle);
                        callback(result, errorInfo);
                    }
                });
            }, 400);
        };
        ChromeIntegration.evalAndWaitForResult = function (code, getResultsCode, callback) {
            CSREditor.ChromeIntegration.eval(code, function (result, errorInfo) {
                if (errorInfo)
                    callback(result, errorInfo);
                else
                    CSREditor.ChromeIntegration.waitForResult(getResultsCode, callback);
            });
        };
        ChromeIntegration.executeInContentScriptContext = function (code) {
            if (!window["chrome"] || !chrome.tabs)
                return false;
            chrome.tabs.executeScript({
                code: code
            });
            return true;
        };
        return ChromeIntegration;
    }());
    CSREditor.ChromeIntegration = ChromeIntegration;
})(CSREditor || (CSREditor = {}));
var DisplayTemplateTokenSyntax = (function () {
    function DisplayTemplateTokenSyntax() {
    }
    Object.defineProperty(DisplayTemplateTokenSyntax, "TokenLogicCodeBegin", {
        get: function () { return "<!--#_"; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(DisplayTemplateTokenSyntax, "TokenLogicCodeEnd", {
        get: function () { return "_#-->"; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(DisplayTemplateTokenSyntax, "TokenRenderExpressionBegin", {
        get: function () { return "_#="; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(DisplayTemplateTokenSyntax, "TokenRenderExpressionEnd", {
        get: function () { return "=#_"; },
        enumerable: true,
        configurable: true
    });
    return DisplayTemplateTokenSyntax;
}());
var TransformState;
(function (TransformState) {
    TransformState[TransformState["HtmlBlock"] = 0] = "HtmlBlock";
    TransformState[TransformState["LogicBlock"] = 1] = "LogicBlock";
    TransformState[TransformState["RenderExpression"] = 2] = "RenderExpression";
})(TransformState || (TransformState = {}));
var TransformIndexType;
(function (TransformIndexType) {
    TransformIndexType[TransformIndexType["NoTokenFound"] = 0] = "NoTokenFound";
    TransformIndexType[TransformIndexType["ContentStart"] = 1] = "ContentStart";
    TransformIndexType[TransformIndexType["ContentEnd"] = 2] = "ContentEnd";
    TransformIndexType[TransformIndexType["CodeBeginToken"] = 3] = "CodeBeginToken";
    TransformIndexType[TransformIndexType["CodeEndToken"] = 4] = "CodeEndToken";
    TransformIndexType[TransformIndexType["RenderBeginToken"] = 5] = "RenderBeginToken";
    TransformIndexType[TransformIndexType["RenderEndToken"] = 6] = "RenderEndToken";
})(TransformIndexType || (TransformIndexType = {}));
var DisplayTemplateTransformer = (function () {
    function DisplayTemplateTransformer(html, uniqueId, templateData) {
        var match = html.match(/<div[^>]*>/);
        var divtag_endpos = 0;
        this.TemplateName = uniqueId;
        if (match != null) {
            divtag_endpos = match.index + match[0].length;
            match = match[0].match(/id\s*=\s*["'](\w+)/);
            if (match != null)
                this.TemplateName = match[1];
        }
        this.PositionMap = [];
        this.StartHtmlPos = divtag_endpos;
        match = html.match(/<script[^>]*>/);
        var scripttag_endpos = 0;
        var scripttag_contentslength = 0;
        if (match != null) {
            scripttag_endpos = match.index + match[0].length;
            scripttag_contentslength = html.indexOf("</script>", scripttag_endpos) - scripttag_endpos;
        }
        this.ScriptBlockPosInHtml = scripttag_endpos;
        this.CurrentState = this.PreviousState = TransformState.HtmlBlock;
        this.UniqueId = uniqueId;
        this.TemplateData = templateData;
        if (divtag_endpos) {
            this.HtmlToTransform = html.substr(divtag_endpos);
            this.ScriptBlockContent = scripttag_endpos == 0 ? "" : html.substr(scripttag_endpos, scripttag_contentslength);
        }
        else {
            this.HtmlToTransform = "";
            this.ScriptBlockContent = html;
        }
    }
    DisplayTemplateTransformer.prototype.Transform = function () {
        var jsContent = "";
        jsContent += "window.DisplayTemplate_" + this.UniqueId + " = function(ctx) {\n";
        jsContent += "  var ms_outHtml=[];\n";
        jsContent += "  var cachePreviousTemplateData = ctx['DisplayTemplateData'];\n";
        jsContent += "  ctx['DisplayTemplateData'] = new Object();\n";
        jsContent += "  DisplayTemplate_" + this.UniqueId + ".DisplayTemplateData = ctx['DisplayTemplateData'];\n";
        jsContent += "  ctx['DisplayTemplateData']['TemplateUrl']='" + this.TemplateData.TemplateUrl + "';\n";
        jsContent += "  ctx['DisplayTemplateData']['TemplateType']='" + this.TemplateData.TemplateType + "';\n";
        jsContent += "  ctx['DisplayTemplateData']['TargetControlType']=" + JSON.stringify(this.TemplateData.TargetControlType) + ";\n";
        jsContent += "  this.DisplayTemplateData = ctx['DisplayTemplateData'];\n";
        jsContent += "\n";
        if (this.TemplateData.TemplateType == "Filter") {
            jsContent += "  ctx['DisplayTemplateData']['CompatibleSearchDataTypes']=" + JSON.stringify(this.TemplateData.CompatibleSearchDataTypes) + ";\n";
            jsContent += "  ctx['DisplayTemplateData']['CompatibleManagedProperties']=" + JSON.stringify(this.TemplateData.CompatibleManagedProperties) + ";\n";
        }
        if (this.TemplateData.TemplateType == "Item") {
            jsContent += "  ctx['DisplayTemplateData']['ManagedPropertyMapping']=" + JSON.stringify(this.TemplateData.ManagedPropertyMapping) + ";\n";
            jsContent += "  var cachePreviousItemValuesFunction = ctx['ItemValues'];\n";
            jsContent += "  ctx['ItemValues'] = function(slotOrPropName) {\n";
            jsContent += "    return Srch.ValueInfo.getCachedCtxItemValue(ctx, slotOrPropName)\n";
            jsContent += "  };\n";
        }
        // ---
        jsContent += "\n";
        jsContent += "  ms_outHtml.push(''";
        var currentPos = this.StartHtmlPos;
        this.PositionMap.push({ js: jsContent.length, html: currentPos });
        var htmlLines = this.HtmlToTransform.split('\n');
        var divs = 0;
        while (htmlLines.length > 0) {
            this.CurrentLine = htmlLines.shift();
            this.ResetIndexes();
            var length = -1;
            do {
                this.ProcessLineSegment();
                var segmentContent = this.CurrentLine.substr(this.Indexes[TransformIndexType.ContentStart], this.Indexes[TransformIndexType.ContentEnd] - this.Indexes[TransformIndexType.ContentStart]);
                if (this.CurrentState == TransformState.HtmlBlock) {
                    var nextDivPos = -1;
                    while ((nextDivPos = segmentContent.indexOf("<div", nextDivPos + 1)) > -1)
                        divs++;
                    nextDivPos = -1;
                    while ((nextDivPos = segmentContent.indexOf("</div", nextDivPos + 1)) > -1)
                        divs--;
                    if (divs < 0) {
                        htmlLines = [];
                        break;
                    }
                }
                if (this.CurrentState == TransformState.LogicBlock && this.PreviousState == TransformState.HtmlBlock)
                    jsContent += ");";
                else if (this.CurrentState == TransformState.HtmlBlock && this.PreviousState == TransformState.LogicBlock)
                    jsContent += "  ms_outHtml.push(";
                else if (this.CurrentState != TransformState.LogicBlock)
                    jsContent += ",";
                this.PositionMap.push({ js: jsContent.length, html: currentPos + this.Indexes[TransformIndexType.ContentStart] });
                switch (this.CurrentState) {
                    case TransformState.HtmlBlock:
                        jsContent += "'" + this.EscapeHtmlSegment(segmentContent) + "'";
                        break;
                    case TransformState.LogicBlock:
                        jsContent += segmentContent;
                        break;
                    case TransformState.RenderExpression:
                        var str = segmentContent.replace("<![CDATA[", '').replace("]]>", '');
                        if (length != -1 && this.CurrentLine.substr(0, length).trim().match(/=\"$/))
                            str = str.replace("&quot;", "\"");
                        jsContent += str;
                        break;
                }
                this.Indexes[TransformIndexType.ContentStart] = this.Indexes[TransformIndexType.ContentEnd];
                this.PreviousState = this.CurrentState;
                if (this.Indexes[TransformIndexType.ContentEnd] <= length)
                    throw "ParseProgressException";
                else
                    length = this.Indexes[TransformIndexType.ContentEnd];
                this.PositionMap.push({ js: jsContent.length, html: currentPos + length });
            } while (this.Indexes[TransformIndexType.ContentEnd] < this.CurrentLine.length);
            jsContent += "\n";
            currentPos += this.CurrentLine.length + 1;
        }
        jsContent += ");\n";
        if (this.TemplateData.TemplateType == "Item")
            jsContent += "  ctx['ItemValues'] = cachePreviousItemValuesFunction;\n";
        jsContent += "  ctx['DisplayTemplateData'] = cachePreviousTemplateData;\n";
        jsContent += "  return ms_outHtml.join('');\n";
        jsContent += "};\n";
        jsContent += "\n        function RegisterTemplate_" + this.UniqueId + "() {\n            if (\"undefined\" != typeof (Srch) && \"undefined\" != typeof (Srch.U) && typeof(Srch.U.registerRenderTemplateByName) == \"function\") {\n                Srch.U.registerRenderTemplateByName(\"" + this.TemplateName + "\", DisplayTemplate_" + this.UniqueId + ");\n                Srch.U.registerRenderTemplateByName(\"" + this.TemplateData.TemplateUrl + "\", DisplayTemplate_" + this.UniqueId + ");\n            }";
        this.ScriptBlockPosInJs = jsContent.length;
        jsContent += this.ScriptBlockContent;
        jsContent += "}\n        RegisterTemplate_" + this.UniqueId + "();";
        this.PositionMap.push({ js: jsContent.length, html: currentPos });
        return jsContent;
    };
    DisplayTemplateTransformer.prototype.GetPositionInHtml = function (posInJs) {
        if (this.PositionMap.length == 0)
            return posInJs;
        if (this.ScriptBlockContent.length > 0 && this.ScriptBlockPosInJs <= posInJs && posInJs < this.ScriptBlockPosInJs + this.ScriptBlockContent.length)
            return this.ScriptBlockPosInHtml + posInJs - this.ScriptBlockPosInJs;
        for (var i = 0; i < this.PositionMap.length - 1; i++) {
            if (this.PositionMap[i].js <= posInJs && posInJs < this.PositionMap[i + 1].js) {
                return this.PositionMap[i].html + posInJs - this.PositionMap[i].js;
            }
        }
        return -1;
    };
    DisplayTemplateTransformer.prototype.GetPositionInJs = function (posInHtml) {
        if (this.PositionMap.length == 0)
            return posInHtml;
        if (this.ScriptBlockContent.length > 0 && this.ScriptBlockPosInHtml <= posInHtml && posInHtml < this.ScriptBlockPosInHtml + this.ScriptBlockContent.length)
            return this.ScriptBlockPosInJs + posInHtml - this.ScriptBlockPosInHtml;
        for (var i = 0; i < this.PositionMap.length - 1; i++) {
            if (this.PositionMap[i].html <= posInHtml && posInHtml < this.PositionMap[i + 1].html) {
                return this.PositionMap[i].js + posInHtml - this.PositionMap[i].html;
            }
        }
        return -1;
    };
    DisplayTemplateTransformer.prototype.ProcessLineSegment = function () {
        this.FindLineTokenIndices();
        this.FindSegmentTypeAndContent();
    };
    DisplayTemplateTransformer.prototype.FindSegmentTypeAndContent = function () {
        var flag = false;
        switch (this.CurrentState) {
            case TransformState.HtmlBlock:
                if (this.Indexes[TransformIndexType.CodeBeginToken] == this.Indexes[TransformIndexType.ContentStart]) {
                    flag = true;
                    this.PreviousState = this.CurrentState;
                    this.CurrentState = TransformState.LogicBlock;
                    this.Indexes[TransformIndexType.ContentStart] = this.Indexes[TransformIndexType.ContentStart] + DisplayTemplateTokenSyntax.TokenLogicCodeBegin.length;
                }
                else if (this.Indexes[TransformIndexType.RenderBeginToken] == this.Indexes[TransformIndexType.ContentStart]) {
                    flag = true;
                    this.PreviousState = this.CurrentState;
                    this.CurrentState = TransformState.RenderExpression;
                    this.Indexes[TransformIndexType.ContentStart] = this.Indexes[TransformIndexType.ContentStart] + DisplayTemplateTokenSyntax.TokenRenderExpressionBegin.length;
                }
                break;
            case TransformState.LogicBlock:
                if (this.Indexes[TransformIndexType.CodeEndToken] == this.Indexes[TransformIndexType.ContentStart]) {
                    flag = true;
                    this.PreviousState = this.CurrentState;
                    this.CurrentState = TransformState.HtmlBlock;
                    this.Indexes[TransformIndexType.ContentStart] = this.Indexes[TransformIndexType.ContentStart] + DisplayTemplateTokenSyntax.TokenLogicCodeEnd.length;
                }
                break;
            case TransformState.RenderExpression:
                if (this.Indexes[TransformIndexType.RenderEndToken] == this.Indexes[TransformIndexType.ContentStart]) {
                    flag = true;
                    this.PreviousState = this.CurrentState;
                    this.CurrentState = TransformState.HtmlBlock;
                    this.Indexes[TransformIndexType.ContentStart] = this.Indexes[TransformIndexType.ContentStart] + DisplayTemplateTokenSyntax.TokenRenderExpressionEnd.length;
                }
                break;
        }
        if (flag) {
            //console.log("FindSegmentTypeAndContent: State changed as a shortcut to "+this.CurrentState+" with segment content now starting at " + this.Indexes[TransformIndexType.ContentStart]);
            this.FindLineTokenIndices();
        }
        this.FindNextTokenTypeAndContentEnd();
    };
    DisplayTemplateTransformer.prototype.FindLineTokenIndices = function () {
        this.Indexes[TransformIndexType.CodeBeginToken] = this.CurrentLine.indexOf(DisplayTemplateTokenSyntax.TokenLogicCodeBegin, this.Indexes[TransformIndexType.ContentStart]);
        this.Indexes[TransformIndexType.CodeEndToken] = this.CurrentLine.indexOf(DisplayTemplateTokenSyntax.TokenLogicCodeEnd, this.Indexes[TransformIndexType.ContentStart]);
        this.Indexes[TransformIndexType.RenderBeginToken] = this.CurrentLine.indexOf(DisplayTemplateTokenSyntax.TokenRenderExpressionBegin, this.Indexes[TransformIndexType.ContentStart]);
        this.Indexes[TransformIndexType.RenderEndToken] = this.CurrentLine.indexOf(DisplayTemplateTokenSyntax.TokenRenderExpressionEnd, this.Indexes[TransformIndexType.ContentStart]);
    };
    DisplayTemplateTransformer.prototype.FindNextTokenTypeAndContentEnd = function () {
        var transformIndexType = TransformIndexType.NoTokenFound;
        var dictionary = {};
        for (var _i = 0, _a = DisplayTemplateTransformer.tokenIndices; _i < _a.length; _i++) {
            var index = _a[_i];
            if (!(this.Indexes[index] in dictionary))
                dictionary[this.Indexes[index]] = index;
        }
        var sortedSet = Object.keys(dictionary).map(function (k) { return +k; }).sort(function (a, b) { return a - b; });
        if (sortedSet.length > 1) {
            var index = +sortedSet.filter(function (n) { return n > -1; })[0];
            transformIndexType = dictionary[index];
            this.Indexes[TransformIndexType.ContentEnd] = index;
        }
        else
            this.Indexes[TransformIndexType.ContentEnd] = this.CurrentLine.length;
        this.NextTokenType = transformIndexType;
    };
    DisplayTemplateTransformer.prototype.EscapeHtmlSegment = function (s) {
        return s.replace(/\\/g, '\\\\').replace(/'/g, '\\\'');
    };
    DisplayTemplateTransformer.prototype.ResetIndexes = function () {
        this.Indexes = {};
        for (var _i = 0, _a = Object.keys(TransformIndexType).map(function (v) { return parseInt(v, 10); }).filter(function (v) { return !isNaN(v); }); _i < _a.length; _i++) {
            var index = _a[_i];
            this.Indexes[index] = index != TransformIndexType.ContentStart ? -1 : 0;
        }
    };
    DisplayTemplateTransformer.tokenIndices = [
        TransformIndexType.CodeBeginToken, TransformIndexType.CodeEndToken,
        TransformIndexType.RenderBeginToken, TransformIndexType.RenderEndToken
    ];
    return DisplayTemplateTransformer;
}());
var CSREditor;
(function (CSREditor) {
    var FileModel = (function () {
        function FileModel(wp, root, url) {
            this.isDisplayTemplate = false;
            this.url = '';
            this.shortUrl = '';
            this.justCreated = false;
            this.published = false;
            this.current = false;
            this.paused = false;
            this.root = root;
            this.wp = wp;
            url = CSREditor.Utils.cutOffQueryString(url.replace(/^https?:\/\/[^\/]+/, '').toLowerCase().replace(/ /g, '%20'));
            if (url.indexOf("_catalogs/masterpage/display%20templates") != -1 && url.endsWith(".js")) {
                url = url.slice(0, -3) + ".html";
                this.isDisplayTemplate = true;
            }
            this.url = url;
            this.shortUrl = url.substr(url.lastIndexOf('/') + 1);
            ko.track(this);
        }
        FileModel.prototype.makeFileCurrent = function () {
            if (this.root.currentFile)
                this.root.currentFile.current = false;
            this.current = true;
            this.root.currentFile = this;
            this.root.currentWebPart = this.wp;
            this.root.loadFileToEditor(this.url);
        };
        FileModel.prototype.publishFile = function () {
            CSREditor.ChromeIntegration.eval(CSREditor.SPActions.getCode_publishFileToSharePoint(this.url));
            this.published = true;
        };
        FileModel.prototype.removeFile = function () {
            if (confirm('Sure to move the file to recycle bin and unbind it from the webpart?')) {
                var url = CSREditor.Utils.toRelative(this.url, this.root.domainPart);
                this.root.setEditorText(null, '');
                CSREditor.ChromeIntegration.eval(CSREditor.SPActions.getCode_removeFileFromSharePoint(url, this.wp != null ? this.wp.id : null));
                this.root.currentWebPart.files.remove(this);
            }
        };
        FileModel.prototype.pauseOrResume = function () {
            this.paused = !this.paused;
        };
        return FileModel;
    }());
    CSREditor.FileModel = FileModel;
})(CSREditor || (CSREditor = {}));
var B64;
var CSREditor;
(function (CSREditor) {
    var FilesList = (function () {
        function FilesList(loadUrlToEditor, setEditorText) {
            this.changePathDialogShown = false;
            this.fileError = null;
            this.pathRelativeToOptions = ['~sitecollection', '~site'];
            this.pathRelativeToEntered = "";
            this.filesPathEntered = "";
            this.siteUrl = "";
            this.webUrl = "";
            this.siteServerRelativeUrl = "";
            this.webServerRelativeUrl = "";
            this.domainPart = "";
            this.personalView = false;
            this.savingQueue = {};
            this.savingProcess = null;
            this.loadFileToEditor = loadUrlToEditor;
            this.setEditorText = setEditorText;
            this.filesPath = localStorage['filesPath'] || "/Style Library/";
            this.pathRelativeTo = localStorage['pathRelativeTo'] || "~sitecollection";
            this.reload();
            ko.track(this);
            ko.getObservable(this, 'filesPath').subscribe(function (newValue) {
                localStorage['filesPath'] = newValue;
            });
            ko.getObservable(this, 'pathRelativeTo').subscribe(function (newValue) {
                localStorage['pathRelativeTo'] = newValue;
            });
            ko.applyBindings(this);
            document.querySelector('.separator').onclick = function (ev) {
                if (document.body.className.indexOf("fullscreen") > -1)
                    document.body.className = document.body.className.replace("fullscreen", "");
                else
                    document.body.className += " fullscreen";
            };
        }
        FilesList.prototype.reload = function () {
            var _this = this;
            this.loading = true;
            this.webparts = [];
            this.otherFiles = [];
            this.displayTemplates = [];
            this.currentWebPart = null;
            this.currentFile = null;
            this.personalView = false;
            this.fileError = null;
            CSREditor.ChromeIntegration.eval("_spPageContextInfo", function (result, errorInfo) {
                if (!errorInfo) {
                    _this.siteUrl = result.siteAbsoluteUrl.toLowerCase();
                    _this.webUrl = result.webAbsoluteUrl.toLowerCase();
                    _this.siteServerRelativeUrl = result.siteServerRelativeUrl.toLowerCase();
                    _this.webServerRelativeUrl = result.webServerRelativeUrl.toLowerCase();
                    _this.domainPart = result.siteServerRelativeUrl == '/' ? _this.siteUrl : _this.siteUrl.replace(result.siteServerRelativeUrl, '');
                    _this.pathRelativeToOptions.removeAll();
                    _this.pathRelativeToOptions.push('~sitecollection');
                    if (result.webServerRelativeUrl != result.siteServerRelativeUrl)
                        _this.pathRelativeToOptions.push('~site');
                    CSREditor.ChromeIntegration.getAllResources(_this.siteUrl, function (urls) {
                        _this.addOtherFiles(Object.keys(urls));
                        _this.loadWebParts();
                    });
                }
            });
        };
        FilesList.prototype.loadWebParts = function () {
            var _this = this;
            CSREditor.ChromeIntegration.eval(CSREditor.SPActions.getCode_listCsrWebparts(), function (result, errorInfo) {
                if (errorInfo) {
                    console.log(errorInfo);
                    return;
                }
                var wpDict = {};
                for (var i = 0; i < result.webparts.length; i++) {
                    var wp = new CSREditor.WebPartModel(_this, result.webparts[i]);
                    wpDict[wp.wpq] = wp;
                    _this.webparts.push(wp);
                }
                for (var i = 0; i < result.displayTemplates.length; i++) {
                    var siteCollUrl = _this.siteServerRelativeUrl == "/" ? "" : _this.siteServerRelativeUrl;
                    var displayTemplateUrl = result.displayTemplates[i].info.TemplateUrl;
                    displayTemplateUrl = displayTemplateUrl.toLowerCase().replace("~sitecollection/", siteCollUrl + "/");
                    displayTemplateUrl = CSREditor.Utils.cutOffQueryString(displayTemplateUrl.replace(' ', '%20'));
                    displayTemplateUrl = displayTemplateUrl.replace(/\.js$/, '.html');
                    for (var o = _this.otherFiles.length - 1; o >= 0; o--) {
                        if (_this.otherFiles[o].url == displayTemplateUrl) {
                            var fm = _this.otherFiles[o];
                            fm.displayTemplateUniqueId = result.displayTemplates[i].uniqueId;
                            fm.displayTemplateData = result.displayTemplates[i].info;
                            _this.otherFiles.remove(fm);
                            _this.displayTemplates.push(fm);
                        }
                    }
                }
                CSREditor.ChromeIntegration.waitForResult(CSREditor.SPActions.getCode_checkJSLinkInfoRetrieved(), function (jsLinkInfo, errorInfo) {
                    _this.loading = false;
                    if (errorInfo || jsLinkInfo == "error") {
                        if (errorInfo)
                            console.log(errorInfo);
                        alert("There was an error when getting list of files. Please check console for details.");
                        return;
                    }
                    if (jsLinkInfo == "personal") {
                        _this.personalView = true;
                        return;
                    }
                    for (var wpqId in jsLinkInfo) {
                        jsLinkInfo[wpqId].forEach(function (url) {
                            var addedFile = wpDict[wpqId].appendFileToList(url);
                            if (addedFile != null) {
                                for (var o = _this.otherFiles.length - 1; o >= 0; o--) {
                                    if (_this.otherFiles[o].url == addedFile.url)
                                        _this.otherFiles.remove(_this.otherFiles[o]);
                                }
                            }
                        });
                    }
                });
            });
        };
        FilesList.prototype.pathInputKeyDown = function (data, event) {
            var _this = this;
            return CSREditor.Utils.safeEnterPath(event, this.filesPathEntered, this.fixupFilesPath.bind(this), function () { _this.changePathDialogShown = false; });
        };
        FilesList.prototype.fixupFilesPath = function () {
            if (this.filesPathEntered[0] != '/')
                this.filesPathEntered = '/' + this.filesPathEntered;
            if (this.filesPathEntered[this.filesPathEntered.length - 1] != '/')
                this.filesPathEntered = this.filesPathEntered + '/';
            this.changePathDialogShown = false;
            this.filesPath = this.filesPathEntered;
            this.pathRelativeTo = this.pathRelativeToEntered;
        };
        FilesList.prototype.addOtherFiles = function (fileUrls) {
            for (var i = 0; i < fileUrls.length; i++) {
                var fileModel = new CSREditor.FileModel(null, this, fileUrls[i]);
                this.otherFiles.push(fileModel);
            }
        };
        FilesList.prototype.refreshCSR = function (url, content) {
            this.currentFile.published = false;
            if (this.currentFile.paused)
                return;
            url = CSREditor.Utils.cutOffQueryString(url.replace(this.siteUrl, '').replace(' ', '%20').toLowerCase());
            if (url[0] != '/')
                url = '/' + url;
            content = content.replace(/\r?\n\s*|\r\s*/g, ' ').replace(/\\/g, "\\\\").replace(/'/g, "\\'");
            CSREditor.ChromeIntegration.eval(CSREditor.SPActions.getCode_performCSRRefresh(url, content));
        };
        FilesList.prototype.saveChangesToFile = function (url, content, saveNow) {
            var _this = this;
            url = CSREditor.Utils.toRelative(url, this.domainPart);
            this.savingQueue[url] = { content: content, cooldown: 3 };
            if (saveNow)
                this.savingQueue[url].cooldown = 1;
            if (!this.savingProcess) {
                this.savingProcess = setInterval(function () {
                    for (var fileUrl in _this.savingQueue) {
                        _this.savingQueue[fileUrl].cooldown--;
                        if (_this.savingQueue[fileUrl].cooldown <= 0) {
                            CSREditor.ChromeIntegration.evalAndWaitForResult(CSREditor.SPActions.getCode_saveFileToSharePoint(fileUrl, B64.encode(_this.savingQueue[fileUrl].content)), CSREditor.SPActions.getCode_checkFileSaved(), function (result, errorInfo) {
                                if (errorInfo || result == "error") {
                                    alert("Error occured when saving file " + fileUrl + ". Please check console for details.");
                                    if (errorInfo)
                                        console.log(errorInfo);
                                }
                            });
                            delete _this.savingQueue[fileUrl];
                        }
                    }
                }, 2000);
            }
        };
        return FilesList;
    }());
    CSREditor.FilesList = FilesList;
})(CSREditor || (CSREditor = {}));
var CSREditor;
(function (CSREditor) {
    var IntellisenseHelper = (function () {
        function IntellisenseHelper(typeScriptService, editor) {
            var _this = this;
            this.tooltipLastPos = { line: -1, ch: -1 };
            this.fieldNames = [];
            this.typeScriptService = typeScriptService;
            editor.on("cursorActivity", function (cm) {
                if (cm.getDoc().getCursor().line != _this.tooltipLastPos.line || cm.getDoc().getCursor().ch < _this.tooltipLastPos.ch) {
                    $('.tooltip').remove();
                }
            });
        }
        IntellisenseHelper.prototype.setFieldInternalNames = function (fieldNames) {
            this.fieldNames = fieldNames;
        };
        IntellisenseHelper.prototype.joinParts = function (displayParts) {
            if (displayParts)
                return displayParts.map(function (p) { return p.kind == "punctuation" || p.kind == "space" ? p.text : "<span class=\"" + p.kind + "\">" + p.text + "</span>"; }).join("").replace('\n', '<br/>');
            else
                return '';
        };
        IntellisenseHelper.prototype.showCodeMirrorHint = function (cm, list) {
            var _this = this;
            list.sort(function (l, r) {
                if (l.displayText > r.displayText)
                    return 1;
                if (l.displayText < r.displayText)
                    return -1;
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
                        if (!completion.typeInfo && completion.pos) {
                            var details = _this.typeScriptService.getCompletionDetails(completion.pos, completion.text);
                            completion.typeInfo = _this.joinParts(details.displayParts);
                            completion.docComment = _this.joinParts(details.documentation);
                        }
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
        };
        IntellisenseHelper.prototype.showAutoCompleteDropDown = function (cm, changePosition) {
            var completions = this.typeScriptService.getCompletions(changePosition);
            if (completions == null)
                return;
            $('.tooltip').remove();
            var list = [];
            for (var i = 0; i < completions.entries.length; i++) {
                list.push({
                    text: completions.entries[i].name,
                    displayText: completions.entries[i].name,
                    kind: completions.entries[i].kind,
                    pos: changePosition,
                    livePreview: false
                });
            }
            this.showCodeMirrorHint(cm, list);
        };
        IntellisenseHelper.prototype.showFunctionTooltip = function (cm, changePosition) {
            var _this = this;
            $('.tooltip').remove();
            var signatures = this.typeScriptService.getSignature(changePosition);
            if (signatures && signatures.items && signatures.selectedItemIndex >= 0) {
                var signature = signatures.items[signatures.selectedItemIndex];
                var paramsString = signature.parameters
                    .map(function (p) { return _this.joinParts(p.displayParts); })
                    .join(this.joinParts(signature.separatorDisplayParts));
                var signatureString = this.joinParts(signature.prefixDisplayParts) + paramsString + this.joinParts(signature.suffixDisplayParts);
                this.tooltipLastPos = cm.getCursor();
                var cursorCoords = cm.getEditor().cursorCoords(cm.getCursor(), "page");
                var domElement = cm.getEditor().getWrapperElement();
                $(domElement).data('bs.tooltip', false).tooltip({
                    html: true,
                    title: '<div class="tooltip-typeInfo">' + signatureString + '</div>' + '<div class="tooltip-docComment">' + this.joinParts(signature.documentation) + '</div>',
                    trigger: 'manual', container: 'body', placement: 'bottom'
                });
                $(domElement).off('shown.bs.tooltip').on('shown.bs.tooltip', function () {
                    $('.tooltip').css('top', cursorCoords.bottom + "px").css('left', cursorCoords.left + "px");
                });
                $(domElement).tooltip('show');
            }
        };
        IntellisenseHelper.prototype.scriptChanged = function (cm, changeText, changePos) {
            if (changeText == '.') {
                this.showAutoCompleteDropDown(cm, changePos);
            }
            else if (changeText == '(' || changeText == ',') {
                this.showFunctionTooltip(cm, changePos);
            }
            else if (changeText == ')') {
                $('.tooltip').remove();
            }
        };
        return IntellisenseHelper;
    }());
    CSREditor.IntellisenseHelper = IntellisenseHelper;
})(CSREditor || (CSREditor = {}));
var CSREditor;
(function (CSREditor) {
    var NewFileHelper = (function () {
        function NewFileHelper() {
        }
        NewFileHelper.performNewFileCreation = function (filesList, webpart) {
            var _this = this;
            webpart.adding = false;
            webpart.loading = true;
            if (webpart.newFileName.indexOf('.js') == -1)
                webpart.newFileName += '.js';
            CSREditor.ChromeIntegration.evalAndWaitForResult(CSREditor.SPActions.getCode_createFileInSharePoint(filesList.pathRelativeTo + filesList.filesPath.toLowerCase(), webpart.newFileName, webpart.id, webpart.ctxKey), CSREditor.SPActions.getCode_checkFileCreated(), function (result, errorInfo) {
                webpart.loading = false;
                if (errorInfo || result == "error") {
                    alert("There was an error when creating the file. Please check console for details.");
                    if (errorInfo)
                        console.log(errorInfo);
                }
                else if (result == "created") {
                    var fullUrl = ((filesList.pathRelativeTo == '~site' ? filesList.webUrl : filesList.siteUrl) + filesList.filesPath.replace(' ', '%20') + webpart.newFileName).toLowerCase();
                    var file = webpart.appendFileToList(fullUrl, true);
                    var templateText = _this.generateTemplate(webpart, filesList.filesPath);
                    filesList.setEditorText(file.url, templateText, true);
                }
                else if (result == "existing") {
                    var fullUrl = (filesList.siteUrl + filesList.filesPath.replace(' ', '%20') + webpart.newFileName).toLowerCase();
                    webpart.appendFileToList(fullUrl, false);
                }
            });
        };
        NewFileHelper.generateTemplate = function (webpart, filesPath) {
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
            }
            ;
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
                        '      //     Item: function(ctx) { return ""; },\r\n') +
                fieldMarkup +
                (webpart.isListForm ? '' :
                    '      //     Footer: function(ctx) { return ""; }\r\n') +
                '\r\n' +
                '      },\r\n\r\n' +
                '      // OnPostRender: function(ctx) { },\r\n\r\n' +
                '      ListTemplateType: ' + webpart.listTemplateType + '\r\n\r\n' +
                '    });\r\n' +
                '  }\r\n\r\n' +
                '  RegisterModuleInit(SPClientTemplates.Utility.ReplaceUrlTokens("~siteCollection' + filesPath + webpart.newFileName + '"), init);\r\n' +
                '  init();\r\n\r\n' +
                '});\r\n';
        };
        return NewFileHelper;
    }());
    CSREditor.NewFileHelper = NewFileHelper;
})(CSREditor || (CSREditor = {}));
var CSREditor;
(function (CSREditor) {
    var Panel = (function () {
        function Panel() {
            this.fileName = null;
            this.modifiedFilesContent = {};
            this.needSave = false;
        }
        Panel.start = function () {
            var panel = new Panel();
            panel.initialize();
        };
        Panel.prototype.initialize = function () {
            var _this = this;
            this.typeScriptService = new CSREditor.TypeScriptService();
            this.editorCM = this.initEditor();
            this.intellisenseHelper = new CSREditor.IntellisenseHelper(this.typeScriptService, this.editorCM);
            this.filesList = new CSREditor.FilesList(this.loadUrlToEditor.bind(this), this.setEditorText.bind(this));
            this.loadWindowKeys();
            CSREditor.ChromeIntegration.setNavigatedListener(function (pageUrl) {
                CSREditor.ChromeIntegration.waitForResult(CSREditor.SPActions.getCode_checkPageIsLoaded(), function () {
                    _this.setEditorText(null, "");
                    _this.filesList.reload();
                    _this.loadWindowKeys();
                });
            });
        };
        Panel.prototype.loadWindowKeys = function () {
            var _this = this;
            CSREditor.ChromeIntegration.eval("keys(window)", function (result, errorInfo) {
                if (!errorInfo) {
                    var windowTS = '';
                    var completions = _this.typeScriptService.getCompletions(0);
                    var existingSymbols = {};
                    if (completions != null) {
                        for (var i = 0; i < completions.entries.length; i++)
                            existingSymbols[completions.entries[i].name] = 1;
                    }
                    for (var k = 0; k < result.length; k++) {
                        if (typeof existingSymbols[result[k]] == 'undefined' && /^[\$a-zA-Z_][\$a-zA-Z0-9_]+$/.test(result[k]))
                            windowTS += 'var ' + result[k] + ': any;';
                    }
                    _this.typeScriptService.windowChanged(windowTS);
                }
            });
        };
        Panel.prototype.initEditor = function () {
            var _this = this;
            var editor = CodeMirror.fromTextArea(document.getElementById("editor"), {
                lineNumbers: true,
                matchBrackets: true,
                mode: "text/typescript",
                readOnly: true,
                extraKeys: {
                    "Ctrl-K": "toggleComment"
                }
            });
            editor.on("change", function (editor, changeList) { _this.processChanges(editor.getDoc(), changeList); });
            return editor;
        };
        Panel.prototype.loadUrlToEditor = function (url) {
            var _this = this;
            if (url in this.modifiedFilesContent)
                this.setEditorText(url, this.modifiedFilesContent[url]);
            else {
                // clear content and make readonly while loading
                this.setEditorText(null, '');
                CSREditor.ChromeIntegration.evalAndWaitForResult(CSREditor.SPActions.getCode_getFileContent(url), CSREditor.SPActions.getCode_checkFileContentRetrieved(), function (result, errorInfo) {
                    if (errorInfo || result == "error") {
                        _this.setEditorText(null, "");
                        _this.filesList.fileError = "There was an error opening file '" + url + "'.<br/>Check console for details.";
                    }
                    else if (result == "notFound") {
                        var isOtherFile = false;
                        for (var _i = 0, _a = _this.filesList.otherFiles; _i < _a.length; _i++) {
                            var otherFile = _a[_i];
                            if (otherFile.url == url) {
                                isOtherFile = true;
                                break;
                            }
                        }
                        _this.setEditorText(null, "");
                        if (isOtherFile)
                            _this.filesList.fileError = "File is referenced by the page but was not found: " + url;
                        else
                            _this.filesList.fileError = "File '" + url + "' is referenced by JSLink but was not found.<br/>If you want to remove it from JSLink, use delete icon (<i class='fa fa-trash-o'></i>) next to the filename.";
                    }
                    else
                        _this.setEditorText(url, result);
                });
            }
        };
        Panel.prototype.setEditorText = function (url, text, newlyCreated) {
            var _this = this;
            if (newlyCreated === void 0) { newlyCreated = false; }
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
            if (!this.filesList.currentWebPart)
                return;
            CSREditor.ChromeIntegration.eval(CSREditor.SPActions.getCode_retrieveFieldsInfo(this.filesList.currentWebPart.ctxKey), function (result, errorInfo) {
                var fieldNames = [];
                for (var i in result) {
                    var f = result[i].Name;
                    if (_this.filesList.currentWebPart.isListForm && (f == "Attachments" || f == "Created" || f == "Modified" || f == "Author" || f == "Editor" || f == "_UIVersionString"))
                        continue;
                    fieldNames.push(result[i].Name);
                }
                _this.intellisenseHelper.setFieldInternalNames(fieldNames);
            });
        };
        Panel.prototype.processChanges = function (cm, changeObj) {
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
                else if (isHtml) {
                    try {
                        var jsContent = transformer.Transform();
                        this.filesList.refreshCSR(url, jsContent);
                        this.typeScriptService.scriptChanged(jsContent, 0, 0);
                    }
                    catch (e) {
                        console.log(e);
                    }
                }
                if (this.needSave) {
                    this.filesList.saveChangesToFile(url, text);
                    this.modifiedFilesContent[url] = text;
                }
                if (changeObj.text.length == 1)
                    this.intellisenseHelper.scriptChanged(cm, changeObj.text[0], transformer.GetPositionInJs(cm.indexFromPos(changeObj.to) + 1));
                this.checkSyntax(cm, transformer);
            }
        };
        Panel.prototype.checkSyntax = function (cm, transformer) {
            var _this = this;
            var allMarkers = cm.getAllMarks();
            for (var i = 0; i < allMarkers.length; i++) {
                allMarkers[i].clear();
            }
            if (Panel.checkSyntaxTimeout)
                clearTimeout(Panel.checkSyntaxTimeout);
            Panel.checkSyntaxTimeout = setTimeout(function () {
                var errors = _this.typeScriptService.getErrors();
                for (var i = 0; i < errors.length; i++) {
                    var text = "";
                    if (typeof errors[i].messageText == "string")
                        text = errors[i].messageText;
                    else {
                        var chain = errors[i].messageText;
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
        };
        Panel.checkSyntaxTimeout = 0;
        return Panel;
    }());
    CSREditor.Panel = Panel;
})(CSREditor || (CSREditor = {}));
var B64;
var CSREditor;
(function (CSREditor) {
    var SPActions = (function () {
        function SPActions() {
        }
        SPActions.getCode_listCsrWebparts = function () {
            return "(" + SPActions.listCsrWebparts + ")();";
        };
        SPActions.listCsrWebparts = function () {
            var controlModeTitle = { '1': 'DisplayForm', '2': 'EditForm', '3': 'NewForm' };
            var context = SP.ClientContext.get_current();
            var page = context.get_web().getFileByServerRelativeUrl(_spPageContextInfo.serverRequestPath);
            var wpm = page.getLimitedWebPartManager(SP.WebParts.PersonalizationScope.shared);
            var webparts = [];
            var wp_properties = [];
            var wpqId = 1;
            if (GetUrlKeyValue("PageView") == "Personal") {
                window["g_Cisar_JSLinkUrls"] = "personal";
                return { webparts: [], displayTemplates: [] };
            }
            while ($get("MSOZoneCell_WebPartWPQ" + wpqId) != null) {
                var wpId = $get("WebPartWPQ" + wpqId).attributes["webpartid"].value;
                if (window["WPQ" + wpqId + "FormCtx"]) {
                    var ctx = window["WPQ" + wpqId + "FormCtx"];
                    // add fields to context
                    var fields = [];
                    for (var f in ctx.FieldControlModes) {
                        if (f == "Attachments" || f == "Created" || f == "Modified" || f == "Author" || f == "Editor" || f == "_UIVersionString")
                            continue;
                        fields.push(f);
                    }
                    webparts.push({
                        title: 'LFWP ' + controlModeTitle[ctx.FormControlMode] + ': ' + (ctx.ItemAttributes.Url || ctx.NewItemRootFolder),
                        wpqId: wpqId,
                        wpId: wpId,
                        isListForm: true,
                        ctxKey: "WPQ" + wpqId + "FormCtx",
                        listTemplateType: ctx.ListAttributes.ListTemplateType,
                        fields: fields
                    });
                    var webpartDef = wpm.get_webParts().getById(new SP.Guid(wpId));
                    var webpart = webpartDef.get_webPart();
                    var properties = webpart.get_properties();
                    context.load(properties);
                    wp_properties.push({ wpqId: wpqId, properties: properties });
                }
                else if (window["WPQ" + wpqId + "SchemaData"]) {
                    var ctxNumber = window["g_ViewIdToViewCounterMap"][window["WPQ" + wpqId + "SchemaData"].View];
                    var ctx = window["ctx" + ctxNumber];
                    webparts.push({
                        title: 'XLV: ' + ctx.ListTitle,
                        wpqId: wpqId,
                        wpId: wpId,
                        isListForm: false,
                        ctxKey: 'ctx' + ctxNumber,
                        baseViewId: ctx.BaseViewId,
                        listTemplateType: ctx.ListTemplateType
                    });
                    var webpartDef = wpm.get_webParts().getById(new SP.Guid(wpId));
                    var webpart = webpartDef.get_webPart();
                    var properties = webpart.get_properties();
                    context.load(properties);
                    wp_properties.push({ wpqId: wpqId, properties: properties });
                }
                wpqId++;
            }
            delete window["g_Cisar_JSLinkUrls"];
            if (webparts.length > 0) {
                context.executeQueryAsync(function () {
                    var urls = {};
                    for (var i = 0; i < wp_properties.length; i++) {
                        var urlsString = wp_properties[i].properties.get_item('JSLink') || '';
                        if (urlsString != '') {
                            var urlsArray = urlsString.split('|');
                            for (var x = 0; x < urlsArray.length; x++) {
                                urlsArray[x] = SPClientTemplates.Utility.ReplaceUrlTokens(urlsArray[x]);
                            }
                            urls[wp_properties[i].wpqId] = urlsArray;
                        }
                    }
                    window["g_Cisar_JSLinkUrls"] = urls;
                }, function (s, args) {
                    console.log('Error when retrieving properties for the CSR webparts on the page: ' + args.get_message());
                    console.log(webparts);
                    window["g_Cisar_JSLinkUrls"] = 'error';
                });
            }
            else {
                window["g_Cisar_JSLinkUrls"] = {};
            }
            var displayTemplateFuncs = Object.keys(window).filter(function (k) { return k.indexOf('DisplayTemplate_') == 0; });
            displayTemplateFuncs.filter(function (k) { return window[k].DisplayTemplateData == null; }).forEach(function (k) {
                try {
                    window[k]({});
                }
                finally { }
            });
            var displayTemplates = displayTemplateFuncs.filter(function (k) { return window[k].DisplayTemplateData; }).map(function (k) {
                return {
                    uniqueId: k.substr("DisplayTemplate_".length),
                    info: window[k].DisplayTemplateData
                };
            });
            return {
                webparts: webparts,
                displayTemplates: displayTemplates
            };
        };
        SPActions.getCode_checkJSLinkInfoRetrieved = function () {
            return "(" + SPActions.checkJSLinkInfoRetrieved + ")();";
        };
        SPActions.checkJSLinkInfoRetrieved = function () {
            if (window["g_Cisar_JSLinkUrls"]) {
                var result = window["g_Cisar_JSLinkUrls"];
                delete window["g_Cisar_JSLinkUrls"];
                return result;
            }
            else
                return "wait";
        };
        SPActions.getCode_retrieveFieldsInfo = function (ctxKey) {
            return "(" + SPActions.retrieveFieldsInfo + ")('" + ctxKey + "');";
        };
        SPActions.retrieveFieldsInfo = function (ctxKey) {
            return window[ctxKey]["ListSchema"].Field || window[ctxKey]["ListSchema"];
        };
        SPActions.getCode_createFileInSharePoint = function (path, fileName, wpId, ctxKey) {
            return "(" + SPActions.createFileInSharePoint + ")('" + path + "', '" + fileName + "', '" + wpId + "', '" + ctxKey + "');";
        };
        SPActions.createFileInSharePoint = function (path, fileName, wpId, ctxKey) {
            path = path.replace('%20', ' ');
            var fullPath = path.replace('~sitecollection/', (_spPageContextInfo.siteServerRelativeUrl + '/').replace('//', '/'));
            fullPath = fullPath.replace('~site/', (_spPageContextInfo.webServerRelativeUrl + '/').replace('//', '/'));
            SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function () {
                var context = SP.ClientContext.get_current();
                var files;
                if (path.indexOf('~site/') == 0)
                    files = context.get_web().getFolderByServerRelativeUrl(fullPath).get_files();
                else
                    files = context.get_site().get_rootWeb().getFolderByServerRelativeUrl(fullPath).get_files();
                context.load(files, "Include(Name)");
                var page = context.get_web().getFileByServerRelativeUrl(_spPageContextInfo.serverRequestPath);
                var wpm = page.getLimitedWebPartManager(SP.WebParts.PersonalizationScope.shared);
                var webpartDef = wpm.get_webParts().getById(new SP.Guid(wpId));
                var webpart = webpartDef.get_webPart();
                var properties = webpart.get_properties();
                context.load(properties);
                var setupJsLink = function (properties) {
                    var jsLinkString = (properties.get_item("JSLink") || "") + "|" + path + fileName;
                    if (jsLinkString[0] == '|')
                        jsLinkString = jsLinkString.substr(1);
                    properties.set_item("JSLink", jsLinkString);
                    webpartDef.saveWebPartChanges();
                };
                var fatalError = function (sender, args) {
                    console.log('Cisar fatal error when creating file ' + fileName + ' at ' + fullPath + ': ' + args.get_message());
                    window["g_Cisar_fileCreationResult"] = "error";
                };
                context.executeQueryAsync(function () {
                    var enumerator = files.getEnumerator();
                    var fileExists = false;
                    while (enumerator.moveNext() && !fileExists) {
                        if (enumerator.get_current().get_name().toLowerCase() == fileName.toLowerCase())
                            fileExists = true;
                    }
                    if (fileExists) {
                        var script = document.createElement("script");
                        script.src = fullPath + fileName;
                        script.type = "text/javascript";
                        document.head.appendChild(script);
                        setupJsLink(properties);
                        context.executeQueryAsync(function () {
                            window["g_Cisar_fileCreationResult"] = "existing";
                            console.log('CSREditor: existing file has been successfully linked to the webpart.');
                        }, fatalError);
                    }
                    else {
                        var creationInfo = new SP.FileCreationInformation();
                        creationInfo.set_content(new SP.Base64EncodedByteArray());
                        creationInfo.set_url(fileName);
                        var file = files.add(creationInfo);
                        context.load(file, 'CheckOutType');
                        setupJsLink(properties);
                        context.executeQueryAsync(function () {
                            console.log('Cisar: file has been created successfully.');
                            window["g_Cisar_fileCreationResult"] = "created";
                            if (file.get_checkOutType() != SP.CheckOutType.none) {
                                file.checkIn("Checked in by Cisar", SP.CheckinType.minorCheckIn);
                                context.executeQueryAsync(function () {
                                    console.log('Cisar: file has been checked in successfully.');
                                }, fatalError);
                            }
                        }, fatalError);
                    }
                }, fatalError);
            });
        };
        SPActions.getCode_checkFileCreated = function () {
            return "(" + SPActions.checkFileCreated + ")();";
        };
        SPActions.checkFileCreated = function () {
            if (window["g_Cisar_fileCreationResult"]) {
                var result = window["g_Cisar_fileCreationResult"];
                delete window["g_Cisar_fileCreationResult"];
                return result;
            }
            else
                return "wait";
        };
        SPActions.getCode_performCSRRefresh = function (url, content) {
            return "(" + SPActions.performCSRRefresh + ")('" + url + "', '" + content + "');";
        };
        SPActions.performCSRRefresh = function (url, content) {
            var extend = function (dest, source) {
                for (var p in source) {
                    if (source[p] && source[p].constructor && source[p].constructor === Object) {
                        dest[p] = dest[p] || {};
                        arguments.callee(dest[p], source[p]);
                    }
                    else {
                        dest[p] = source[p];
                    }
                }
                return dest;
            };
            var substract_objects = function (obj1, obj2) {
                for (var p in obj2) {
                    if (Object.prototype.toString.call(obj2[p]) == "[object Array]" && p in obj1)
                        obj1[p] = [];
                    else if (typeof (obj2[p]) == "function" && p in obj1)
                        delete obj1[p];
                    else if (typeof (obj2[p]) == "object" && p in obj1)
                        substract_objects(obj1[p], obj2[p]);
                }
            };
            var fileName = url.substr(url.lastIndexOf('/') + 1);
            if (window["g_templateOverrides_" + fileName])
                substract_objects(SPClientTemplates.TemplateManager["_TemplateOverrides"], window["g_templateOverrides_" + fileName]);
            var savedRegisterOverridesMethod = SPClientTemplates.TemplateManager.RegisterTemplateOverrides;
            SPClientTemplates.TemplateManager.RegisterTemplateOverrides = function (options) {
                SPClientTemplates.TemplateManager.RegisterTemplateOverrides = savedRegisterOverridesMethod;
                var savedTemplateOverrides = {};
                extend(savedTemplateOverrides, SPClientTemplates.TemplateManager["_TemplateOverrides"]);
                for (var p in SPClientTemplates.TemplateManager["_TemplateOverrides"])
                    SPClientTemplates.TemplateManager["_TemplateOverrides"][p] = {};
                savedRegisterOverridesMethod(options);
                window["g_templateOverrides_" + fileName] = {};
                extend(window["g_templateOverrides_" + fileName], SPClientTemplates.TemplateManager["_TemplateOverrides"]);
                substract_objects(savedTemplateOverrides, { OnPreRender: window["g_templateOverrides_" + fileName].OnPreRender, OnPostRender: window["g_templateOverrides_" + fileName].OnPostRender });
                SPClientTemplates.TemplateManager["_TemplateOverrides"] = savedTemplateOverrides;
                savedRegisterOverridesMethod(options);
                var wpqId = 1;
                while ($get("WebPartWPQ" + wpqId) != null) {
                    var wpId = $get("WebPartWPQ" + wpqId).attributes["webpartid"].value;
                    if (window["WPQ" + wpqId + "FormCtx"]) {
                        var ctx = window["WPQ" + wpqId + "FormCtx"];
                        var i = 0;
                        var rows = document.querySelectorAll("#WebPartWPQ" + wpqId + " .ms-formtable tr .ms-formbody");
                        for (var f in ctx.ListSchema) {
                            if (f == "Attachments" || f == "Created" || f == "Modified" || f == "Author" || f == "Editor" || f == "_UIVersionString")
                                continue;
                            var nodesToReplace = [];
                            for (var n = 0; n < rows[i].childNodes.length; n++)
                                if (rows[i].childNodes[n].nodeType != 8)
                                    nodesToReplace.push(rows[i].childNodes[n]);
                            var span = document.createElement("span");
                            span.id = "WPQ" + wpqId + ctx.ListAttributes.Id + f;
                            rows[i].appendChild(span);
                            for (var n = 0; n < nodesToReplace.length; n++)
                                span.appendChild(nodesToReplace[n]);
                            i++;
                        }
                        window["SPClientForms"].ClientFormManager.GetClientForm("WPQ" + wpqId).RenderClientForm();
                    }
                    else if (window["WPQ" + wpqId + "SchemaData"]) {
                        var ctxNumber = window["g_ViewIdToViewCounterMap"][window["WPQ" + wpqId + "SchemaData"].View];
                        var ctx = window["ctx" + ctxNumber];
                        for (var f in ctx.ListSchema.Field)
                            delete ctx.ListSchema.Field[f].fieldRenderer;
                        ctx.DebugMode = true;
                        if (ctx.inGridMode) {
                            var searchDiv = $get("inplaceSearchDiv_WPQ" + wpqId);
                            searchDiv.parentNode.removeChild(searchDiv);
                            var gridInitInfo = window["g_SPGridInitInfo"][ctx.view];
                            gridInitInfo.initialized = false;
                            window["InitGrid"](gridInitInfo, ctx, false);
                        }
                        else
                            window["RenderListView"](ctx, ctx.wpq);
                    }
                    wpqId++;
                }
            };
            if (window["ko"] && content.toLowerCase().indexOf("ko.applybindings") > -1) {
                window["ko"].cleanNode(document.body);
            }
            if ($get('csrErrorDiv') != null)
                document.body.removeChild($get('csrErrorDiv'));
            if ($get('csrErrorDivText') != null)
                document.body.removeChild($get('csrErrorDivText'));
            try {
                eval(content);
                var elements = document.querySelectorAll("div[webpartid] > [componentid$='_csr']");
                for (var i = 0; i < elements.length; i++) {
                    var control = Srch.U.getClientComponent(elements[i]);
                    if (control && control.render) {
                        while (elements[i].hasChildNodes())
                            elements[i].removeChild(elements[i].childNodes[0]);
                        control.get_currentResultTableCollection().ResultTables[0].ResultRows.forEach(function (r) { return delete r.id; });
                        control.render();
                    }
                }
            }
            catch (err) {
                console.log("Error when evaluating the CSR template code!");
                console.log(err);
                var div = document.createElement('div');
                div.id = "csrErrorDiv";
                div.style.backgroundColor = "#300";
                div.style.opacity = "0.5";
                div.style.position = "fixed";
                div.style.top = "0";
                div.style.left = "0";
                div.style.bottom = "0";
                div.style.right = "0";
                div.style.zIndex = "101";
                document.body.appendChild(div);
                var textDiv = document.createElement('div');
                textDiv.id = "csrErrorDivText";
                textDiv.style.position = "fixed";
                textDiv.style.backgroundColor = "#fff";
                textDiv.style.border = "2px solid #000";
                textDiv.style.padding = "10px 15px";
                textDiv.style.width = "300px";
                textDiv.style.top = "200px";
                textDiv.style.left = "0";
                textDiv.style.right = "0";
                textDiv.style.margin = "0 auto";
                textDiv.style.zIndex = "102";
                textDiv.innerHTML = "Error when evaluating the CSR template code: " + err["message"];
                document.body.appendChild(textDiv);
            }
            finally {
                SPClientTemplates.TemplateManager.RegisterTemplateOverrides = savedRegisterOverridesMethod;
            }
        };
        SPActions.getCode_saveFileToSharePoint = function (url, content64) {
            return "(" + SPActions.saveFileToSharePoint + ")('" + url + "', '" + content64 + "');";
        };
        SPActions.saveFileToSharePoint = function (url, content64) {
            var path = url.substr(0, url.lastIndexOf('/'));
            var fileName = url.substr(url.lastIndexOf('/') + 1);
            SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function () {
                var context = SP.ClientContext.get_current();
                var saveInfo = new SP.FileSaveBinaryInformation();
                saveInfo.set_content(new SP.Base64EncodedByteArray(content64));
                var files;
                if (path.indexOf(_spPageContextInfo.webServerRelativeUrl) == 0)
                    files = context.get_web().getFolderByServerRelativeUrl(path).get_files();
                else
                    files = context.get_site().get_rootWeb().getFolderByServerRelativeUrl(path).get_files();
                var file = files.getByUrl(fileName);
                file.checkOut();
                file.saveBinary(saveInfo);
                file.checkIn("Checked in by Cisar", SP.CheckinType.minorCheckIn);
                context.executeQueryAsync(function () {
                    console.log('Cisar: file saved successfully.');
                    window["g_Cisar_fileSavingResult"] = "saved";
                }, function (sender, args) {
                    console.log('Cisar fatal error when saving file ' + fileName + ' to path "' + path + '": ' + args.get_message());
                    window["g_Cisar_fileSavingResult"] = "error";
                });
            });
        };
        SPActions.getCode_checkFileSaved = function () {
            return "(" + SPActions.checkFileSaved + ")();";
        };
        SPActions.checkFileSaved = function () {
            if (window["g_Cisar_fileSavingResult"]) {
                var result = window["g_Cisar_fileSavingResult"];
                delete window["g_Cisar_fileSavingResult"];
                return result;
            }
            else
                return "wait";
        };
        SPActions.getCode_publishFileToSharePoint = function (url) {
            return "(" + SPActions.publishFileToSharePoint + ")('" + url + "');";
        };
        SPActions.publishFileToSharePoint = function (url) {
            var path = url.substr(0, url.lastIndexOf('/'));
            var fileName = url.substr(url.lastIndexOf('/') + 1);
            SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function () {
                var context = SP.ClientContext.get_current();
                var files;
                if (path.indexOf(_spPageContextInfo.webServerRelativeUrl) == 0)
                    files = context.get_web().getFolderByServerRelativeUrl(path).get_files();
                else
                    files = context.get_site().get_rootWeb().getFolderByServerRelativeUrl(path).get_files();
                var file = files.getByUrl(fileName);
                context.load(file, 'Level', 'CheckOutType');
                context.executeQueryAsync(function () {
                    if (file.get_level() == SP.FileLevel.draft) {
                        file.publish("Published by Cisar");
                        context.executeQueryAsync(function () {
                            console.log('Cisar: file has been published successfully.');
                        }, function (sender, args) {
                            console.log('Cisar fatal error when publishing file ' + fileName + ': ' + args.get_message());
                        });
                    }
                    else
                        console.log('Cisar: file does not need to be published. file.get_level()=' + file.get_level());
                }, function (sender, args) {
                    console.log('Cisar fatal error when publishing file ' + fileName + ' to path "' + path + '": ' + args.get_message());
                });
            });
        };
        SPActions.getCode_getJSLink = function (wpId) {
            return "(" + SPActions.getJSLink + ")('" + wpId + "');";
        };
        SPActions.getJSLink = function (wpId) {
            delete window["g_Cisar_JSLink"];
            SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function () {
                var context = SP.ClientContext.get_current();
                var page = context.get_web().getFileByServerRelativeUrl(_spPageContextInfo.serverRequestPath);
                var wpm = page.getLimitedWebPartManager(SP.WebParts.PersonalizationScope.shared);
                var webpartDef = wpm.get_webParts().getById(new SP.Guid(wpId));
                var webpart = webpartDef.get_webPart();
                var properties = webpart.get_properties();
                context.load(properties);
                context.executeQueryAsync(function () {
                    window["g_Cisar_JSLink"] = properties.get_item("JSLink").toLowerCase();
                }, function () {
                    window["g_Cisar_JSLink"] = 'error';
                });
            });
        };
        SPActions.getCode_checkJSLinkRetrieved = function () {
            return "(" + SPActions.checkJSLinkRetrieved + ")();";
        };
        SPActions.checkJSLinkRetrieved = function () {
            if (window["g_Cisar_JSLink"]) {
                var result = window["g_Cisar_JSLink"];
                delete window["g_Cisar_JSLink"];
                return result;
            }
            else
                return "wait";
        };
        SPActions.getCode_setJSLink = function (wpId, value) {
            return "(" + SPActions.setJSLink + ")('" + wpId + "','" + value + "');";
        };
        SPActions.setJSLink = function (wpId, value) {
            delete window["g_Cisar_JSLinkSaveResult"];
            SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function () {
                var context = SP.ClientContext.get_current();
                var page = context.get_web().getFileByServerRelativeUrl(_spPageContextInfo.serverRequestPath);
                var wpm = page.getLimitedWebPartManager(SP.WebParts.PersonalizationScope.shared);
                var webpartDef = wpm.get_webParts().getById(new SP.Guid(wpId));
                var webpart = webpartDef.get_webPart();
                webpart.get_properties().set_item("JSLink", value);
                webpartDef.saveWebPartChanges();
                context.executeQueryAsync(function () {
                    window["g_Cisar_JSLinkSaveResult"] = 'success';
                }, function (sender, args) {
                    window["g_Cisar_JSLinkSaveResult"] = 'error';
                    console.log('Error when saving JSLink: ' + args.get_message());
                });
            });
        };
        SPActions.getCode_checkJSLinkSaved = function () {
            return "(" + SPActions.checkJSLinkSaved + ")();";
        };
        SPActions.checkJSLinkSaved = function () {
            if (window["g_Cisar_JSLinkSaveResult"]) {
                var result = window["g_Cisar_JSLinkSaveResult"];
                delete window["g_Cisar_JSLinkSaveResult"];
                return result;
            }
            else
                return "wait";
        };
        SPActions.getCode_removeFileFromSharePoint = function (url, wpId) {
            return "(" + SPActions.removeFileFromSharePoint + ")('" + url + "', '" + wpId + "');";
        };
        SPActions.removeFileFromSharePoint = function (url, wpId) {
            var path = url.substr(0, url.lastIndexOf('/'));
            var fileName = url.substr(url.lastIndexOf('/') + 1);
            SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function () {
                var context = SP.ClientContext.get_current();
                var fileWeb;
                if (path.indexOf(_spPageContextInfo.webServerRelativeUrl) == 0)
                    fileWeb = context.get_web();
                else
                    fileWeb = context.get_site().get_rootWeb();
                fileWeb.getFileByServerRelativeUrl(url).recycle();
                var page = context.get_web().getFileByServerRelativeUrl(_spPageContextInfo.serverRequestPath);
                var wpm = page.getLimitedWebPartManager(SP.WebParts.PersonalizationScope.shared);
                var webpartDef = wpm.get_webParts().getById(new SP.Guid(wpId));
                var webpart = webpartDef.get_webPart();
                var properties = webpart.get_properties();
                context.load(properties);
                context.executeQueryAsync(function () {
                    var oldJsLinkString = properties.get_item("JSLink").toLowerCase();
                    var toCheck = [];
                    if (path.indexOf(_spPageContextInfo.webServerRelativeUrl) == 0) {
                        toCheck.push(['~site', _spPageContextInfo.webServerRelativeUrl]);
                        if (_spPageContextInfo.webServerRelativeUrl == _spPageContextInfo.siteServerRelativeUrl)
                            toCheck.push(['~sitecollection', _spPageContextInfo.siteServerRelativeUrl]);
                    }
                    else
                        toCheck.push(['~sitecollection', _spPageContextInfo.siteServerRelativeUrl]);
                    var jsLinkString = ("|" + oldJsLinkString + "|");
                    for (var _i = 0, toCheck_1 = toCheck; _i < toCheck_1.length; _i++) {
                        var info = toCheck_1[_i];
                        var urlToCheck;
                        if (info[1] == '/')
                            urlToCheck = info[0] + url;
                        else
                            urlToCheck = url.replace(info[1], info[0]);
                        jsLinkString = jsLinkString
                            .replace("|" + urlToCheck + "|", "|")
                            .replace("|" + urlToCheck.replace('%20', ' ') + "|", "|");
                    }
                    jsLinkString = jsLinkString.slice(0, -1);
                    if (jsLinkString.length > 0 && jsLinkString[0] == '|')
                        jsLinkString = jsLinkString.substring(1);
                    if (jsLinkString == oldJsLinkString) {
                        console.log('Cisar: ERROR, cannot remove ' + url + ' from ' + jsLinkString + '. Please edit page and remove this file manually.');
                        return;
                    }
                    properties.set_item("JSLink", jsLinkString);
                    webpartDef.saveWebPartChanges();
                    context.executeQueryAsync(function () {
                        console.log('Cisar: file ' + fileName + ' was successfully moved to recycle bin and removed from the XLV/LFWP.');
                    }, function (sender, args) {
                        console.log('Cisar error when unlinking file ' + fileName + ' from the XLV/LFWP: ' + args.get_message());
                    });
                }, function (sender, args) {
                    console.log('Cisar fatal error when recycling file ' + fileName + ': ' + args.get_message());
                });
            });
        };
        SPActions.getCode_getFileContent = function (url) {
            return "(" + SPActions.getFileContent + ")('" + url + "');";
        };
        SPActions.getFileContent = function (url) {
            delete window["g_Cisar_FileContents"];
            var domainPart = _spPageContextInfo.siteAbsoluteUrl;
            if (_spPageContextInfo.siteServerRelativeUrl != '/')
                domainPart = _spPageContextInfo.siteAbsoluteUrl.replace(_spPageContextInfo.siteServerRelativeUrl, '');
            var r = new Sys.Net.WebRequest();
            r.set_url(domainPart + url + "?" + Date.now());
            r.set_httpVerb("GET");
            r.add_completed(function (executor, args) {
                if (executor.get_responseAvailable()) {
                    if (executor.get_statusCode() == "404")
                        window["g_Cisar_FileContents"] = "notFound";
                    else
                        window["g_Cisar_FileContents"] = executor.get_responseData();
                }
                else {
                    if (executor.get_timedOut() || executor.get_aborted())
                        window["g_Cisar_FileContents"] = "error";
                }
            });
            r.invoke();
        };
        SPActions.getCode_checkFileContentRetrieved = function () {
            return "(" + SPActions.checkFileContentRetrieved + ")();";
        };
        SPActions.checkFileContentRetrieved = function () {
            if (window["g_Cisar_FileContents"]) {
                var result = window["g_Cisar_FileContents"];
                delete window["g_Cisar_FileContents"];
                return result;
            }
            else
                return "wait";
        };
        SPActions.getCode_checkPageIsLoaded = function () {
            return "(" + SPActions.checkPageIsLoaded + ")();";
        };
        SPActions.checkPageIsLoaded = function () {
            if (window["SP"] && window["_spPageContextInfo"] && window["SP"]["ClientContext"]) {
                return "loaded";
            }
            else
                return "wait";
        };
        return SPActions;
    }());
    CSREditor.SPActions = SPActions;
})(CSREditor || (CSREditor = {}));
var CSREditor;
(function (CSREditor) {
    var TypeScriptServiceHost = (function () {
        function TypeScriptServiceHost(libText) {
            this.scriptVersion = {};
            this.libText = "";
            this.libTextLength = 0;
            this.text = {};
            this.changes = {};
            this.libText = libText;
            this.libTextLength = libText.length;
            this.scriptVersion['csr-editor.ts'] = 0;
            this.text['csr-editor.ts'] = '';
            this.changes['csr-editor.ts'] = [];
            this.scriptVersion['live.ts'] = 0;
            this.text['live.ts'] = '';
            this.changes['live.ts'] = [];
        }
        TypeScriptServiceHost.prototype.log = function (message) { console.log("tsHost: " + message); };
        TypeScriptServiceHost.prototype.getCompilationSettings = function () { return { removeComments: true, target: 1 /* ES5 */ }; };
        TypeScriptServiceHost.prototype.getScriptFileNames = function () { return ["libs.ts", "live.ts", "csr-editor.ts"]; };
        TypeScriptServiceHost.prototype.getScriptVersion = function (fn) { return (this.scriptVersion[fn] || 0).toString(); };
        TypeScriptServiceHost.prototype.getScriptSnapshot = function (fn) {
            var snapshot, snapshotChanges, snapshotVersion;
            if (fn == 'libs.ts')
                return ts.ScriptSnapshot.fromString(this.libText);
            else
                return ts.ScriptSnapshot.fromString(this.text[fn]);
        };
        TypeScriptServiceHost.prototype.getCurrentDirectory = function () { return ""; };
        TypeScriptServiceHost.prototype.getDefaultLibFileName = function () { return "libs.ts"; };
        TypeScriptServiceHost.prototype.scriptChanged = function (fn, newText, startPos, changeLength) {
            if (startPos === void 0) { startPos = 0; }
            if (changeLength === void 0) { changeLength = 0; }
            this.scriptVersion[fn]++;
            this.text[fn] = newText;
            if (startPos > 0 || changeLength > 0)
                this.changes[fn].push(ts.createTextChangeRange(ts.createTextSpan(startPos, changeLength), newText.length));
        };
        return TypeScriptServiceHost;
    }());
    var TypeScriptService = (function () {
        function TypeScriptService() {
            var self = this;
            var client = new XMLHttpRequest();
            client.open('GET', 'Scripts/typings/libs.d.ts');
            client.onreadystatechange = function () {
                if (client.readyState != 4)
                    return;
                self.tsHost = new TypeScriptServiceHost(client.responseText);
                self.tsService = ts.createLanguageService(self.tsHost, ts.createDocumentRegistry());
            };
            client.send();
        }
        TypeScriptService.prototype.scriptChanged = function (newText, startPos, changeLength) {
            this.tsHost.scriptChanged('csr-editor.ts', newText, startPos, changeLength);
        };
        TypeScriptService.prototype.windowChanged = function (newText) {
            this.tsHost.scriptChanged('live.ts', newText);
        };
        TypeScriptService.prototype.getSymbolInfo = function (position) {
            return this.tsService.getEncodedSemanticClassifications('csr-editor.ts', position);
        };
        TypeScriptService.prototype.getCompletions = function (position) {
            return this.tsService.getCompletionsAtPosition('csr-editor.ts', position);
        };
        TypeScriptService.prototype.getCompletionDetails = function (position, name) {
            return this.tsService.getCompletionEntryDetails('csr-editor.ts', position, name);
        };
        TypeScriptService.prototype.getSignature = function (position) {
            return this.tsService.getSignatureHelpItems('csr-editor.ts', position);
        };
        TypeScriptService.prototype.getErrors = function () {
            var syntastic = this.tsService.getSyntacticDiagnostics('csr-editor.ts');
            var semantic = this.tsService.getSemanticDiagnostics('csr-editor.ts');
            return syntastic.concat(semantic);
        };
        TypeScriptService.prototype.getJs = function () {
            return this.tsService.getEmitOutput('csr-editor.ts').outputFiles[0].text;
        };
        return TypeScriptService;
    }());
    CSREditor.TypeScriptService = TypeScriptService;
})(CSREditor || (CSREditor = {}));
var CSREditor;
(function (CSREditor) {
    var Utils = (function () {
        function Utils() {
        }
        Utils.endsWith = function (s, suffix) {
            return s.indexOf(suffix, s.length - suffix.length) !== -1;
        };
        Utils.cutOffQueryString = function (s) {
            if (s.indexOf('?') > 0)
                s = s.substr(0, s.indexOf('?'));
            return s;
        };
        Utils.toRelative = function (url, baseUrl) {
            url = url.toLowerCase().replace(baseUrl.toLowerCase(), '');
            url = Utils.cutOffQueryString(url.replace(' ', '%20'));
            if (url[0] != '/')
                url = '/' + url;
            return url;
        };
        Utils.safeEnterFileName = function (event, value, okCallback, cancelCallback) {
            return Utils.safeEnterValue(event, value, okCallback, cancelCallback, false);
        };
        Utils.safeEnterPath = function (event, value, okCallback, cancelCallback) {
            return Utils.safeEnterValue(event, value, okCallback, cancelCallback, true);
        };
        Utils.safeEnterValue = function (event, value, okCallback, cancelCallback, isPath) {
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
                if ([191, 32].indexOf(event.keyCode) > -1 && isPath)
                    safe = true;
                if (!safe) {
                    event.preventDefault();
                    event.stopPropagation();
                    return false;
                }
            }
            return true;
        };
        return Utils;
    }());
    CSREditor.Utils = Utils;
})(CSREditor || (CSREditor = {}));
var CSREditor;
(function (CSREditor) {
    var WebPartModel = (function () {
        function WebPartModel(root, info) {
            this.files = [];
            this.adding = false;
            this.loading = false;
            this.newFileName = '';
            this.jsLink = '';
            this.editJSLinkMode = false;
            this.fileFlags = {};
            this.root = root;
            this.title = info.title;
            this.id = info.wpId;
            this.wpq = info.wpqId;
            this.isListForm = info.isListForm;
            this.ctxKey = info.ctxKey;
            this.listTemplateType = info.listTemplateType;
            this.fields = info.fields;
            ko.track(this);
        }
        WebPartModel.prototype.appendFileToList = function (url, justcreated) {
            if (justcreated === void 0) { justcreated = false; }
            if (!this.fileFlags[url]) {
                var file = new CSREditor.FileModel(this, this.root, url);
                file.justCreated = justcreated;
                this.files.push(file);
                if (justcreated) {
                    if (this.root.currentFile)
                        this.root.currentFile.current = false;
                    this.root.currentFile = file;
                    this.root.currentWebPart = this;
                    file.current = true;
                }
                this.fileFlags[url] = 1;
                return file;
            }
            else
                return null;
        };
        WebPartModel.prototype.displayAddNewFileUI = function (data) {
            this.newFileName = '';
            this.adding = true;
        };
        WebPartModel.prototype.displayChangePathDialog = function (data) {
            this.root.filesPathEntered = this.root.filesPath;
            this.root.pathRelativeToEntered = this.root.pathRelativeTo;
            this.root.changePathDialogShown = true;
        };
        WebPartModel.prototype.displayEditJSLinkUI = function (data) {
            var _this = this;
            for (var _i = 0, _a = this.files; _i < _a.length; _i++) {
                var f = _a[_i];
                if (f.current) {
                    f.current = false;
                    this.root.currentFile = null;
                    this.root.currentWebPart = null;
                    this.root.setEditorText(null, '');
                    break;
                }
            }
            this.loading = true;
            CSREditor.ChromeIntegration.evalAndWaitForResult(CSREditor.SPActions.getCode_getJSLink(this.id), CSREditor.SPActions.getCode_checkJSLinkRetrieved(), function (result, errorInfo) {
                _this.loading = false;
                if (errorInfo)
                    console.log(errorInfo);
                if (errorInfo || result == 'error') {
                    alert('Error occured when fetching the JSLink data.');
                    return;
                }
                _this.jsLink = result;
                _this.editJSLinkMode = true;
            });
        };
        WebPartModel.prototype.saveJSLink = function () {
            var _this = this;
            this.editJSLinkMode = false;
            this.loading = true;
            CSREditor.ChromeIntegration.evalAndWaitForResult(CSREditor.SPActions.getCode_setJSLink(this.id, this.jsLink), CSREditor.SPActions.getCode_checkJSLinkSaved(), function (result, errorInfo) {
                _this.loading = false;
                if (errorInfo)
                    console.log(errorInfo);
                if (errorInfo || result == 'error') {
                    alert('Error occured when saving the JSLink data! Check console for details.');
                    return;
                }
                _this.root.reload();
            });
        };
        WebPartModel.prototype.cancelJSLinkEdit = function () {
            this.editJSLinkMode = false;
        };
        WebPartModel.prototype.fileNameInputKeyDown = function (data, event) {
            var _this = this;
            return CSREditor.Utils.safeEnterFileName(event, this.newFileName, function () { CSREditor.NewFileHelper.performNewFileCreation(_this.root, _this); }, function () { _this.adding = false; });
        };
        return WebPartModel;
    }());
    CSREditor.WebPartModel = WebPartModel;
})(CSREditor || (CSREditor = {}));
