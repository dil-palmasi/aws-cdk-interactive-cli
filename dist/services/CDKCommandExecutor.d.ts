export interface CDKCommandOptions {
    stackName?: string | string[];
    profile?: string;
    region?: string;
    parameters?: Record<string, string>;
    tags?: Record<string, string>;
    requireApproval?: boolean;
    verbose?: boolean;
}
export interface CDKExecutorConfig {
    verbose?: boolean;
    workingDirectory?: string;
    skipProjectDetection?: boolean;
    vaultProfile?: string;
    appPath?: string;
}
export declare class CDKCommandExecutor {
    private _cdkPath;
    private config?;
    get cdkPath(): string;
    constructor(config?: CDKExecutorConfig);
    getConfig(): CDKExecutorConfig | undefined;
    private shouldStopSpinner;
    findCDKProjectDirectory(): Promise<string | null>;
    private findCDKPath;
    deployStack(options: CDKCommandOptions): Promise<boolean>;
    destroyStack(options: CDKCommandOptions): Promise<boolean>;
    listStacks(): Promise<{
        displayName: string;
        fullName: string;
        cfStackName: string;
    }[]>;
    synthStack(stackName?: string): Promise<boolean>;
    private executeCommand;
    checkCDKInstalled(): Promise<boolean>;
    private executeCommandWithRealTimeOutput;
    getCDKVersion(): Promise<string | null>;
}
//# sourceMappingURL=CDKCommandExecutor.d.ts.map