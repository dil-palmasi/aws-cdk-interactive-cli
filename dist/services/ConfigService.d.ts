export interface AppConfig {
    autoRefresh: boolean;
    refreshInterval: number;
    defaultAction: "deploy" | "delete" | "info";
    confirmActions: boolean;
    lastUsedVaultProfile?: string;
}
export declare class ConfigService {
    private configPath;
    private defaultConfig;
    constructor(configPath: string);
    loadConfig(): Promise<AppConfig>;
    saveConfig(config: AppConfig): Promise<void>;
    updateConfig(updates: Partial<AppConfig>): Promise<AppConfig>;
    getDefaultConfig(): AppConfig;
    getLastUsedVaultProfile(): Promise<string | undefined>;
    setLastUsedVaultProfile(profileName: string): Promise<void>;
    validateConfig(config: any): config is AppConfig;
}
//# sourceMappingURL=ConfigService.d.ts.map