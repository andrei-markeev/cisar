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
                            callback(content || "");
                        });
                        return;
                    }
                }
                callback("");
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
        ChromeIntegration.executeInContentScriptContext = function (code) {
            if (!window["chrome"] || !chrome.tabs)
                return false;
            chrome.tabs.executeScript({
                code: code
            });
            return true;
        };
        return ChromeIntegration;
    })();
    CSREditor.ChromeIntegration = ChromeIntegration;
})(CSREditor || (CSREditor = {}));
var CSREditor;
(function (CSREditor) {
    var FileModel = (function () {
        function FileModel(root) {
            this.url = '';
            this.shortUrl = '';
            this.justCreated = false;
            this.published = false;
            this.current = false;
            this.root = root;
            ko.track(this);
        }
        FileModel.prototype.makeFileCurrent = function () {
            if (this.root.currentFile)
                this.root.currentFile.current = false;
            this.current = true;
            this.root.currentFile = this;
            this.root.loadFileToEditor(this.url);
        };
        FileModel.prototype.publishFile = function () {
            CSREditor.ChromeIntegration.eval(CSREditor.SPActions.getCode_publishFileToSharePoint(this.url));
            this.published = true;
        };
        FileModel.prototype.removeFile = function () {
            if (confirm('Sure to move the file to recycle bin and unbind it from the webpart?')) {
                var url = this.url;
                url = CSREditor.Utils.cutOffQueryString(url.replace(this.root.siteUrl, '').replace(' ', '%20').toLowerCase());
                if (url[0] != '/')
                    url = '/' + url;
                this.root.setEditorText(null, '');
                CSREditor.ChromeIntegration.eval(CSREditor.SPActions.getCode_removeFileFromSharePoint(url));
                this.root.currentWebPart.files.remove(this);
            }
        };
        return FileModel;
    })();
    CSREditor.FileModel = FileModel;
})(CSREditor || (CSREditor = {}));
var B64;
var CSREditor;
(function (CSREditor) {
    var FilesList = (function () {
        function FilesList(loadUrlToEditor, setEditorText) {
            var _this = this;
            this.siteUrl = "";
            this.savingQueue = {};
            this.savingProcess = null;
            this.loadFileToEditor = loadUrlToEditor;
            this.setEditorText = setEditorText;
            CSREditor.ChromeIntegration.eval(CSREditor.SPActions.getCode_listCsrWebparts(), function (result, errorInfo) {
                if (errorInfo) {
                    console.log(errorInfo);
                    return;
                }
                for (var i = 0; i < result.length; i++) {
                    var wp = new CSREditor.WebPartModel(_this, result[i].title, result[i].wpId, result[i].wpqId, result.isListForm);
                    _this.webparts.push(wp);
                }
                if (_this.webparts.length > 0)
                    _this.currentWebPart = _this.webparts[0];
                ko.track(_this);
                ko.applyBindings(_this);
            });
            this.webparts = [];
        }
        Object.defineProperty(FilesList.prototype, "filesPath", {
            get: function () {
                return localStorage['filesPath'] || "/Style Library/";
            },
            set: function (value) {
                localStorage['filesPath'] = value;
            },
            enumerable: true,
            configurable: true
        });
        FilesList.prototype.addFiles = function (urls) {
            for (var url in urls) {
                this.currentWebPart.appendFileToList(url);
            }
            document.querySelector('.separator').onclick = function (ev) {
                if (document.body.className.indexOf("fullscreen") > -1)
                    document.body.className = document.body.className.replace("fullscreen", "");
                else
                    document.body.className += " fullscreen";
            };
        };
        FilesList.prototype.refreshCSR = function (url, content) {
            for (var i = 0; i < this.currentWebPart.files.length; i++) {
                if (this.currentWebPart.files[i].url == url)
                    this.currentWebPart.files[i].published = false;
            }
            url = CSREditor.Utils.cutOffQueryString(url.replace(this.siteUrl, '').replace(' ', '%20').toLowerCase());
            if (url[0] != '/')
                url = '/' + url;
            content = content.replace(/\/\*.+?\*\/|\/\/.*(?=[\n\r])/g, '').replace(/\r?\n\s*|\r\s*/g, ' ').replace(/'/g, "\\'");
            CSREditor.ChromeIntegration.eval(CSREditor.SPActions.getCode_performCSRRefresh(url, content));
        };
        FilesList.prototype.saveChangesToFile = function (url, content) {
            var _this = this;
            url = CSREditor.Utils.cutOffQueryString(url.replace(this.siteUrl, '').replace(' ', '%20').toLowerCase());
            if (url[0] != '/')
                url = '/' + url;
            this.savingQueue[url] = { content: content, cooldown: 5 };
            if (!this.savingProcess) {
                this.savingProcess = setInterval(function () {
                    for (var fileUrl in _this.savingQueue) {
                        _this.savingQueue[fileUrl].cooldown--;
                        if (_this.savingQueue[fileUrl].cooldown <= 0) {
                            CSREditor.ChromeIntegration.eval(CSREditor.SPActions.getCode_saveFileToSharePoint(fileUrl, B64.encode(_this.savingQueue[fileUrl].content)));
                            delete _this.savingQueue[fileUrl];
                        }
                    }
                }, 2000);
            }
        };
        return FilesList;
    })();
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
        IntellisenseHelper.prototype.showCodeMirrorHint = function (cm, list) {
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
                        if (completion.typeInfo) {
                            $(element).tooltip({
                                html: true,
                                title: '<div class="tooltip-typeInfo">' + completion.typeInfo + '</div>' + '<div class="tooltip-docComment">' + completion.docComment.replace('\n', '<br/>') + '</div>',
                                trigger: 'manual',
                                container: 'body',
                                placement: 'right'
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
        };
        IntellisenseHelper.prototype.showFunctionTooltip = function (cm, changePosition) {
            $('.tooltip').remove();
            var signature = this.typeScriptService.getSignature(cm.indexFromPos(changePosition) + 1);
            if (signature) {
                this.tooltipLastPos = changePosition;
                var cursorCoords = cm.getEditor().cursorCoords(cm.getCursor(), "page");
                var domElement = cm.getEditor().getWrapperElement();
                $(domElement).data('bs.tooltip', false).tooltip({
                    html: true,
                    title: '<div class="tooltip-typeInfo">' + signature.formal[0].signatureInfo + '</div>' + '<div class="tooltip-docComment">' + signature.formal[0].docComment.replace('\n', '<br/>') + '</div>',
                    trigger: 'manual',
                    container: 'body',
                    placement: 'bottom'
                });
                $(domElement).off('shown.bs.tooltip').on('shown.bs.tooltip', function () {
                    $('.tooltip').css('top', cursorCoords.bottom + "px").css('left', cursorCoords.left + "px");
                });
                $(domElement).tooltip('show');
            }
        };
        IntellisenseHelper.prototype.showFieldInternalNamesDropDown = function (cm, changePosition) {
            var position = cm.indexFromPos(changePosition) + 1;
            var symbolInfo = this.typeScriptService.getSymbolInfo(position);
            var typeMembers = symbolInfo.symbol.type.getMembers();
            if (typeMembers.length == 4 && typeMembers[0].name == "View" && typeMembers[1].name == "EditForm" && typeMembers[2].name == "DisplayForm" && typeMembers[3].name == "NewForm") {
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
        };
        IntellisenseHelper.prototype.scriptChanged = function (cm, changeObj) {
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
            else if ((changeObj.from.ch > 0 && cm.getRange({ ch: changeObj.from.ch - 1, line: changeObj.from.line }, changeObj.from) == '"') || changeObj.text.length == 1 && changeObj.text[0] == '"') {
                this.showFieldInternalNamesDropDown(cm, changeObj.to);
            }
        };
        return IntellisenseHelper;
    })();
    CSREditor.IntellisenseHelper = IntellisenseHelper;
})(CSREditor || (CSREditor = {}));
var CSREditor;
(function (CSREditor) {
    var Panel = (function () {
        function Panel() {
            this.fileName = null;
            this.modifiedFilesContent = {};
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
            this.filesList = new CSREditor.FilesList(function (url) {
                if (url in _this.modifiedFilesContent)
                    _this.setEditorText(url, _this.modifiedFilesContent[url]);
                else {
                    CSREditor.ChromeIntegration.getResourceContent(url, function (text) {
                        _this.setEditorText(url, text);
                    });
                }
            }, this.setEditorText.bind(this));
            CSREditor.ChromeIntegration.eval("_spPageContextInfo.siteAbsoluteUrl", function (result, errorInfo) {
                if (!errorInfo) {
                    var siteUrl = result.toLowerCase();
                    _this.filesList.siteUrl = siteUrl;
                    CSREditor.ChromeIntegration.getAllResources(siteUrl, function (urls) {
                        _this.filesList.addFiles(urls);
                    });
                    CSREditor.ChromeIntegration.setResourceAddedListener(siteUrl, function (url) {
                        var urls = {};
                        urls[url] = 1;
                        _this.filesList.addFiles(urls);
                    });
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
            editor.on("change", function (editor, changeList) {
                _this.processChanges(editor.getDoc(), changeList);
            });
            return editor;
        };
        Panel.prototype.setEditorText = function (url, text, newlyCreated) {
            var _this = this;
            if (newlyCreated === void 0) { newlyCreated = false; }
            this.fileName = url;
            this.editorCM.getDoc().setValue(text);
            this.editorCM.setOption("readOnly", url == null);
            if (newlyCreated)
                this.modifiedFilesContent[url] = text;
            CSREditor.ChromeIntegration.eval(CSREditor.SPActions.getCode_retrieveFieldsInfo(), function (result, errorInfo) {
                var fieldNames = [];
                for (var i = 0; i < result.length; i++) {
                    fieldNames.push(result[i].Name);
                }
                _this.intellisenseHelper.setFieldInternalNames(fieldNames);
            });
        };
        Panel.prototype.processChanges = function (cm, changeObj) {
            if (!changeObj)
                return;
            this.typeScriptService.scriptChanged(cm.getValue(), cm.indexFromPos(changeObj.from), cm.indexFromPos(changeObj.to) - cm.indexFromPos(changeObj.from));
            var url = this.fileName;
            if (url != null) {
                var text = cm.getValue();
                this.filesList.refreshCSR(url, text);
                this.filesList.saveChangesToFile(url, text);
                this.modifiedFilesContent[url] = text;
            }
            this.intellisenseHelper.scriptChanged(cm, changeObj);
            this.checkSyntax(cm);
        };
        Panel.prototype.checkSyntax = function (cm) {
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
                    cm.markText(cm.posFromIndex(errors[i].start()), cm.posFromIndex(errors[i].start() + errors[i].length()), {
                        className: "syntax-error",
                        title: errors[i].text()
                    });
                }
            }, 1500);
        };
        Panel.checkSyntaxTimeout = 0;
        return Panel;
    })();
    CSREditor.Panel = Panel;
})(CSREditor || (CSREditor = {}));
var B64;
var CSREditor;
(function (CSREditor) {
    var SPActions = (function () {
        function SPActions() {
        }
        SPActions.getCSRContextInfo = function () {
            var isFormContext = false;
            var wpqId = 2;
            var csrContext = null;
            if (window["SPClientForms"]) {
                while ($get("WebPartWPQ" + wpqId) != null) {
                    if (window["WPQ" + wpqId + "FormCtx"]) {
                        csrContext = window["WPQ" + wpqId + "FormCtx"];
                        isFormContext = true;
                        break;
                    }
                    wpqId++;
                }
                if (!isFormContext)
                    return;
            }
            else if (window["ctx"])
                csrContext = window["ctx"];
            var wpId;
            if (isFormContext)
                wpId = $get("WebPartWPQ" + wpqId).attributes["webpartid"].value;
            else if (window["ctx"])
                wpId = window["ctx"].clvp.wpid;
            return {
                isFormContext: isFormContext,
                wpId: wpId,
                csrContext: csrContext,
                wpqId: wpqId
            };
        };
        SPActions.getCode_listCsrWebparts = function () {
            return "(function() { var info = (" + SPActions.getCSRContextInfo + ")(); return (" + SPActions.listCsrWebparts + ")(info); })();";
        };
        SPActions.listCsrWebparts = function (info) {
            var controlModeTitle = { '1': 'DisplayForm', '2': 'EditForm', '3': 'NewForm' };
            var title = info.isFormContext ? controlModeTitle[info.csrContext.FormControlMode] + ': ' + info.csrContext.ItemAttributes.Url : 'View: ' + info.csrContext.ListTitle;
            return [{ wpqId: info.wpqId, wpId: info.wpId, isListForm: info.isFormContext, title: title }];
        };
        SPActions.getCode_retrieveFieldsInfo = function () {
            return "(function() { var info = (" + SPActions.getCSRContextInfo + ")(); return (" + SPActions.retrieveFieldsInfo + ")(info); })();";
        };
        SPActions.retrieveFieldsInfo = function (info) {
            return info.csrContext.ListSchema.Field;
        };
        SPActions.getCode_createFileInSharePoint = function (path, fileName) {
            return "(function() { var info = (" + SPActions.getCSRContextInfo + ")(); return (" + SPActions.createFileInSharePoint + ")('" + path + "', '" + fileName + "', info); })();";
        };
        SPActions.createFileInSharePoint = function (path, fileName, info) {
            path = path.replace('%20', ' ');
            if (info.csrContext) {
                SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function () {
                    var context = SP.ClientContext.get_current();
                    var files = context.get_site().get_rootWeb().getFolderByServerRelativeUrl(path).get_files();
                    context.load(files, "Include(Name)");
                    var page = context.get_web().getFileByServerRelativeUrl(_spPageContextInfo.serverRequestPath);
                    var wpm = page.getLimitedWebPartManager(SP.WebParts.PersonalizationScope.shared);
                    var webpartDef = wpm.get_webParts().getById(new SP.Guid(info.wpId));
                    var webpart = webpartDef.get_webPart();
                    var properties = webpart.get_properties();
                    context.load(properties);
                    var setupJsLink = function (properties) {
                        var jsLinkString = (properties.get_item("JSLink") || "") + "|~sitecollection" + path + fileName;
                        if (jsLinkString[0] == '|')
                            jsLinkString = jsLinkString.substr(1);
                        properties.set_item("JSLink", jsLinkString);
                        webpartDef.saveWebPartChanges();
                    };
                    var fatalError = function (sender, args) {
                        console.log('Cisar fatal error: ' + args.get_message());
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
                            script.src = _spPageContextInfo.siteAbsoluteUrl + path + fileName;
                            script.type = "text/javascript";
                            document.head.appendChild(script);
                            setupJsLink(properties);
                            context.executeQueryAsync(function () {
                                window["g_Cisar_fileCreationResult"] = "existing";
                                console.log('CSREditor: existing file has been successfully linked to the ' + (info.isFormContext ? 'LFWP' : 'XLV') + '.');
                            }, fatalError);
                        }
                        else {
                            var creationInfo = new SP.FileCreationInformation();
                            creationInfo.set_content(new SP.Base64EncodedByteArray());
                            creationInfo.set_url(fileName);
                            var file = context.get_site().get_rootWeb().getFolderByServerRelativeUrl(path).get_files().add(creationInfo);
                            file.checkIn("Checked in by Cisar", SP.CheckinType.majorCheckIn);
                            file.publish("Published by Cisar");
                            setupJsLink(properties);
                            context.executeQueryAsync(function () {
                                console.log('Cisar: file has been created successfully.');
                                window["g_Cisar_fileCreationResult"] = "created";
                            }, fatalError);
                        }
                    }, fatalError);
                });
            }
            if (info.isFormContext)
                return {
                    listId: info.csrContext.ListAttributes.Id,
                    isListForm: true,
                    listTemplate: info.csrContext.ListAttributes.ListTemplateType
                };
            else if (info.csrContext)
                return {
                    listId: info.csrContext.listName,
                    listUrl: info.csrContext.listUrlDir,
                    listTitle: info.csrContext.ListTitle,
                    isListForm: false,
                    baseViewId: info.csrContext.BaseViewID,
                    listTemplate: info.csrContext.ListTemplateType
                };
            else
                return null;
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
            return "(function() { var info = (" + SPActions.getCSRContextInfo + ")(); (" + SPActions.performCSRRefresh + ")('" + url + "', '" + content + "', info); })();";
        };
        SPActions.performCSRRefresh = function (url, content, info) {
            if (!info.csrContext)
                return;
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
            var path = url.substr(0, url.lastIndexOf('/'));
            var fileName = url.substr(url.lastIndexOf('/') + 1);
            if (info.isFormContext) {
                var i = 0;
                var rows = document.querySelectorAll("#WebPartWPQ" + info.wpqId + " .ms-formtable tr .ms-formbody");
                for (var f in info.csrContext.ListSchema) {
                    if (f == "Attachments" || f == "Created" || f == "Modified" || f == "Author" || f == "Editor")
                        continue;
                    var nodesToReplace = [];
                    for (var n = 0; n < rows[i].childNodes.length; n++)
                        if (rows[i].childNodes[n].nodeType != 8)
                            nodesToReplace.push(rows[i].childNodes[n]);
                    var span = document.createElement("span");
                    span.id = "WPQ" + info.wpqId + info.csrContext.ListAttributes.Id + f;
                    rows[i].appendChild(span);
                    for (var n = 0; n < nodesToReplace.length; n++)
                        span.appendChild(nodesToReplace[n]);
                    i++;
                }
            }
            else
                for (var f in info.csrContext.ListSchema.Field)
                    delete info.csrContext.ListSchema.Field[f].fieldRenderer;
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
                info.csrContext.DebugMode = true;
                if (info.isFormContext)
                    window["SPClientForms"].ClientFormManager.GetClientForm("WPQ" + info.wpqId).RenderClientForm();
                else if (info.csrContext.inGridMode) {
                    var searchDiv = $get("inplaceSearchDiv_" + info.wpqId);
                    searchDiv.parentNode.removeChild(searchDiv);
                    var gridInitInfo = window["g_SPGridInitInfo"][info.csrContext.view];
                    gridInitInfo.initialized = false;
                    window["InitGrid"](gridInitInfo, info.csrContext, false);
                }
                else
                    window["RenderListView"](info.csrContext, info.csrContext.wpq);
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
                var file = context.get_site().get_rootWeb().getFolderByServerRelativeUrl(path).get_files().getByUrl(fileName);
                file.checkOut();
                file.saveBinary(saveInfo);
                file.checkIn("Checked in by Cisar", SP.CheckinType.minorCheckIn);
                context.executeQueryAsync(function () {
                    console.log('CSREditor: file saved successfully.');
                }, function (sender, args) {
                    console.log('CSREditor fatal error when saving file ' + fileName + ': ' + args.get_message());
                });
            });
        };
        SPActions.getCode_publishFileToSharePoint = function (url) {
            return "(" + SPActions.publishFileToSharePoint + ")('" + url + "');";
        };
        SPActions.publishFileToSharePoint = function (url) {
            var path = url.substr(0, url.lastIndexOf('/'));
            var fileName = url.substr(url.lastIndexOf('/') + 1);
            SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function () {
                var context = SP.ClientContext.get_current();
                var file = context.get_site().get_rootWeb().getFolderByServerRelativeUrl(path).get_files().getByUrl(fileName);
                file.publish("Published by Cisar");
                context.executeQueryAsync(function () {
                    console.log('CSREditor: file published successfully.');
                }, function (sender, args) {
                    console.log('CSREditor fatal error when publishing file ' + fileName + ': ' + args.get_message());
                });
            });
        };
        SPActions.getCode_removeFileFromSharePoint = function (url) {
            return "(function() { var info = (" + SPActions.getCSRContextInfo + ")(); (" + SPActions.removeFileFromSharePoint + ")('" + url + "', info); })();";
        };
        SPActions.removeFileFromSharePoint = function (url, info) {
            var path = url.substr(0, url.lastIndexOf('/'));
            var fileName = url.substr(url.lastIndexOf('/') + 1);
            if (info.csrContext) {
                SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function () {
                    var context = SP.ClientContext.get_current();
                    context.get_site().get_rootWeb().getFileByServerRelativeUrl(url).recycle();
                    var page = context.get_web().getFileByServerRelativeUrl(_spPageContextInfo.serverRequestPath);
                    var wpm = page.getLimitedWebPartManager(SP.WebParts.PersonalizationScope.shared);
                    var webpartDef = wpm.get_webParts().getById(new SP.Guid(info.wpId));
                    var webpart = webpartDef.get_webPart();
                    var properties = webpart.get_properties();
                    context.load(properties);
                    context.executeQueryAsync(function () {
                        var jsLinkString = properties.get_item("JSLink").replace("|~sitecollection" + url, "").replace("~sitecollection" + url + "|", "").replace("~sitecollection" + url, "").replace("|~sitecollection" + url.replace('%20', ' '), "").replace("~sitecollection" + url.replace('%20', ' ') + "|", "").replace("~sitecollection" + url.replace('%20', ' '), "");
                        properties.set_item("JSLink", jsLinkString);
                        webpartDef.saveWebPartChanges();
                        context.executeQueryAsync(function () {
                            console.log('CSREditor: file ' + fileName + ' was successfully moved to recycle bin and removed from the XLV/LFWP.');
                        }, function (sender, args) {
                            console.log('CSREditor error when unlinking file ' + fileName + ' from the XLV/LFWP: ' + args.get_message());
                        });
                    }, function (sender, args) {
                        console.log('CSREditor fatal error when saving file ' + fileName + ': ' + args.get_message());
                    });
                });
            }
        };
        return SPActions;
    })();
    CSREditor.SPActions = SPActions;
})(CSREditor || (CSREditor = {}));
var CSREditor;
(function (CSREditor) {
    var TypeScriptServiceHost = (function () {
        function TypeScriptServiceHost(libText) {
            this.scriptVersion = 0;
            this.libText = "";
            this.libTextLength = 0;
            this.text = "";
            this.changes = [];
            this.libText = libText;
            this.libTextLength = libText.length;
        }
        TypeScriptServiceHost.prototype.log = function (message) {
            console.log("tsHost: " + message);
        };
        TypeScriptServiceHost.prototype.information = function () {
            return true;
        };
        TypeScriptServiceHost.prototype.debug = function () {
            return true;
        };
        TypeScriptServiceHost.prototype.warning = function () {
            return true;
        };
        TypeScriptServiceHost.prototype.error = function () {
            return true;
        };
        TypeScriptServiceHost.prototype.fatal = function () {
            return true;
        };
        TypeScriptServiceHost.prototype.getCompilationSettings = function () {
            return "{ \"noLib\": true }";
        };
        TypeScriptServiceHost.prototype.getScriptFileNames = function () {
            return "[\"csr-editor.ts\", \"libs.ts\"]";
        };
        TypeScriptServiceHost.prototype.getScriptVersion = function (fn) {
            if (fn == 'libs.ts')
                return 0;
            else
                return this.scriptVersion;
        };
        TypeScriptServiceHost.prototype.getScriptIsOpen = function (fn) {
            return true;
        };
        TypeScriptServiceHost.prototype.getLocalizedDiagnosticMessages = function () {
            return "";
        };
        TypeScriptServiceHost.prototype.getCancellationToken = function () {
            return null;
        };
        TypeScriptServiceHost.prototype.getScriptByteOrderMark = function (fn) {
            return 0;
        };
        TypeScriptServiceHost.prototype.resolveRelativePath = function () {
            return null;
        };
        TypeScriptServiceHost.prototype.fileExists = function (fn) {
            return null;
        };
        TypeScriptServiceHost.prototype.directoryExists = function (dir) {
            return null;
        };
        TypeScriptServiceHost.prototype.getParentDirectory = function (dir) {
            return null;
        };
        TypeScriptServiceHost.prototype.getDiagnosticsObject = function () {
            return null;
        };
        TypeScriptServiceHost.prototype.getScriptSnapshot = function (fn) {
            var snapshot, snapshotChanges, snapshotVersion;
            if (fn == 'libs.ts') {
                snapshot = TypeScript.ScriptSnapshot.fromString(this.libText);
                snapshotChanges = [];
                snapshotVersion = 0;
            }
            else {
                snapshot = TypeScript.ScriptSnapshot.fromString(this.text);
                snapshotChanges = this.changes;
                snapshotVersion = this.scriptVersion;
            }
            return {
                getText: function (s, e) {
                    return snapshot.getText(s, e);
                },
                getLength: function () {
                    return snapshot.getLength();
                },
                getLineStartPositions: function () {
                    return "[" + snapshot.getLineStartPositions().toString() + "]";
                },
                getTextChangeRangeSinceVersion: function (version) {
                    if (snapshotVersion == 0)
                        return null;
                    var result = TypeScript.TextChangeRange.collapseChangesAcrossMultipleVersions(snapshotChanges.slice(version - snapshotVersion));
                    return "{ \"span\": { \"start\": " + result.span().start() + ", \"length\": " + result.span().length() + " }, \"newLength\": " + result.newLength() + " }";
                }
            };
        };
        TypeScriptServiceHost.prototype.getLibLength = function () {
            return this.libTextLength;
        };
        TypeScriptServiceHost.prototype.scriptChanged = function (newText, startPos, changeLength) {
            this.scriptVersion++;
            this.text = newText;
            this.changes.push(new TypeScript.TextChangeRange(new TypeScript.TextSpan(startPos, changeLength), newText.length));
        };
        return TypeScriptServiceHost;
    })();
    var TypeScriptService = (function () {
        function TypeScriptService() {
            var self = this;
            var client = new XMLHttpRequest();
            client.open('GET', 'Scripts/typings/libs.d.ts');
            client.onreadystatechange = function () {
                if (client.readyState != 4)
                    return;
                self.tsHost = new TypeScriptServiceHost(client.responseText);
                var tsFactory = new TypeScript.Services.TypeScriptServicesFactory();
                self.tsServiceShim = tsFactory.createLanguageServiceShim(self.tsHost);
            };
            client.send();
        }
        TypeScriptService.prototype.scriptChanged = function (newText, startPos, changeLength) {
            this.tsHost.scriptChanged(newText, startPos, changeLength);
        };
        TypeScriptService.prototype.getSymbolInfo = function (position) {
            return this.tsServiceShim.languageService["getSymbolInfoAtPosition"]('csr-editor.ts', position);
        };
        TypeScriptService.prototype.getCompletions = function (position) {
            return this.tsServiceShim.languageService.getCompletionsAtPosition('csr-editor.ts', position, true);
        };
        TypeScriptService.prototype.getCompletionDetails = function (position, name) {
            return this.tsServiceShim.languageService.getCompletionEntryDetails('csr-editor.ts', position, name);
        };
        TypeScriptService.prototype.getSignature = function (position) {
            return this.tsServiceShim.languageService.getSignatureAtPosition('csr-editor.ts', position);
        };
        TypeScriptService.prototype.getErrors = function () {
            var syntastic = this.tsServiceShim.languageService.getSyntacticDiagnostics('csr-editor.ts');
            var semantic = this.tsServiceShim.languageService.getSemanticDiagnostics('csr-editor.ts');
            return syntastic.concat(semantic);
        };
        return TypeScriptService;
    })();
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
        return Utils;
    })();
    CSREditor.Utils = Utils;
})(CSREditor || (CSREditor = {}));
var CSREditor;
(function (CSREditor) {
    var WebPartModel = (function () {
        function WebPartModel(root, title, id, wpq, isListForm) {
            this.files = [];
            this.fileFlags = {};
            this.adding = false;
            this.loading = false;
            this.newFileName = '';
            this.root = root;
            this.title = title;
            this.id = id;
            this.wpq = wpq;
            this.isListForm = isListForm;
            ko.track(this);
        }
        WebPartModel.prototype.appendFileToList = function (url, justcreated) {
            if (justcreated === void 0) { justcreated = false; }
            if (!this.fileFlags[url]) {
                var file = new CSREditor.FileModel(this.root);
                file.url = url;
                file.shortUrl = url.substr(url.lastIndexOf('/') + 1);
                file.justCreated = justcreated;
                this.files.push(file);
                if (justcreated) {
                    if (this.root.currentFile)
                        this.root.currentFile.current = false;
                    this.root.currentFile = file;
                    file.current = true;
                }
                this.fileFlags[url] = 1;
            }
        };
        WebPartModel.prototype.displayAddNewFileUI = function (data) {
            this.newFileName = '';
            this.adding = true;
        };
        WebPartModel.prototype.fileNameInputKeyDown = function (data, event) {
            var _this = this;
            return this.enterFileName(event, this.newFileName, function () {
                _this.performNewFileCreation();
            }, function () {
                _this.adding = false;
            });
        };
        WebPartModel.prototype.enterFileName = function (event, value, okCallback, cancelCallback) {
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
                if (!safe) {
                    event.preventDefault();
                    event.stopPropagation();
                    console.groupEnd();
                    return false;
                }
            }
            return true;
        };
        WebPartModel.prototype.performNewFileCreation = function () {
            var _this = this;
            this.adding = false;
            this.loading = true;
            if (this.newFileName.indexOf('.js') == -1)
                this.newFileName += '.js';
            CSREditor.ChromeIntegration.eval(CSREditor.SPActions.getCode_createFileInSharePoint(this.root.filesPath.replace(' ', '%20').toLowerCase(), this.newFileName), function (result, errorInfo) {
                if (!errorInfo) {
                    var handle = setInterval(function () {
                        CSREditor.ChromeIntegration.eval(CSREditor.SPActions.getCode_checkFileCreated(), function (result2, errorInfo) {
                            if (errorInfo)
                                console.log(errorInfo);
                            else if (result2 != "wait") {
                                _this.loading = false;
                                clearInterval(handle);
                                if (result2 == "created")
                                    _this.fileWasCreated(_this.newFileName, result);
                                else if (result2 == "error")
                                    alert("There was an error when creating the file. Please check console for details.");
                            }
                        });
                    }, 1000);
                }
            });
        };
        WebPartModel.prototype.fileWasCreated = function (newFileName, result) {
            var fullUrl = (this.root.siteUrl + this.root.filesPath.replace(' ', '%20') + newFileName).toLowerCase();
            this.appendFileToList(fullUrl, true);
            var wptype = result.isListForm ? "LFWP" : "XLV";
            this.root.setEditorText(fullUrl, '// The file has been created, saved into "' + this.root.filesPath + '"\r\n' + '// and attached to the ' + wptype + ' via JSLink property.\r\n\r\n' + 'SP.SOD.executeFunc("clienttemplates.js", "SPClientTemplates", function() {\r\n\r\n' + '  function getBaseHtml(ctx) {\r\n' + '    return SPClientTemplates["_defaultTemplates"].Fields.default.all.all[ctx.CurrentFieldSchema.FieldType][ctx.BaseViewID](ctx);\r\n' + '  }\r\n\r\n' + '  function init() {\r\n\r\n' + '    SPClientTemplates.TemplateManager.RegisterTemplateOverrides({\r\n\r\n' + '      // OnPreRender: function(ctx) { },\r\n\r\n' + '      Templates: {\r\n\r\n' + (result.isListForm ? '' : '      //     View: function(ctx) { return ""; },\r\n' + '      //     Header: function(ctx) { return ""; },\r\n' + '      //     Body: function(ctx) { return ""; },\r\n' + '      //     Group: function(ctx) { return ""; },\r\n' + '      //     Item: function(ctx) { return ""; },\r\n') + '      //     Fields: {\r\n' + '      //         "<fieldInternalName>": {\r\n' + '      //             View: function(ctx) { return ""; },\r\n' + '      //             EditForm: function(ctx) { return ""; },\r\n' + '      //             DisplayForm: function(ctx) { return ""; },\r\n' + '      //             NewForm: function(ctx) { return ""; },\r\n' + '      //         }\r\n' + '      //     },\r\n' + (result.isListForm ? '' : '      //     Footer: function(ctx) { return ""; }\r\n') + '\r\n' + '      },\r\n\r\n' + '      // OnPostRender: function(ctx) { },\r\n\r\n' + (result.isListForm ? '' : '      BaseViewID: ' + result.baseViewId + ',\r\n') + '      ListTemplateType: ' + result.listTemplate + '\r\n\r\n' + '    });\r\n' + '  }\r\n\r\n' + '  RegisterModuleInit(SPClientTemplates.Utility.ReplaceUrlTokens("~siteCollection' + this.root.filesPath + newFileName + '"), init);\r\n' + '  init();\r\n\r\n' + '});\r\n', true);
        };
        return WebPartModel;
    })();
    CSREditor.WebPartModel = WebPartModel;
})(CSREditor || (CSREditor = {}));
//# sourceMappingURL=csr-editor.js.map