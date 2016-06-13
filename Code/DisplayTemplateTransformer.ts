class DisplayTemplateTokenSyntax
{
    public static get TokenLogicCodeBegin(): string { return "<!--#_"; }
    public static get TokenLogicCodeEnd(): string { return "_#-->"; }

    public static get TokenRenderExpressionBegin(): string { return "_#="; }
    public static get TokenRenderExpressionEnd(): string { return "=#_"; }
}

enum TransformState
{
    HtmlBlock,
    LogicBlock,
    RenderExpression,
}

enum TransformIndexType
{
    NoTokenFound,
    ContentStart,
    ContentEnd,
    CodeBeginToken,
    CodeEndToken,
    RenderBeginToken,
    RenderEndToken,
}


class DisplayTemplateTransformer
{
    private CurrentLine: string;
    private Indexes: { [key: number]: number };
    private CurrentState: TransformState;
    private PreviousState: TransformState;
    private NextTokenType: TransformIndexType;
    private StartHtmlPos: number;
    private HtmlToTransform: string;
    private PositionMap: { js: number, html: number }[];
    private UniqueId: string;
    private TemplateData: any;
    private TemplateName: string;
    private ScriptBlockContent: string;
    private ScriptBlockPosInHtml: number;
    private ScriptBlockPosInJs: number;
    
    private static tokenIndices: TransformIndexType[] = [
      TransformIndexType.CodeBeginToken, TransformIndexType.CodeEndToken,
      TransformIndexType.RenderBeginToken, TransformIndexType.RenderEndToken
    ];
    
    constructor(html: string, uniqueId: string, templateData: any)
    {
        var match = html.match(/<div[^>]*>/);
        var divtag_endpos = 0;
        if (match != null)
            divtag_endpos = match.index + match[0].length;
        this.PositionMap = [];
        this.StartHtmlPos = divtag_endpos;

        match = html.match(/<script[^>]*>/);
        var scripttag_endpos = 0;
        if (match != null)
            scripttag_endpos = match.index + match[0].length;
        this.ScriptBlockPosInHtml = scripttag_endpos;

        this.CurrentState = this.PreviousState = TransformState.HtmlBlock;
        
        this.UniqueId = uniqueId;
        this.TemplateData = templateData;
        
        if (divtag_endpos)
        {
            var html_doc = $(html);
            var div = html_doc.filter('div');
            this.HtmlToTransform = div.html();
            this.ScriptBlockContent = html_doc.filter('script').html();
            this.TemplateName = div.attr('id');
        } else {
            this.HtmlToTransform = "";
            this.ScriptBlockContent = html;
            this.TemplateName = uniqueId;
        }
    }
        
    public Transform(): string
    {
        var jsContent = "";

        jsContent += "window.DisplayTemplate_" + this.UniqueId + " = function(ctx) {\n";
        jsContent += "  var ms_outHtml=[];\n";
        jsContent += "  var cachePreviousTemplateData = ctx['DisplayTemplateData'];\n";
        jsContent += "  ctx['DisplayTemplateData'] = new Object();\n";
        jsContent += "  DisplayTemplate_" +  this.UniqueId + ".DisplayTemplateData = ctx['DisplayTemplateData'];\n";
        jsContent += "  ctx['DisplayTemplateData']['TemplateUrl']='" + this.TemplateData.TemplateUrl + "';\n";
        jsContent += "  ctx['DisplayTemplateData']['TemplateType']='" + this.TemplateData.TemplateType + "';\n";
        jsContent += "  ctx['DisplayTemplateData']['TargetControlType']=" + JSON.stringify(this.TemplateData.TargetControlType) + ";\n";
        jsContent += "  this.DisplayTemplateData = ctx['DisplayTemplateData'];\n";
        jsContent += "\n";
        
        if (this.TemplateData.TemplateType == "Filter")
        {
            jsContent += "  ctx['DisplayTemplateData']['CompatibleSearchDataTypes']=" + JSON.stringify(this.TemplateData.CompatibleSearchDataTypes) + ";\n";
            jsContent += "  ctx['DisplayTemplateData']['CompatibleManagedProperties']=" + JSON.stringify(this.TemplateData.CompatibleManagedProperties) + ";\n";
        }
        
        if (this.TemplateData.TemplateType == "Item")
        {
            jsContent += "  ctx['DisplayTemplateData']['ManagedPropertyMapping']=" + JSON.stringify(this.TemplateData.ManagedPropertyMapping) + ";\n";
            jsContent += "  var cachePreviousItemValuesFunction = ctx['ItemValues'];\n";
            jsContent += "  ctx['ItemValues'] = function(slotOrPropName) {\n";
            jsContent += "    return Srch.ValueInfo.getCachedCtxItemValue(ctx, slotOrPropName)\n";
            jsContent += "  };\n"
        }

        // ---

        jsContent += "\n";

        jsContent += "  ms_outHtml.push(''";

        var currentPos = this.StartHtmlPos;
        this.PositionMap.push({ js: jsContent.length, html: currentPos });

        var htmlLines = this.HtmlToTransform.split('\n');
        while (htmlLines.length > 0)
        {
            this.CurrentLine = htmlLines.shift();
            this.ResetIndexes();
            var length = -1;
            do
            {
                this.ProcessLineSegment();
                
                var segmentContent = this.CurrentLine.substr(this.Indexes[TransformIndexType.ContentStart], this.Indexes[TransformIndexType.ContentEnd] - this.Indexes[TransformIndexType.ContentStart]);
                
                if (this.CurrentState == TransformState.LogicBlock && this.PreviousState == TransformState.HtmlBlock)
                    jsContent += ");";
                else if (this.CurrentState == TransformState.HtmlBlock && this.PreviousState == TransformState.LogicBlock)
                    jsContent += "  ms_outHtml.push(";
                else if (this.CurrentState != TransformState.LogicBlock)
                    jsContent += ",";

                this.PositionMap.push({ js: jsContent.length, html: currentPos + this.Indexes[TransformIndexType.ContentStart] });

                switch (this.CurrentState)
                {
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
        
        jsContent += `
        function RegisterTemplate_${this.UniqueId}() {
            if ("undefined" != typeof (Srch) && "undefined" != typeof (Srch.U) && typeof(Srch.U.registerRenderTemplateByName) == "function") {
                Srch.U.registerRenderTemplateByName("${this.TemplateName}", DisplayTemplate_${this.UniqueId});
                Srch.U.registerRenderTemplateByName("${this.TemplateData.TemplateUrl}", DisplayTemplate_${this.UniqueId});
            }`;
        this.ScriptBlockPosInJs = jsContent.length;
        jsContent += this.ScriptBlockContent;
        jsContent += `}
        RegisterTemplate_${this.UniqueId}();`;
        
        this.PositionMap.push({ js: jsContent.length, html: currentPos });
        
        return jsContent;
    }
    
    public GetPositionInHtml(posInJs: number): number
    {
        if (this.PositionMap.length == 0)
            return posInJs;
        if (this.ScriptBlockContent.length > 0 && this.ScriptBlockPosInJs <= posInJs && posInJs < this.ScriptBlockPosInJs + this.ScriptBlockContent.length)
            return this.ScriptBlockPosInHtml + posInJs - this.ScriptBlockPosInJs;
        for(var i=0;i<this.PositionMap.length-1;i++)
        {
            if (this.PositionMap[i].js <= posInJs && posInJs < this.PositionMap[i+1].js)
            {
                return this.PositionMap[i].html + posInJs - this.PositionMap[i].js;
            }
        }
        return -1;
    }

    public GetPositionInJs(posInHtml: number): number
    {
        if (this.PositionMap.length == 0)
            return posInHtml;
        if (this.ScriptBlockContent.length > 0 && this.ScriptBlockPosInHtml <= posInHtml && posInHtml < this.ScriptBlockPosInHtml + this.ScriptBlockContent.length)
            return this.ScriptBlockPosInJs + posInHtml - this.ScriptBlockPosInHtml;
        for(var i=0;i<this.PositionMap.length-1;i++)
        {
            if (this.PositionMap[i].html <= posInHtml && posInHtml < this.PositionMap[i+1].html)
            {
                return this.PositionMap[i].js + posInHtml - this.PositionMap[i].html;
            }
        }
        return -1;
    }
    
    private ProcessLineSegment()
    {
        this.FindLineTokenIndices();
        this.FindSegmentTypeAndContent();
    }
    
    private FindSegmentTypeAndContent()
    {
        var flag = false;
        switch (this.CurrentState)
        {
            case TransformState.HtmlBlock:
                if (this.Indexes[TransformIndexType.CodeBeginToken] == this.Indexes[TransformIndexType.ContentStart])
                {
                    flag = true;
                    this.PreviousState = this.CurrentState;
                    this.CurrentState = TransformState.LogicBlock;
                    this.Indexes[TransformIndexType.ContentStart] = this.Indexes[TransformIndexType.ContentStart] + DisplayTemplateTokenSyntax.TokenLogicCodeBegin.length;
                }
                else if (this.Indexes[TransformIndexType.RenderBeginToken] == this.Indexes[TransformIndexType.ContentStart])
                {
                    flag = true;
                    this.PreviousState = this.CurrentState;
                    this.CurrentState = TransformState.RenderExpression;
                    this.Indexes[TransformIndexType.ContentStart] = this.Indexes[TransformIndexType.ContentStart] + DisplayTemplateTokenSyntax.TokenRenderExpressionBegin.length;
                }
                break;
            case TransformState.LogicBlock:
                if (this.Indexes[TransformIndexType.CodeEndToken] == this.Indexes[TransformIndexType.ContentStart])
                {
                    flag = true;
                    this.PreviousState = this.CurrentState;
                    this.CurrentState = TransformState.HtmlBlock;
                    this.Indexes[TransformIndexType.ContentStart] = this.Indexes[TransformIndexType.ContentStart] + DisplayTemplateTokenSyntax.TokenLogicCodeEnd.length;
                }
                break;
            case TransformState.RenderExpression:
                if (this.Indexes[TransformIndexType.RenderEndToken] == this.Indexes[TransformIndexType.ContentStart])
                {
                    flag = true;
                    this.PreviousState = this.CurrentState;
                    this.CurrentState = TransformState.HtmlBlock;
                    this.Indexes[TransformIndexType.ContentStart] = this.Indexes[TransformIndexType.ContentStart] + DisplayTemplateTokenSyntax.TokenRenderExpressionEnd.length;
                }
                break;
        }
        if (flag)
        {
            console.log("FindSegmentTypeAndContent: State changed as a shortcut to "+this.CurrentState+" with segment content now starting at " + this.Indexes[TransformIndexType.ContentStart]);
            this.FindLineTokenIndices();
        }
        this.FindNextTokenTypeAndContentEnd();
    }

    private FindLineTokenIndices()
    {
        this.Indexes[TransformIndexType.CodeBeginToken] = this.CurrentLine.indexOf(DisplayTemplateTokenSyntax.TokenLogicCodeBegin, this.Indexes[TransformIndexType.ContentStart]);
        this.Indexes[TransformIndexType.CodeEndToken] = this.CurrentLine.indexOf(DisplayTemplateTokenSyntax.TokenLogicCodeEnd, this.Indexes[TransformIndexType.ContentStart]);
        this.Indexes[TransformIndexType.RenderBeginToken] = this.CurrentLine.indexOf(DisplayTemplateTokenSyntax.TokenRenderExpressionBegin, this.Indexes[TransformIndexType.ContentStart]);
        this.Indexes[TransformIndexType.RenderEndToken] = this.CurrentLine.indexOf(DisplayTemplateTokenSyntax.TokenRenderExpressionEnd, this.Indexes[TransformIndexType.ContentStart]);
    }
    
    private FindNextTokenTypeAndContentEnd()
    {
        var transformIndexType = TransformIndexType.NoTokenFound;
        var dictionary = {};
        
        for (let index of DisplayTemplateTransformer.tokenIndices)
        {
            if (!(this.Indexes[index] in dictionary))
                dictionary[this.Indexes[index]] = index;
        }

        var sortedSet = Object.keys(dictionary).map(k => +k).sort((a,b) => a - b);
        if (sortedSet.length > 1)
        {
            let index = +sortedSet.filter(n => n > -1)[0];
            transformIndexType = dictionary[index];
            this.Indexes[TransformIndexType.ContentEnd] = index;
        }
        else
            this.Indexes[TransformIndexType.ContentEnd] = this.CurrentLine.length;
        
        this.NextTokenType = transformIndexType;
    }
    
    private EscapeHtmlSegment(s: string)
    {
        return s.replace(/\\/g, '\\\\').replace(/'/g, '\\\'');
    }
    
    private ResetIndexes()
    {
        this.Indexes = {};
        for (let index of Object.keys(TransformIndexType).map(v => parseInt(v, 10)).filter(v => !isNaN(v)))
            this.Indexes[index] = index != TransformIndexType.ContentStart ? -1 : 0;
    }
}
