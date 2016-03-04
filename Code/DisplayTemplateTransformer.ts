class DisplayTemplateTokenSyntax
{
    public static get TokenLogicCodeBegin(): string { return "<!--#_"; }
    public static get TokenLogicCodeEnd(): string { return "_#-->"; }

    public static get TokenRenderExpressionBegin(): string { return "_#="; }
    public static get TokenRenderExpressionEnd(): string { return "=#_"; }

    public static get TokenRegexPreserveLogicScriptQuotes(): string { return "\"(?<=<!--#_([^#]*))'\""; }
    public static get TokenRegexPreserveRenderingScriptQuotes(): string { return "\"(?<=_#=([^#]*))'\""; }
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
    private CurrentLineNumber: number;
    private Indexes: { [key: number]: number };
    private CurrentState: TransformState;
    private PreviousState: TransformState;
    private NextTokenType: TransformIndexType;
    
    private static tokenIndices: TransformIndexType[] = [
      TransformIndexType.CodeBeginToken, TransformIndexType.CodeEndToken,
      TransformIndexType.RenderBeginToken, TransformIndexType.RenderEndToken
    ];
    
    constructor()
    {
        this.CurrentState = this.PreviousState = TransformState.HtmlBlock;
        this.CurrentLineNumber = 0;
    }
        
    public Transform(htmlToTransform: string, templateName: string, uniqueId: string, templateInfo: any): string
    {
        var jsContent = "";

        jsContent += "window.DisplayTemplate_" + uniqueId + " = function(ctx) {\n";
        jsContent += "  var ms_outHtml=[];\n";
        jsContent += "  var cachePreviousTemplateData = ctx['DisplayTemplateData'];\n";
        jsContent += "  ctx['DisplayTemplateData'] = new Object();\n";
        jsContent += "  DisplayTemplate_" +  uniqueId + ".DisplayTemplateData = ctx['DisplayTemplateData'];\n";
        jsContent += "  ctx['DisplayTemplateData']['TemplateUrl']='" + templateInfo.TemplateUrl + "';\n";
        jsContent += "  ctx['DisplayTemplateData']['TemplateType']='" + templateInfo.TemplateType + "';\n";
        jsContent += "  ctx['DisplayTemplateData']['TargetControlType']=" + JSON.stringify(templateInfo.TargetControlType) + ";\n";
        jsContent += "  this.DisplayTemplateData = ctx['DisplayTemplateData'];\n";
        jsContent += "\n";
        
        if (templateInfo.TemplateType == "Filter")
        {
            jsContent += "  ctx['DisplayTemplateData']['CompatibleSearchDataTypes']=" + JSON.stringify(templateInfo.CompatibleSearchDataTypes) + ";\n";
            jsContent += "  ctx['DisplayTemplateData']['CompatibleManagedProperties']=" + JSON.stringify(templateInfo.CompatibleManagedProperties) + ";\n";
        }
        
        if (templateInfo.TemplateType == "Item")
        {
            jsContent += "  ctx['DisplayTemplateData']['ManagedPropertyMapping']=" + JSON.stringify(templateInfo.ManagedPropertyMapping) + ";\n";
            jsContent += "  var cachePreviousItemValuesFunction = ctx['ItemValues'];\n";
            jsContent += "  ctx['ItemValues'] = function(slotOrPropName) {\n";
            jsContent += "    return Srch.ValueInfo.getCachedCtxItemValue(ctx, slotOrPropName)\n";
            jsContent += "  };\n"
        }

        // ---

        jsContent += "\n";

        jsContent += "  ms_outHtml.push(''";
        var htmlLines = htmlToTransform.split('\n');
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
            
            } while (this.Indexes[TransformIndexType.ContentEnd] < this.CurrentLine.length);
            
            jsContent += "\n";
            
        }
        jsContent += ");\n";
        
        if (templateInfo.TemplateType == "Item")
            jsContent += "  ctx['ItemValues'] = cachePreviousItemValuesFunction;\n";
        
        jsContent += "  ctx['DisplayTemplateData'] = cachePreviousTemplateData;\n";
        jsContent += "  return ms_outHtml.join('');\n";
        jsContent += "};\n";
        
        jsContent += `
        function RegisterTemplate_${uniqueId}() {
            if ("undefined" != typeof (Srch) && "undefined" != typeof (Srch.U) && typeof(Srch.U.registerRenderTemplateByName) == "function") {
                Srch.U.registerRenderTemplateByName("${templateName}", DisplayTemplate_${uniqueId});
                Srch.U.registerRenderTemplateByName("${templateInfo.TemplateUrl}", DisplayTemplate_${uniqueId});
            }
        }
        RegisterTemplate_${uniqueId}();`;
        
        return jsContent;
    }
    
    private ProcessLineSegment()
    {
        this.FindLineTokenIndices();
        this.FindSegmentTypeAndContent();
        switch (this.CurrentState)
        {
            case TransformState.HtmlBlock:
                //this.ValidateHtmlBlock();
            break;
            case TransformState.LogicBlock:
                //this.ValidateLogicBlock();
            break;
            case TransformState.RenderExpression:
                //this.ValidateRenderingExpression();
            break;
        }
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
