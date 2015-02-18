var B64: any;

module CSREditor {
    export class SPActions {

        public static createFileInSharePoint(path: string, fileName: string) {
            var wpqId = 2;
            var formContext = null;
            while ($get("WebPartWPQ" + wpqId) != null) {
                if (window["WPQ" + wpqId + "FormCtx"]) {
                    formContext = window["WPQ" + wpqId + "FormCtx"];
                    break;
                }
                wpqId++;
            }

            path = path.replace('%20', ' ');

            if (formContext || window["ctx"]) {


                SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function () {
                    var context = SP.ClientContext.get_current();

                    var files = context.get_site().get_rootWeb().getFolderByServerRelativeUrl(path).get_files();
                    context.load(files, "Include(Name)");

                    var wpid;
                    if (formContext)
                        wpid = $get("WebPartWPQ" + wpqId).attributes["webpartid"].value;
                    else if (window["ctx"])
                        wpid = window["ctx"].clvp.wpid;

                    var page = context.get_web().getFileByServerRelativeUrl(_spPageContextInfo.serverRequestPath);
                    var wpm = page.getLimitedWebPartManager(SP.WebParts.PersonalizationScope.shared);
                    var webpartDef = wpm.get_webParts().getById(new SP.Guid(wpid));
                    var webpart = webpartDef.get_webPart();
                    var properties = webpart.get_properties();
                    context.load(properties);

                    var setupJsLink = function (properties) {
                        var jsLinkString = (properties.get_item("JSLink") || "") + "|~sitecollection" + path + fileName;
                        if (jsLinkString[0] == '|')
                            jsLinkString = jsLinkString.substr(1);
                        properties.set_item("JSLink", jsLinkString);
                        webpartDef.saveWebPartChanges();
                    }

                    var fatalError = function (sender, args) {
                        console.log('CSREditor fatal error: ' + args.get_message());
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

                            var script = document.createElement("script");
                            script.src = _spPageContextInfo.siteAbsoluteUrl + path + fileName;
                            script.type = "text/javascript";
                            document.head.appendChild(script);

                            setupJsLink(properties);

                            context.executeQueryAsync(function () {
                                window["g_Cisar_fileCreationResult"] = "existing";
                                console.log('CSREditor: existing file has been successfully linked to the ' + (formContext ? 'LFWP' : 'XLV') + '.');
                            },
                            fatalError);

                        } else {

                            var creationInfo = new SP.FileCreationInformation();
                            creationInfo.set_content(new SP.Base64EncodedByteArray());
                            creationInfo.set_url(fileName);
                            var file = context.get_site().get_rootWeb().getFolderByServerRelativeUrl(path).get_files().add(creationInfo)
                            file.checkIn("Checked in by CSR Editor", SP.CheckinType.majorCheckIn);
                            file.publish("Published by CSR Editor");

                            setupJsLink(properties);

                            context.executeQueryAsync(function () {
                                console.log('CSREditor: file has been created successfully.');
                                window["g_Cisar_fileCreationResult"] = "created";
                            },
                            fatalError);

                        }
                    },
                    fatalError);
                });
            }

            if (formContext)
                return {
                    listId: formContext.ListAttributes.Id,
                    isListForm: true,
                    listTemplate: formContext.ListAttributes.ListTemplateType
                };
            else if (window["ctx"])
                return {
                    listId: window["ctx"].listName,
                    listUrl: window["ctx"].listUrlDir,
                    listTitle: window["ctx"].ListTitle,
                    isListForm: false,
                    baseViewId: window["ctx"].BaseViewID,
                    listTemplate: window["ctx"].ListTemplateType
                };
            else
                return null;
        }

        public static checkFileCreated() {
            if (window["g_Cisar_fileCreationResult"]) {
                var result = window["g_Cisar_fileCreationResult"];
                delete window["g_Cisar_fileCreationResult"];
                return result;
            }
            else
                return "wait";
        }

        public static performCSRRefresh(url: string, content: string) {
            
            var extend = function (dest, source) {
                for (var p in source) {
                    if (source[p] && source[p].constructor && source[p].constructor === Object) {
                        dest[p] = dest[p] || {};
                        arguments.callee(dest[p], source[p]);
                    } else {
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

            var formContext = false;
            var wpqId = 2;
            var csrContext = null;
            if (window["SPClientForms"]) {
                while ($get("WebPartWPQ" + wpqId) != null) {
                    if (window["WPQ" + wpqId + "FormCtx"]) {
                        csrContext = window["WPQ" + wpqId + "FormCtx"];
                        formContext = true;
                        break;
                    }
                    wpqId++;
                }
                if (!formContext)
                    return;
            }
            else if (window["ctx"])
                csrContext = window["ctx"];
            else
                return;
               
            var path = url.substr(0, url.lastIndexOf('/'));
            var fileName = url.substr(url.lastIndexOf('/') + 1);

            if (formContext) {
                var i = 0;
                var rows = document.querySelectorAll("#WebPartWPQ" + wpqId + " .ms-formtable tr .ms-formbody");
                for (var f in csrContext.ListSchema) {
                    if (f == "Attachments" || f == "Created" || f == "Modified" || f == "Author" || f == "Editor")
                        continue;
                    var nodesToReplace = [];
                    for (var n = 0; n < rows[i].childNodes.length; n++)
                        if (rows[i].childNodes[n].nodeType != 8)
                            nodesToReplace.push(rows[i].childNodes[n]);
                    var span = document.createElement("span");
                    span.id = "WPQ" + wpqId + csrContext.ListAttributes.Id + f;
                    rows[i].appendChild(span);
                    for (var n = 0; n < nodesToReplace.length; n++)
                        span.appendChild(nodesToReplace[n]);
                    i++;
                }
            }
            else
                for (var f in csrContext.ListSchema.Field)
                    delete csrContext.ListSchema.Field[f].fieldRenderer;

            if (window["g_templateOverrides_" + fileName])
                substract_objects(SPClientTemplates.TemplateManager["_TemplateOverrides"], window["g_templateOverrides_" + fileName]);

            var savedRegisterOverridesMethod = SPClientTemplates.TemplateManager.RegisterTemplateOverrides;
            SPClientTemplates.TemplateManager.RegisterTemplateOverrides = function (options) {
                SPClientTemplates.TemplateManager.RegisterTemplateOverrides = savedRegisterOverridesMethod;
                //debugger;
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

                csrContext.DebugMode = true;

                if (formContext)
                    window["SPClientForms"].ClientFormManager.GetClientForm("WPQ" + wpqId).RenderClientForm();
                else if (csrContext.inGridMode)
                {
                    var searchDiv = $get("inplaceSearchDiv_" + csrContext.wpq);
                    searchDiv.parentNode.removeChild(searchDiv);
                    var gridInitInfo = window["g_SPGridInitInfo"][csrContext.view];
                    gridInitInfo.initialized = false
                    window["InitGrid"](gridInitInfo, csrContext, false);
                }
                else
                    window["RenderListView"](csrContext, csrContext.wpq);

            }

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
        }

        public static saveFileToSharePoint(url: string, content64: string) {

            var path = url.substr(0, url.lastIndexOf('/'));
            var fileName = url.substr(url.lastIndexOf('/') + 1);

            SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function () {
                var context = SP.ClientContext.get_current();

                var saveInfo = new SP.FileSaveBinaryInformation();
                saveInfo.set_content(new SP.Base64EncodedByteArray(content64));

                var file = context.get_site().get_rootWeb().getFolderByServerRelativeUrl(path).get_files().getByUrl(fileName);
                file.checkOut();
                file.saveBinary(saveInfo);
                file.checkIn("Checked in by CSR Editor", SP.CheckinType.majorCheckIn);
                file.publish("Published by CSR Editor");

                context.executeQueryAsync(function () {
                    console.log('CSREditor: file saved successfully.');
                },
                function (sender, args) {
                    console.log('CSREditor fatal error when saving file ' + fileName + ': ' + args.get_message());
                });
            });
        }

        public static removeFileFromSharePoint(url: string) {
            var wpqId = 2;
            var formContext = null;
            while ($get("WebPartWPQ" + wpqId) != null) {
                if (window["WPQ" + wpqId + "FormCtx"]) {
                    formContext = window["WPQ" + wpqId + "FormCtx"];
                    break;
                }
                wpqId++;
            }

            var path = url.substr(0, url.lastIndexOf('/'));
            var fileName = url.substr(url.lastIndexOf('/') + 1);

            if (formContext || window["ctx"]) {

                SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function () {
                    var wpid;
                    if (formContext)
                        wpid = $get("WebPartWPQ" + wpqId).attributes["webpartid"].value;
                    else if (window["ctx"])
                        wpid = window["ctx"].clvp.wpid;

                    var context = SP.ClientContext.get_current();

                    context.get_site().get_rootWeb().getFileByServerRelativeUrl(url).recycle();

                    var page = context.get_web().getFileByServerRelativeUrl(_spPageContextInfo.serverRequestPath);
                    var wpm = page.getLimitedWebPartManager(SP.WebParts.PersonalizationScope.shared);
                    var webpartDef = wpm.get_webParts().getById(new SP.Guid(wpid));
                    var webpart = webpartDef.get_webPart();
                    var properties = webpart.get_properties();
                    context.load(properties);

                    context.executeQueryAsync(function () {
                        var jsLinkString = properties.get_item("JSLink")
                            .replace("|~sitecollection" + url, "")
                            .replace("~sitecollection" + url + "|", "")
                            .replace("~sitecollection" + url, "")
                            .replace("|~sitecollection" + url.replace('%20', ' '), "")
                            .replace("~sitecollection" + url.replace('%20', ' ') + "|", "")
                            .replace("~sitecollection" + url.replace('%20', ' '), "");
                        properties.set_item("JSLink", jsLinkString);
                        webpartDef.saveWebPartChanges();
                        context.executeQueryAsync(function () {
                            console.log('CSREditor: file ' + fileName + ' was successfully moved to recycle bin and removed from the XLV/LFWP.');
                        },
                        function (sender, args) {
                            console.log('CSREditor error when unlinking file ' + fileName + ' from the XLV/LFWP: ' + args.get_message());
                        });
                    },
                    function (sender, args) {
                        console.log('CSREditor fatal error when saving file ' + fileName + ': ' + args.get_message());
                    });
                });

            }

        }
    }

}
