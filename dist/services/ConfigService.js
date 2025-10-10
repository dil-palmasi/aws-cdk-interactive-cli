"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
class ConfigService {
    constructor(configPath) {
        this.defaultConfig = {
            autoRefresh: false,
            refreshInterval: 30,
            defaultAction: "info",
            confirmActions: true,
        };
        this.configPath = configPath;
    }
    async loadConfig() {
        try {
            // Check if config file exists
            await promises_1.default.access(this.configPath);
            // Read and parse config file
            const configData = await promises_1.default.readFile(this.configPath, "utf-8");
            const userConfig = JSON.parse(configData);
            // Merge with defaults
            const config = { ...this.defaultConfig, ...userConfig };
            console.log(chalk_1.default.gray(`📁 Loaded configuration from: ${this.configPath}`));
            return config;
        }
        catch (error) {
            // Config file doesn't exist or is invalid, use defaults without creating file
            console.log(chalk_1.default.gray(`📁 Using default configuration`));
            return this.defaultConfig;
        }
    }
    async saveConfig(config) {
        try {
            // Ensure directory exists
            const configDir = path_1.default.dirname(this.configPath);
            await promises_1.default.mkdir(configDir, { recursive: true });
            // Write config file
            await promises_1.default.writeFile(this.configPath, JSON.stringify(config, null, 2), "utf-8");
            console.log(chalk_1.default.green(`✅ Configuration saved to: ${this.configPath}`));
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`));
            throw error;
        }
    }
    async updateConfig(updates) {
        const currentConfig = await this.loadConfig();
        const updatedConfig = { ...currentConfig, ...updates };
        await this.saveConfig(updatedConfig);
        return updatedConfig;
    }
    getDefaultConfig() {
        return { ...this.defaultConfig };
    }
    async getLastUsedVaultProfile() {
        try {
            const config = await this.loadConfig();
            return config.lastUsedVaultProfile;
        }
        catch (error) {
            return undefined;
        }
    }
    async setLastUsedVaultProfile(profileName) {
        try {
            const config = await this.loadConfig();
            config.lastUsedVaultProfile = profileName;
            await this.saveConfig(config);
        }
        catch (error) {
            // If we can't save, just ignore it - this is not critical
            console.log(chalk_1.default.gray("Could not save last used profile"));
        }
    }
    validateConfig(config) {
        return (typeof config === "object" &&
            config !== null &&
            typeof config.autoRefresh === "boolean" &&
            typeof config.refreshInterval === "number" &&
            config.refreshInterval > 0 &&
            ["deploy", "delete", "info"].includes(config.defaultAction) &&
            typeof config.confirmActions === "boolean" &&
            (config.lastUsedVaultProfile === undefined ||
                typeof config.lastUsedVaultProfile === "string"));
    }
}
exports.ConfigService = ConfigService;
//# sourceMappingURL=ConfigService.js.map