import { StackStatus } from "@aws-sdk/client-cloudformation";
import { VaultSession } from "./AWSVaultService";
export interface CDKStack {
    stackName: string;
    stackId?: string;
    stackStatus: StackStatus;
    creationTime: Date;
    lastUpdatedTime?: Date;
    description?: string;
    tags?: Record<string, string>;
}
export interface CDKServiceConfig {
    profile: string;
    region: string;
    verbose: boolean;
    appPath?: string;
}
export declare class CDKStackService {
    private cloudFormationClient;
    private stsClient;
    private cdkExecutor;
    private vaultService;
    private config;
    private currentSession;
    constructor(config: CDKServiceConfig);
    initializeCDKProject(): Promise<void>;
    private initializeClients;
    setVaultSession(session: VaultSession): Promise<void>;
    getCurrentSession(): VaultSession | null;
    loginWithVault(profileName: string, duration?: number): Promise<boolean>;
    listVaultProfiles(): Promise<any[]>;
    checkVaultInstalled(): Promise<boolean>;
    setDirectCredentials(credentials: {
        accessKeyId: string;
        secretAccessKey: string;
        region: string;
        sessionToken?: string;
    }): Promise<void>;
    private getCredentialsFromProfile;
    verifyConnection(): Promise<boolean>;
    listCDKStacks(): Promise<CDKStack[]>;
    getCDKStackNames(): Promise<{
        displayName: string;
        fullName: string;
        cfStackName: string;
    }[]>;
    private getStackDetails;
    listStacks(): Promise<CDKStack[]>;
    listAllCloudFormationStacks(): Promise<void>;
    private isCDKStack;
    deployStack(stackName: string | string[]): Promise<boolean>;
    deleteStack(stackName: string): Promise<boolean>;
    destroyStack(stackName: string | string[]): Promise<boolean>;
    getStackStatusColor(status: StackStatus): string;
    getStackStatusWithEmoji(status: StackStatus): {
        emoji: string;
        color: string;
        text: string;
    };
    formatStackInfo(stack: CDKStack): string;
}
//# sourceMappingURL=CDKStackService.d.ts.map