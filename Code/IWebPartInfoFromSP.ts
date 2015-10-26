module CSREditor {

    export interface IWebPartInfoFromSP {
        title: string;
        wpqId: number;
        wpId: string;
        isListForm: boolean;
        ctxKey: string;
        baseViewId?: string;
        listTemplateType: number;
        fields?: string[];
    }

}