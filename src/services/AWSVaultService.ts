import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";
import chalk from "chalk";
import ora from "ora";
import { execSync } from "child_process";

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

export class AWSVaultService {
  private awsConfigPath: string;
  private awsCredentialsPath: string;
  private vaultInstalled: boolean | null = null;

  constructor() {
    const homeDir = os.homedir();
    this.awsConfigPath = path.join(homeDir, ".aws", "config");
    this.awsCredentialsPath = path.join(homeDir, ".aws", "credentials");
  }

  async checkVaultInstalled(): Promise<boolean> {
    if (this.vaultInstalled !== null) {
      return this.vaultInstalled;
    }

    try {
      // First try to find aws-vault using which command
      let awsVaultPath = "aws-vault";
      try {
        awsVaultPath = execSync("which aws-vault", { encoding: "utf8" }).trim();
      } catch (error) {
        // Fallback to common paths
        const commonPaths = [
          "/opt/homebrew/bin/aws-vault",
          "/usr/local/bin/aws-vault",
          "/usr/bin/aws-vault",
        ];

        for (const path of commonPaths) {
          try {
            execSync(`test -f ${path}`, { encoding: "utf8" });
            awsVaultPath = path;
            break;
          } catch (e) {
            // Continue to next path
          }
        }
      }

      // Test if the found path works
      const result = await this.executeCommandWithPath(awsVaultPath, [
        "--version",
      ]);
      this.vaultInstalled = result.success;
      return this.vaultInstalled;
    } catch (error) {
      this.vaultInstalled = false;
      return false;
    }
  }

  async listProfiles(): Promise<AWSProfile[]> {
    try {
      const profiles: AWSProfile[] = [];

      // Check if AWS config file exists
      try {
        await fs.access(this.awsConfigPath);
        const configContent = await fs.readFile(this.awsConfigPath, "utf-8");
        const configProfiles = this.parseAWSConfig(configContent);
        profiles.push(...configProfiles);
      } catch (error) {
        // Config file doesn't exist, that's okay
      }

      // Check if AWS credentials file exists
      try {
        await fs.access(this.awsCredentialsPath);
        const credentialsContent = await fs.readFile(
          this.awsCredentialsPath,
          "utf-8"
        );
        const credentialProfiles = this.parseAWSCredentials(credentialsContent);
        profiles.push(...credentialProfiles);
      } catch (error) {
        // Credentials file doesn't exist, that's okay
      }

      // Remove duplicates and sort
      const uniqueProfiles = this.deduplicateProfiles(profiles);
      return uniqueProfiles.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error(
        chalk.red("Failed to list AWS profiles:"),
        error instanceof Error ? error.message : String(error)
      );
      return [];
    }
  }

  private parseAWSConfig(content: string): AWSProfile[] {
    const profiles: AWSProfile[] = [];
    const lines = content.split("\n");
    let currentProfile: AWSProfile | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith("[profile ")) {
        // Save previous profile if exists
        if (currentProfile) {
          profiles.push(currentProfile);
        }

        // Start new profile
        const profileName = trimmedLine.slice(9, -1); // Remove "[profile " and "]"
        currentProfile = { name: profileName };
      } else if (trimmedLine.startsWith("[") && trimmedLine.endsWith("]")) {
        // Save previous profile if exists
        if (currentProfile) {
          profiles.push(currentProfile);
        }

        // Start new profile (without "profile" prefix)
        const profileName = trimmedLine.slice(1, -1);
        currentProfile = { name: profileName };
      } else if (currentProfile && trimmedLine.includes("=")) {
        const [key, value] = trimmedLine.split("=", 2);
        const keyName = key.trim();
        const valueStr = value.trim();

        switch (keyName) {
          case "region":
            currentProfile.region = valueStr;
            break;
          case "source_profile":
            currentProfile.sourceProfile = valueStr;
            break;
          case "role_arn":
            currentProfile.roleArn = valueStr;
            break;
          case "mfa_serial":
            currentProfile.mfaSerial = valueStr;
            break;
          case "duration_seconds":
            currentProfile.duration = parseInt(valueStr, 10);
            break;
        }
      }
    }

    // Add the last profile
    if (currentProfile) {
      profiles.push(currentProfile);
    }

    return profiles;
  }

  private parseAWSCredentials(content: string): AWSProfile[] {
    const profiles: AWSProfile[] = [];
    const lines = content.split("\n");
    let currentProfile: AWSProfile | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith("[") && trimmedLine.endsWith("]")) {
        // Save previous profile if exists
        if (currentProfile) {
          profiles.push(currentProfile);
        }

        // Start new profile
        const profileName = trimmedLine.slice(1, -1);
        currentProfile = { name: profileName };
      } else if (currentProfile && trimmedLine.includes("=")) {
        const [key, value] = trimmedLine.split("=", 2);
        const keyName = key.trim();
        const valueStr = value.trim();

        // We don't store actual credentials, just note that this profile exists
        if (
          keyName === "aws_access_key_id" ||
          keyName === "aws_secret_access_key"
        ) {
          // Profile exists, we already have it
        }
      }
    }

    // Add the last profile
    if (currentProfile) {
      profiles.push(currentProfile);
    }

    return profiles;
  }

  private deduplicateProfiles(profiles: AWSProfile[]): AWSProfile[] {
    const profileMap = new Map<string, AWSProfile>();

    for (const profile of profiles) {
      if (!profileMap.has(profile.name)) {
        profileMap.set(profile.name, profile);
      } else {
        // Merge properties if profile exists
        const existing = profileMap.get(profile.name)!;
        profileMap.set(profile.name, { ...existing, ...profile });
      }
    }

    return Array.from(profileMap.values());
  }

  async loginWithVault(
    profileName: string,
    duration?: number
  ): Promise<VaultSession | null> {
    try {
      const spinner = ora(`Logging in with AWS Vault: ${profileName}`).start();

      const args = [
        "exec",
        profileName,
        "--",
        "aws",
        "sts",
        "get-caller-identity",
      ];

      if (duration) {
        args.splice(1, 0, "--duration", duration.toString());
      }

      const result = await this.executeCommand(args, spinner);

      if (!result.success) {
        spinner.fail(`Failed to login with AWS Vault: ${profileName}`);
        if (result.error) {
          console.error(chalk.red("Error details:"), result.error);
        }
        return null;
      }

      // Parse the caller identity response
      const callerIdentity = JSON.parse(result.output || "{}");

      // Get temporary credentials
      const credentialsResult = await this.getTemporaryCredentials(
        profileName,
        duration
      );

      if (!credentialsResult) {
        spinner.fail(`Failed to get temporary credentials for: ${profileName}`);
        return null;
      }

      const session: VaultSession = {
        profile: profileName,
        credentials: credentialsResult,
        region: (await this.getProfileRegion(profileName)) || "us-east-1",
      };

      spinner.succeed(`Successfully logged in with AWS Vault: ${profileName}`);
      console.log(chalk.green(`✅ Account: ${callerIdentity.Account}`));
      console.log(chalk.green(`✅ User: ${callerIdentity.Arn}`));

      return session;
    } catch (error) {
      ora().fail(
        `Failed to login with AWS Vault: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  }

  private async getTemporaryCredentials(
    profileName: string,
    duration?: number
  ): Promise<VaultSession["credentials"] | null> {
    try {
      // Use AWS Vault export to get actual credentials
      const args = ["export", profileName, "--format", "json"];

      const result = await this.executeCommand(args);

      if (!result.success || !result.output) {
        return null;
      }

      const credentials = JSON.parse(result.output);

      const credentialResult = {
        accessKeyId: credentials.AccessKeyId,
        secretAccessKey: credentials.SecretAccessKey,
        sessionToken: credentials.SessionToken,
        expiration: new Date(credentials.Expiration),
      };

      return credentialResult;
    } catch (error) {
      console.error(
        chalk.red("Failed to get temporary credentials:"),
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  private async getProfileRegion(profileName: string): Promise<string | null> {
    try {
      const profiles = await this.listProfiles();
      const profile = profiles.find((p) => p.name === profileName);
      return profile?.region || null;
    } catch (error) {
      return null;
    }
  }

  async assumeRole(
    profileName: string,
    roleArn: string,
    duration?: number
  ): Promise<VaultSession | null> {
    try {
      const spinner = ora(
        `Assuming role ${roleArn} with profile ${profileName}`
      ).start();

      const args = ["exec", profileName, "--", "aws", "sts", "assume-role"];
      args.push("--role-arn", roleArn);
      args.push("--role-session-name", `cdk-interactive-${Date.now()}`);

      if (duration) {
        args.push("--duration-seconds", duration.toString());
      }

      const result = await this.executeCommand(args, spinner);

      if (!result.success) {
        spinner.fail(`Failed to assume role: ${roleArn}`);
        if (result.error) {
          console.error(chalk.red("Error details:"), result.error);
        }
        return null;
      }

      const response = JSON.parse(result.output || "{}");

      const session: VaultSession = {
        profile: profileName,
        credentials: {
          accessKeyId: response.Credentials.AccessKeyId,
          secretAccessKey: response.Credentials.SecretAccessKey,
          sessionToken: response.Credentials.SessionToken,
          expiration: new Date(response.Credentials.Expiration),
        },
        region: (await this.getProfileRegion(profileName)) || "us-east-1",
      };

      spinner.succeed(`Successfully assumed role: ${roleArn}`);

      return session;
    } catch (error) {
      ora().fail(
        `Failed to assume role: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  }

  async getVaultVersion(): Promise<string | null> {
    try {
      const result = await this.executeCommand(["version"]);
      if (result.success && result.output) {
        return result.output.trim();
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  private async executeCommandWithPath(
    awsVaultPath: string,
    args: string[],
    spinner?: ora.Ora
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    return new Promise((resolve) => {
      const child = spawn(awsVaultPath, args, {
        stdio: ["pipe", "pipe", "pipe"],
        shell: false, // Don't use shell to avoid PATH issues
        env: { ...process.env, PATH: process.env.PATH }, // Preserve PATH
      });

      let output = "";
      let error = "";
      let resolved = false;

      // Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          child.kill("SIGTERM");
          resolve({
            success: false,
            error: "Command timed out after 30 seconds",
          });
        }
      }, 30000);

      child.stdout?.on("data", (data) => {
        const text = data.toString();
        output += text;

        if (spinner && text.includes("MFA")) {
          spinner.text = `MFA required for ${args[1] || "profile"}`;
        }
      });

      child.stderr?.on("data", (data) => {
        const text = data.toString();
        error += text;

        if (spinner && text.includes("Error")) {
          spinner.text = `Error: ${text.trim()}`;
        }
      });

      child.on("close", (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve({
            success: code === 0,
            output: output.trim(),
            error: error.trim(),
          });
        }
      });

      child.on("error", (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve({
            success: false,
            error: err.message,
          });
        }
      });
    });
  }

  private async executeCommand(
    args: string[],
    spinner?: ora.Ora
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    // Dynamically find aws-vault path
    let awsVaultPath = "aws-vault";
    try {
      awsVaultPath = execSync("which aws-vault", { encoding: "utf8" }).trim();
    } catch (error) {
      // Fallback to common paths
      const commonPaths = [
        "/opt/homebrew/bin/aws-vault",
        "/usr/local/bin/aws-vault",
        "/usr/bin/aws-vault",
      ];

      for (const path of commonPaths) {
        try {
          execSync(`test -f ${path}`, { encoding: "utf8" });
          awsVaultPath = path;
          break;
        } catch (e) {
          // Continue to next path
        }
      }
    }

    return this.executeCommandWithPath(awsVaultPath, args, spinner);
  }

  formatProfileInfo(profile: AWSProfile): string {
    let info = chalk.bold(profile.name);

    if (profile.region) {
      info += ` ${chalk.gray(`(${profile.region})`)}`;
    }

    if (profile.ssoStartUrl) {
      info += `\n  ${chalk.cyan("SSO:")} ${chalk.gray(profile.ssoStartUrl)}`;
      if (profile.ssoAccountId && profile.ssoRoleName) {
        info += `\n  ${chalk.cyan("Account:")} ${chalk.gray(
          profile.ssoAccountId
        )}`;
        info += `\n  ${chalk.cyan("Role:")} ${chalk.gray(profile.ssoRoleName)}`;
      }
    }

    if (profile.roleArn) {
      info += `\n  ${chalk.blue("Role:")} ${chalk.gray(profile.roleArn)}`;
    }

    if (profile.sourceProfile) {
      info += `\n  ${chalk.blue("Source:")} ${chalk.gray(
        profile.sourceProfile
      )}`;
    }

    if (profile.mfaSerial) {
      info += `\n  ${chalk.yellow("MFA:")} ${chalk.gray(profile.mfaSerial)}`;
    }

    return info;
  }
}
