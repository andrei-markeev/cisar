module CSREditor {

    export interface IListWebpartFromSP {
        title: string;
        wpqId: number;
        wpId: string;
        isListForm: boolean;
        ctxKey?: string;
        baseViewId?: string;
        listTemplateType?: number;
        fields?: string[];
    }

    export interface ISearchWebpartFromSP {
        title: string;
        wpqId: number;
        wpId: string;
        controlTemplate: string;
        itemTemplate: string;
        itemBodyTemplate: string;
        groupTemplate: string;
    }

}