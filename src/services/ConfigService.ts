import fs from "fs/promises";
import path from "path";
import chalk from "chalk";

export interface AppConfig {
  autoRefresh: boolean;
  refreshInterval: number;
  defaultAction: "deploy" | "delete" | "info";
  confirmActions: boolean;
  lastUsedVaultProfile?: string;
}

export class ConfigService {
  private configPath: string;
  private defaultConfig: AppConfig = {
    autoRefresh: false,
    refreshInterval: 30,
    defaultAction: "info",
    confirmActions: true,
  };

  constructor(configPath: string) {
    this.configPath = configPath;
  }

  async loadConfig(): Promise<AppConfig> {
    try {
      // Check if config file exists
      await fs.access(this.configPath);

      // Read and parse config file
      const configData = await fs.readFile(this.configPath, "utf-8");
      const userConfig = JSON.parse(configData);

      // Merge with defaults
      const config = { ...this.defaultConfig, ...userConfig };

      console.log(
        chalk.gray(`📁 Loaded configuration from: ${this.configPath}`)
      );

      return config;
    } catch (error) {
      // Config file doesn't exist or is invalid, use defaults without creating file
      console.log(chalk.gray(`📁 Using default configuration`));

      return this.defaultConfig;
    }
  }

  async saveConfig(config: AppConfig): Promise<void> {
    try {
      // Ensure directory exists
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });

      // Write config file
      await fs.writeFile(
        this.configPath,
        JSON.stringify(config, null, 2),
        "utf-8"
      );

      console.log(chalk.green(`✅ Configuration saved to: ${this.configPath}`));
    } catch (error) {
      console.error(
        chalk.red(
          `❌ Failed to save configuration: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      );
      throw error;
    }
  }

  async updateConfig(updates: Partial<AppConfig>): Promise<AppConfig> {
    const currentConfig = await this.loadConfig();
    const updatedConfig = { ...currentConfig, ...updates };

    await this.saveConfig(updatedConfig);

    return updatedConfig;
  }

  getDefaultConfig(): AppConfig {
    return { ...this.defaultConfig };
  }

  async getLastUsedVaultProfile(): Promise<string | undefined> {
    try {
      const config = await this.loadConfig();
      return config.lastUsedVaultProfile;
    } catch (error) {
      return undefined;
    }
  }

  async setLastUsedVaultProfile(profileName: string): Promise<void> {
    try {
      const config = await this.loadConfig();
      config.lastUsedVaultProfile = profileName;
      await this.saveConfig(config);
    } catch (error) {
      // If we can't save, just ignore it - this is not critical
      console.log(chalk.gray("Could not save last used profile"));
    }
  }

  validateConfig(config: any): config is AppConfig {
    return (
      typeof config === "object" &&
      config !== null &&
      typeof config.autoRefresh === "boolean" &&
      typeof config.refreshInterval === "number" &&
      config.refreshInterval > 0 &&
      ["deploy", "delete", "info"].includes(config.defaultAction) &&
      typeof config.confirmActions === "boolean" &&
      (config.lastUsedVaultProfile === undefined ||
        typeof config.lastUsedVaultProfile === "string")
    );
  }
}
