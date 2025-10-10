export declare class ValidationUtils {
    static validateAWSProfile(profile: string): boolean;
    static validateAWSRegion(region: string): boolean;
    static validateStackName(stackName: string): boolean;
    static validateConfigPath(configPath: string): boolean;
    static validateRefreshInterval(interval: number): boolean;
    static sanitizeInput(input: string): string;
    static validateCDKAppDirectory(path: string): boolean;
    static validateTags(tags: Record<string, string>): boolean;
    static validateParameters(parameters: Record<string, string>): boolean;
}
//# sourceMappingURL=ValidationUtils.d.ts.map