export interface AWSProfile {
    name: string;
    region?: string;
    sourceProfile?: string;
    roleArn?: string;
    mfaSerial?: string;
    duration?: number;
    ssoStartUrl?: string;
    ssoAccountId?: string;
    ssoRoleName?: string;
}
export interface VaultSession {
    profile: string;
    credentials: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
        expiration?: Date;
    };
    region: string;
}
export declare class AWSVaultService {
    private awsConfigPath;
    private awsCredentialsPath;
    private vaultInstalled;
    constructor();
    checkVaultInstalled(): Promise<boolean>;
    listProfiles(): Promise<AWSProfile[]>;
    private parseAWSConfig;
    private parseAWSCredentials;
    private deduplicateProfiles;
    loginWithVault(profileName: string, duration?: number): Promise<VaultSession | null>;
    private getTemporaryCredentials;
    private getProfileRegion;
    assumeRole(profileName: string, roleArn: string, duration?: number): Promise<VaultSession | null>;
    getVaultVersion(): Promise<string | null>;
    private executeCommandWithPath;
    private executeCommand;
    formatProfileInfo(profile: AWSProfile): string;
}
//# sourceMappingURL=AWSVaultService.d.ts.map