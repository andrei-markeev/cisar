var B64: any;

module CSREditor {

    export class SPActions {

        public static getCode_listCsrWebparts() {
            return "(" + SPActions.listCsrWebparts + ")();";
        }

        private static listCsrWebparts() {
            var controlModeTitle = { '1': 'DisplayForm', '2': 'EditForm', '3': 'NewForm' };

            var jsLinkWebparts = [];
            var searchResultWebparts = [];
            var wp_properties = [];

            if (GetUrlKeyValue("PageView") == "Personal") {
                window["g_Cisar_JSLinkUrls"] = "personal";
                return { listWebparts: [], searchWebparts: [], displayTemplates: []};
            }

            var webpartZones = document.querySelectorAll('[id^="MSOZoneCell_WebPartWPQ"]');
            for (var i=0; i < webpartZones.length; i++) {
                var wpqId = +webpartZones[i].attributes["id"].value.substr("MSOZoneCell_WebPartWPQ".length);
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

                    jsLinkWebparts.push({
                        title: 'LFWP ' + controlModeTitle[ctx.FormControlMode] + ': ' + (ctx.ItemAttributes.Url || ctx.NewItemRootFolder),
                        wpqId: wpqId,
                        wpId: wpId,
                        isListForm: true,
                        ctxKey: "WPQ" + wpqId + "FormCtx",
                        listTemplateType: ctx.ListAttributes.ListTemplateType,
                        fields: fields
                    });


                } else if (window["WPQ" + wpqId + "SchemaData"]) {

                    var ctxNumber = window["g_ViewIdToViewCounterMap"][window["WPQ" + wpqId + "SchemaData"].View];
                    var ctx = window["ctx" + ctxNumber];

                    jsLinkWebparts.push({
                        title: 'XLV: ' + ctx.ListTitle,
                        wpqId: wpqId,
                        wpId: wpId,
                        isListForm: false,
                        ctxKey: 'ctx' + ctxNumber,
                        baseViewId: ctx.BaseViewId,
                        listTemplateType: ctx.ListTemplateType
                    });

                } else if (document.querySelector("#WebPartWPQ" + wpqId + " > [componentid$='_csr']")) {
                    var dtElement = document.querySelector("#WebPartWPQ" + wpqId + " > [componentid$='_csr']");
                    var dtControl = Srch.U.getClientComponent(dtElement);
                    if (dtControl && (<Srch.Result>dtControl).get_itemBodyTemplateId)
                        searchResultWebparts.push({
                            title: "SearchResults " + (searchResultWebparts.length+1),
                            wpqId: wpqId,
                            wpId: wpId,
                            controlTemplate: (<Srch.Result>dtControl).get_renderTemplateId(),
                            itemTemplate: (<Srch.Result>dtControl).get_itemTemplateId(),
                            itemBodyTemplate: (<Srch.Result>dtControl).get_itemBodyTemplateId(),
                            groupTemplate: (<Srch.Result>dtControl).get_groupTemplateId()
                        })
                }
                
            }

            delete window["g_Cisar_JSLinkUrls"];

            if (jsLinkWebparts.length > 0) {

                SP.SOD.executeFunc("sp.js", "SP.ClientContext", function() {

                    var context = SP.ClientContext.get_current();
                    var page = context.get_web().getFileByServerRelativeUrl(_spPageContextInfo.serverRequestPath);
                    var wpm = page.getLimitedWebPartManager(SP.WebParts.PersonalizationScope.shared);

                    for (var i=0; i<jsLinkWebparts.length; i++) {
                        var webpartDef = wpm.get_webParts().getById(new SP.Guid(jsLinkWebparts[i].wpId));
                        var webpart = webpartDef.get_webPart();
                        var properties = webpart.get_properties();
                        context.load(properties);
                        wp_properties.push({ wpqId: jsLinkWebparts[i].wpqId, properties: properties });
                    }
                    
                    context.executeQueryAsync(
                        function () {
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
                        },
                        function (s, args) {
                            console.log('Error when retrieving properties for the CSR webparts on the page: ' + args.get_message());
                            console.log(jsLinkWebparts);
                            window["g_Cisar_JSLinkUrls"] = 'error';
                        });
                });

            } else {
                window["g_Cisar_JSLinkUrls"] = {};
            }

            var displayTemplateFuncs = Object.keys(window).filter(k => k.indexOf('DisplayTemplate_') == 0);
            displayTemplateFuncs.filter(k => window[k].DisplayTemplateData == null).forEach(k => {
                try { window[k]({}); } catch(e) {}
            });
            var displayTemplates = displayTemplateFuncs.filter(k => window[k].DisplayTemplateData).map(k => { return {
                uniqueId: k.substr("DisplayTemplate_".length),
                info: window[k].DisplayTemplateData
            }});

            return {
                listWebparts: jsLinkWebparts,
                searchWebparts: searchResultWebparts,
                displayTemplates: displayTemplates
            };
        }


        public static getCode_checkJSLinkInfoRetrieved() {
            return "(" + SPActions.checkJSLinkInfoRetrieved + ")();";
        }
        private static checkJSLinkInfoRetrieved() {
            if (window["g_Cisar_JSLinkUrls"]) {
                var result = window["g_Cisar_JSLinkUrls"];
                delete window["g_Cisar_JSLinkUrls"];
                return result;
            }
            else
                return "wait";
        }

        public static getCode_retrieveFieldsInfo(ctxKey: string) {
            return "(" + SPActions.retrieveFieldsInfo + ")('" + ctxKey  + "');";
        }

        private static retrieveFieldsInfo(ctxKey) {
            return window[ctxKey]["ListSchema"].Field || window[ctxKey]["ListSchema"];
        }


        public static getCode_createFileInSharePoint(path: string, fileName: string, wpId: string, content64: string) {
            return "(" + SPActions.createFileInSharePoint + ")('" + path + "', '" + fileName + "', '" + wpId + "', '" + content64 + "');";
        }
        private static createFileInSharePoint(path: string, fileName: string, wpId: string, content64: string) {
            path = path.replace('%20', ' ');
            var fullPath = path.replace('~sitecollection/', (_spPageContextInfo.siteServerRelativeUrl + '/').replace('//', '/'));
            fullPath = fullPath.replace('~site/', (_spPageContextInfo.webServerRelativeUrl + '/').replace('//', '/'));

            SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function () {
                var context = SP.ClientContext.get_current();

                var files;
                if (path.indexOf('~site/')==0)
                    files = context.get_web().getFolderByServerRelativeUrl(fullPath).get_files();
                else
                    files = context.get_site().get_rootWeb().getFolderByServerRelativeUrl(fullPath).get_files();
                context.load(files, "Include(Name)");

                if (wpId) {
                    var page = context.get_web().getFileByServerRelativeUrl(_spPageContextInfo.serverRequestPath);
                    var wpm = page.getLimitedWebPartManager(SP.WebParts.PersonalizationScope.shared);
                    var webpartDef = wpm.get_webParts().getById(new SP.Guid(wpId));
                    var webpart = webpartDef.get_webPart();
                    var properties = webpart.get_properties();
                    context.load(properties);
                }

                var setupJsLink = function (properties) {
                    var jsLinkString = (properties.get_item("JSLink") || "") + "|" + path + fileName;
                    if (jsLinkString[0] == '|')
                        jsLinkString = jsLinkString.substr(1);
                    properties.set_item("JSLink", jsLinkString);
                    webpartDef.saveWebPartChanges();
                }

                var fatalError = function (sender, args) {
                    console.log('Cisar fatal error when creating file ' + fileName + ' at ' + fullPath + ': ' + args.get_message());
                    window["g_Cisar_fileCreationResult"] = "error";
                }

                context.executeQueryAsync(function () {

                    var enumerator = files.getEnumerator();
                    var fileExists = false;
                    while (enumerator.moveNext() && !fileExists) {
                        if (enumerator.get_current().get_name().toLowerCase() == fileName.toLowerCase())
                            fileExists = true;
                    }

                    if (fileExists) {

                        if (wpId) {
                            var script = document.createElement("script");
                            script.src = fullPath + fileName;
                            script.type = "text/javascript";
                            document.head.appendChild(script);

                            setupJsLink(properties);
                        }

                        context.executeQueryAsync(function () {
                            window["g_Cisar_fileCreationResult"] = "existing";
                            console.log('CSREditor: existing file has been successfully linked to the webpart.');
                        },
                        fatalError);

                    } else {

                        var creationInfo = new SP.FileCreationInformation();
                        creationInfo.set_content(new SP.Base64EncodedByteArray(content64));
                        creationInfo.set_url(fileName);
                        var file = files.add(creationInfo);
                        context.load(file, 'CheckOutType');

                        if (wpId)
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
                        },
                        fatalError);

                    }
                },
                fatalError);
            });
        }

        public static getCode_checkFileCreated() {
            return "(" + SPActions.checkFileCreated + ")();";
        }
        private static checkFileCreated() {
            if (window["g_Cisar_fileCreationResult"]) {
                var result = window["g_Cisar_fileCreationResult"];
                delete window["g_Cisar_fileCreationResult"];
                return result;
            }
            else
                return "wait";
        }

        public static getCode_saveFileToSharePoint(url: string, content64: string) {
            return "(" + SPActions.saveFileToSharePoint + ")('" + url + "', '" + content64 + "');";
        }
        private static saveFileToSharePoint(url: string, content64: string) {

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
                },
                function (sender, args) {
                    console.log('Cisar fatal error when saving file ' + fileName + ' to path "' + path + '": ' + args.get_message());
                    window["g_Cisar_fileSavingResult"] = "error";
                });
            });
        }

        public static getCode_checkFileSaved() {
            return "(" + SPActions.checkFileSaved + ")();";
        }
        private static checkFileSaved() {
            if (window["g_Cisar_fileSavingResult"]) {
                var result = window["g_Cisar_fileSavingResult"];
                delete window["g_Cisar_fileSavingResult"];
                return result;
            }
            else
                return "wait";
        }

        public static getCode_publishFileToSharePoint(url: string) {
            return "(" + SPActions.publishFileToSharePoint + ")('" + url + "');";
        }
        private static publishFileToSharePoint(url: string) {

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
                        },
                        function (sender, args) {
                            console.log('Cisar fatal error when publishing file ' + fileName + ': ' + args.get_message());
                        });
                    }
                    else
                      console.log('Cisar: file does not need to be published. file.get_level()=' + file.get_level());
                },
                function (sender, args) {
                    console.log('Cisar fatal error when publishing file ' + fileName + ' to path "' + path + '": ' + args.get_message());
                });
            });
        }

        public static getCode_getJSLink(wpId: string) {
            return "(" + SPActions.getJSLink + ")('" + wpId + "');";
        }
        private static getJSLink(wpId: string) {
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
                },
                function () {
                    window["g_Cisar_JSLink"] = 'error';
                });
            });
        }
        public static getCode_checkJSLinkRetrieved() {
            return "(" + SPActions.checkJSLinkRetrieved + ")();";
        }
        private static checkJSLinkRetrieved() {
            if (window["g_Cisar_JSLink"]) {
                var result = window["g_Cisar_JSLink"];
                delete window["g_Cisar_JSLink"];
                return result;
            }
            else
                return "wait";
        }


        public static getCode_setJSLink(wpId: string, value: string) {
            return "(" + SPActions.setJSLink + ")('" + wpId + "','" + value + "');";
        }
        private static setJSLink(wpId: string, value: string) {
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
                },
                function (sender, args) {
                    window["g_Cisar_JSLinkSaveResult"] = 'error';
                    console.log('Error when saving JSLink: ' + args.get_message());
                });
            });
        }
        public static getCode_checkJSLinkSaved() {
            return "(" + SPActions.checkJSLinkSaved + ")();";
        }
        private static checkJSLinkSaved() {
            if (window["g_Cisar_JSLinkSaveResult"]) {
                var result = window["g_Cisar_JSLinkSaveResult"];
                delete window["g_Cisar_JSLinkSaveResult"];
                return result;
            }
            else
                return "wait";
        }


        public static getCode_setTemplates(wpId: string, controlTemplateId: string, groupTemplateId: string, itemTemplateId: string, itemBodyTemplateId: string) {
            return "(" + SPActions.setTemplates + ")('" + wpId + "','" + controlTemplateId + "','" + groupTemplateId + "','" + itemTemplateId + "','" + itemBodyTemplateId + "');";
        }
        private static setTemplates(wpId, controlTemplateId, groupTemplateId, itemTemplateId, itemBodyTemplateId) {
            delete window["g_Cisar_TemplatesSaveResult"];
            SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function () {
                var context = SP.ClientContext.get_current();
                var page = context.get_web().getFileByServerRelativeUrl(_spPageContextInfo.serverRequestPath);
                var wpm = page.getLimitedWebPartManager(SP.WebParts.PersonalizationScope.shared);
                var webpartDef = wpm.get_webParts().getById(new SP.Guid(wpId));
                var webpart = webpartDef.get_webPart();
                webpart.get_properties().set_item("RenderTemplateId", controlTemplateId);
                webpart.get_properties().set_item("GroupTemplateId", groupTemplateId);
                webpart.get_properties().set_item("ItemTemplateId", itemTemplateId);
                webpart.get_properties().set_item("ItemBodyTemplateId", itemBodyTemplateId);
                webpartDef.saveWebPartChanges();

                context.executeQueryAsync(function () {
                    window["g_Cisar_TemplatesSaveResult"] = 'success';
                },
                function (sender, args) {
                    window["g_Cisar_TemplatesSaveResult"] = 'error';
                    console.log('Error when saving Templates: ' + args.get_message());
                });
            });
        }
        public static getCode_checkTemplatesSaved() {
            return "(" + SPActions.checkTemplatesSaved + ")();";
        }
        private static checkTemplatesSaved() {
            if (window["g_Cisar_TemplatesSaveResult"]) {
                var result = window["g_Cisar_TemplatesSaveResult"];
                delete window["g_Cisar_TemplatesSaveResult"];
                return result;
            }
            else
                return "wait";
        }

        public static getCode_removeFileFromSharePoint(url: string, wpId: string) {
            return "(" + SPActions.removeFileFromSharePoint + ")('" + url + "', '" + wpId + "');";
        }
        private static removeFileFromSharePoint(url: string, wpId: string) {
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

                    for (var info of toCheck) {
                        var urlToCheck;
                        if (info[1] == '/')
                            urlToCheck = info[0] + url;
                        else
                            urlToCheck = url.replace(info[1], info[0]);

                        jsLinkString = jsLinkString
                            .replace("|" + urlToCheck + "|", "|")
                            .replace("|" + urlToCheck.replace('%20', ' ') + "|", "|");
                    }

                    jsLinkString = jsLinkString.slice(0,-1);
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
                    },
                    function (sender, args) {
                        console.log('Cisar error when unlinking file ' + fileName + ' from the XLV/LFWP: ' + args.get_message());
                    });
                },
                function (sender, args) {
                    console.log('Cisar fatal error when recycling file ' + fileName + ': ' + args.get_message());
                });
            });

        }


        public static getCode_getFileContent(url: string) {
            return "(" + SPActions.getFileContent + ")('" + url + "');";
        }
        private static getFileContent(url: string) {
            delete window["g_Cisar_FileContents"];
            var domainPart = _spPageContextInfo.siteAbsoluteUrl;
            if (_spPageContextInfo.siteServerRelativeUrl != '/')
               domainPart = _spPageContextInfo.siteAbsoluteUrl.replace(_spPageContextInfo.siteServerRelativeUrl, '');
            var r = new Sys.Net.WebRequest();
            r.set_url(domainPart + url + "?" + Date.now());
            r.set_httpVerb("GET");
            r.add_completed((executor, args) => {
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
        }


        public static getCode_checkFileContentRetrieved() {
            return "(" + SPActions.checkFileContentRetrieved + ")();";
        }
        private static checkFileContentRetrieved() {
            if (window["g_Cisar_FileContents"]) {
                var result = window["g_Cisar_FileContents"];
                delete window["g_Cisar_FileContents"];
                return result;
            }
            else
                return "wait";
        }

        public static getCode_checkPageIsLoaded() {
            return "(" + SPActions.checkPageIsLoaded + ")();";
        }
        private static checkPageIsLoaded() {
            if (window["SP"] && window["_spPageContextInfo"] && window["SP"]["ClientContext"]) {
                return "loaded";
            }
            else
                return "wait";
        }
    }

}
