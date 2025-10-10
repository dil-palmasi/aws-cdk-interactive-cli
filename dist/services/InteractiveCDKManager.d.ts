import { CDKStackService } from "./CDKStackService";
export interface AppConfig {
    autoRefresh: boolean;
    refreshInterval: number;
    defaultAction: "deploy" | "delete" | "info";
    confirmActions: boolean;
}
export declare class InteractiveCDKManager {
    private cdkService;
    private config;
    private stacks;
    private isRunning;
    private stacksLoaded;
    constructor(cdkService: CDKStackService, config: AppConfig);
    start(): Promise<void>;
    stop(): void;
    private showMainMenu;
    private handleMainMenuAction;
    private showDeployMenu;
    private showDestroyMenu;
    private customSearchableSelect;
    private customMultiSelect;
    private refreshStacks;
}
//# sourceMappingURL=InteractiveCDKManager.d.ts.map