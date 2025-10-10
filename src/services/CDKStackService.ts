import {
  CloudFormationClient,
  DeleteStackCommand,
  DescribeStacksCommand,
  ListStacksCommand,
  StackStatus,
} from "@aws-sdk/client-cloudformation";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import chalk from "chalk";
import ora from "ora";
import * as fs from "fs";
import * as path from "path";
import { CDKCommandExecutor, CDKCommandOptions } from "./CDKCommandExecutor";
import { AWSVaultService, VaultSession } from "./AWSVaultService";

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

export class CDKStackService {
  private cloudFormationClient!: CloudFormationClient;
  private stsClient!: STSClient;
  private cdkExecutor: CDKCommandExecutor;
  private vaultService: AWSVaultService;
  private config: CDKServiceConfig;
  private currentSession: VaultSession | null = null;

  constructor(config: CDKServiceConfig) {
    this.config = config;
    this.cdkExecutor = new CDKCommandExecutor({
      verbose: config.verbose,
      appPath: config.appPath,
    });
    this.vaultService = new AWSVaultService();

    // Initialize AWS clients - will be updated when vault session is set
    this.initializeClients();
  }

  async initializeCDKProject(): Promise<void> {
    // Try to find CDK project directory
    const cdkProjectDir = await this.cdkExecutor.findCDKProjectDirectory();
    if (cdkProjectDir) {
      // Update the executor with the found directory (don't search again)
      this.cdkExecutor = new CDKCommandExecutor({
        verbose: this.config.verbose,
        workingDirectory: cdkProjectDir,
        skipProjectDetection: true, // Don't search for project directory again
        vaultProfile: this.cdkExecutor.getConfig()?.vaultProfile, // Preserve vault profile
        appPath: this.config.appPath, // Preserve app path
      });

      if (this.config.verbose) {
        console.log(chalk.green(`✅ Found CDK project in: ${cdkProjectDir}`));
      }
    } else {
      if (this.config.verbose) {
        console.log(
          chalk.yellow(
            `⚠️  No CDK project found. Please run from a directory containing cdk.json`
          )
        );
      }
    }
  }

  private initializeClients(): void {
    const clientConfig: any = {
      region: this.config.region, // Always use the user-selected region
    };

    // Use vault session credentials if available, otherwise use profile
    if (this.currentSession) {
      // Ensure all required credential fields are present
      if (
        !this.currentSession.credentials.accessKeyId ||
        !this.currentSession.credentials.secretAccessKey
      ) {
        console.error(
          chalk.red(
            "❌ Invalid vault session credentials: missing access key or secret key"
          )
        );
        return;
      }

      clientConfig.credentials = {
        accessKeyId: this.currentSession.credentials.accessKeyId,
        secretAccessKey: this.currentSession.credentials.secretAccessKey,
        ...(this.currentSession.credentials.sessionToken && {
          sessionToken: this.currentSession.credentials.sessionToken,
        }),
      };

      if (this.config.verbose) {
        console.log(chalk.gray(`🔑 Using vault session credentials:`));
        console.log(
          chalk.gray(
            `   Access Key ID: ${this.currentSession.credentials.accessKeyId.substring(
              0,
              8
            )}...`
          )
        );
        console.log(
          chalk.gray(
            `   Session Token: ${
              this.currentSession.credentials.sessionToken
                ? "Present"
                : "Not present"
            }`
          )
        );
        console.log(
          chalk.gray(
            `   Expiration: ${
              this.currentSession.credentials.expiration?.toLocaleString() ||
              "Unknown"
            }`
          )
        );
        console.log(chalk.gray(`   Region: ${clientConfig.region}`));
      }
    } else if (this.config.profile !== "default") {
      clientConfig.credentials = this.getCredentialsFromProfile(
        this.config.profile
      );
    }

    this.cloudFormationClient = new CloudFormationClient(clientConfig);
    this.stsClient = new STSClient(clientConfig);
  }

  async setVaultSession(session: VaultSession): Promise<void> {
    this.currentSession = session;
    this.initializeClients();

    // Update CDK executor with vault profile
    this.cdkExecutor = new CDKCommandExecutor({
      verbose: this.config.verbose,
      workingDirectory: this.cdkExecutor.getConfig()?.workingDirectory,
      skipProjectDetection: true,
      vaultProfile: session.profile,
      appPath: this.config.appPath, // Preserve app path
    });

    if (this.config.verbose) {
      console.log(
        chalk.green(`✅ Using AWS Vault session: ${session.profile}`)
      );
      // Remove region display - CDK will handle region determination
      if (session.credentials.expiration) {
        console.log(
          chalk.gray(
            `Expires: ${session.credentials.expiration.toLocaleString()}`
          )
        );
      }
    }
  }

  getCurrentSession(): VaultSession | null {
    return this.currentSession;
  }

  async loginWithVault(
    profileName: string,
    duration?: number
  ): Promise<boolean> {
    try {
      const session = await this.vaultService.loginWithVault(
        profileName,
        duration
      );
      if (session) {
        await this.setVaultSession(session);
        return true;
      }
      return false;
    } catch (error) {
      console.error(
        chalk.red("Failed to login with AWS Vault:"),
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }

  async listVaultProfiles(): Promise<any[]> {
    return await this.vaultService.listProfiles();
  }

  async checkVaultInstalled(): Promise<boolean> {
    return await this.vaultService.checkVaultInstalled();
  }

  async setDirectCredentials(credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    sessionToken?: string;
  }): Promise<void> {
    // Set environment variables for direct credentials
    process.env.AWS_ACCESS_KEY_ID = credentials.accessKeyId;
    process.env.AWS_SECRET_ACCESS_KEY = credentials.secretAccessKey;
    process.env.AWS_DEFAULT_REGION = credentials.region;

    if (credentials.sessionToken) {
      process.env.AWS_SESSION_TOKEN = credentials.sessionToken;
    }

    // Create a mock vault session for tracking purposes only
    const session: VaultSession = {
      profile: "direct-credentials",
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
      region: credentials.region,
    };

    this.currentSession = session;
    this.initializeClients();

    // Update CDK executor WITHOUT vault profile (use environment variables)
    this.cdkExecutor = new CDKCommandExecutor({
      verbose: this.config.verbose,
      workingDirectory: this.cdkExecutor.getConfig()?.workingDirectory,
      skipProjectDetection: true,
      appPath: this.config.appPath, // Preserve app path
      // Don't set vaultProfile - this will make it use environment variables
    });

    if (this.config.verbose) {
      console.log(
        chalk.green(`✅ Using AWS Vault session: ${session.profile}`)
      );
      console.log(
        chalk.gray(
          `Session Token: ${
            credentials.sessionToken ? "Present" : "Not present"
          }`
        )
      );
      console.log(chalk.gray(`Expiration: Unknown`));
      console.log(chalk.gray(`Region: ${credentials.region}`));
    }
  }

  private getCredentialsFromProfile(profile: string) {
    // This is a simplified approach - in production, you'd want to use AWS SDK's credential chain
    // For now, we'll rely on AWS CLI configuration
    return undefined;
  }

  async verifyConnection(): Promise<boolean> {
    try {
      const spinner = ora("Verifying AWS connection...").start();

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Connection timeout after 10 seconds")),
          10000
        );
      });

      const command = new GetCallerIdentityCommand({});
      const resultPromise = this.stsClient.send(command);

      const result = await Promise.race([resultPromise, timeoutPromise]);

      spinner.succeed(`Connected as: ${chalk.green(result.Arn)}`);

      if (this.config.verbose) {
        console.log(chalk.gray(`Account ID: ${result.Account}`));
        console.log(chalk.gray(`User ID: ${result.UserId}`));
      }

      return true;
    } catch (error) {
      ora().fail(
        `Failed to connect to AWS: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  }

  async listCDKStacks(): Promise<CDKStack[]> {
    try {
      const spinner = ora("Fetching CDK stacks...").start();

      spinner.text = "Fetching CDK stacks...";

      // Use CDK CLI to list stacks (like 'cdk ls')
      const stackInfo = await this.cdkExecutor.listStacks();

      if (stackInfo.length === 0) {
        spinner.succeed("No CDK stacks found");
        return [];
      }

      spinner.text = `Found ${stackInfo.length} CDK stacks, fetching details...`;

      // Get detailed information for each stack
      const detailedStacks: CDKStack[] = [];

      for (const stack of stackInfo) {
        try {
          const stackDetails = await this.getStackDetails(
            stack.fullName,
            stack.cfStackName
          );
          if (stackDetails) {
            // Stack exists in CloudFormation
            detailedStacks.push(stackDetails);
          } else {
            // Stack doesn't exist in CloudFormation (not deployed yet)
            detailedStacks.push({
              stackName: stack.fullName,
              stackStatus: "NOT_DEPLOYED" as any,
              creationTime: new Date(),
              lastUpdatedTime: new Date(),
              description: "CDK Stack (not deployed)",
              tags: {},
            });
          }
        } catch (error) {
          // If we can't get details due to an error, create a basic stack entry
          detailedStacks.push({
            stackName: stack.fullName,
            stackStatus: "UNKNOWN" as any,
            creationTime: new Date(),
            lastUpdatedTime: new Date(),
            description: "CDK Stack (details unavailable)",
            tags: {},
          });
        }
      }

      // Count deployed vs undeployed stacks
      const deployedCount = detailedStacks.filter(
        (stack) => stack.stackId !== undefined
      ).length;
      const undeployedCount = detailedStacks.length - deployedCount;

      spinner.succeed(
        `Found ${detailedStacks.length} CDK stacks (${deployedCount} deployed, ${undeployedCount} not deployed)`
      );
      return detailedStacks;
    } catch (error) {
      ora().fail(
        `Failed to list CDK stacks: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return [];
    }
  }

  async getCDKStackNames(): Promise<
    { displayName: string; fullName: string; cfStackName: string }[]
  > {
    try {
      return await this.cdkExecutor.listStacks();
    } catch (error) {
      console.error(
        chalk.red("Failed to get CDK stack names:"),
        error instanceof Error ? error.message : String(error)
      );
      return [];
    }
  }

  private async getStackDetails(
    stackName: string,
    cfStackName: string
  ): Promise<CDKStack | null> {
    try {
      if (this.config.verbose) {
        console.log(
          chalk.gray(
            `🔍 Looking for CloudFormation stack: ${cfStackName} (from CDK: ${stackName}) in region: ${this.config.region}`
          )
        );
        console.log(
          chalk.gray(`🔑 Using AWS SDK CloudFormation client with credentials`)
        );
        if (this.currentSession) {
          console.log(chalk.gray(`   Profile: ${this.currentSession.profile}`));
          console.log(chalk.gray(`   Region: ${this.currentSession.region}`));
          console.log(
            chalk.gray(
              `   Access Key ID: ${this.currentSession.credentials.accessKeyId.substring(
                0,
                8
              )}...`
            )
          );
        }
      }

      // Try the primary region first
      let command = new DescribeStacksCommand({
        StackName: cfStackName,
      });

      let response;

      try {
        response = await this.cloudFormationClient.send(command);
        if (response.Stacks && response.Stacks.length > 0) {
          const stack = response.Stacks[0];
          return {
            stackName: stackName!,
            stackId: stack.StackId,
            stackStatus: stack.StackStatus!,
            creationTime: new Date(stack.CreationTime!),
            lastUpdatedTime: stack.LastUpdatedTime
              ? new Date(stack.LastUpdatedTime)
              : undefined,
            description: stack.Description,
            tags: stack.Tags?.reduce(
              (acc: Record<string, string>, tag: any) => {
                if (tag.Key && tag.Value) {
                  acc[tag.Key] = tag.Value;
                }
                return acc;
              },
              {} as Record<string, string>
            ),
          };
        }
      } catch (error) {
        // Stack not found - only log in verbose mode
        if (this.config.verbose) {
          console.log(
            chalk.gray(
              `🔍 Stack not found in ${this.config.region}: ${
                error instanceof Error ? error.message : String(error)
              }`
            )
          );
        }
      }

      return null;
    } catch (error) {
      if (this.config.verbose) {
        console.log(
          chalk.red(
            `❌ Error checking CloudFormation stack ${cfStackName}:`,
            error instanceof Error ? error.message : String(error)
          )
        );
      }
      return null;
    }
  }

  async listStacks(): Promise<CDKStack[]> {
    // Use the new CDK-specific method that uses 'cdk ls'
    return await this.listCDKStacks();
  }

  async listAllCloudFormationStacks(): Promise<void> {
    try {
      console.log(
        chalk.blue(
          `🔍 Listing all CloudFormation stacks in region: ${this.config.region}`
        )
      );

      const command = new ListStacksCommand({
        StackStatusFilter: [
          "CREATE_COMPLETE",
          "UPDATE_COMPLETE",
          "UPDATE_ROLLBACK_COMPLETE",
          "IMPORT_COMPLETE",
          "IMPORT_ROLLBACK_COMPLETE",
        ],
      });

      const response = await this.cloudFormationClient.send(command);

      if (response.StackSummaries && response.StackSummaries.length > 0) {
        console.log(
          chalk.green(
            `✅ Found ${response.StackSummaries.length} CloudFormation stacks:`
          )
        );
        response.StackSummaries.forEach((stack, index) => {
          console.log(
            chalk.gray(
              `   ${index + 1}. ${stack.StackName} (${stack.StackStatus})`
            )
          );
        });
      } else {
        console.log(
          chalk.yellow(
            `⚠️  No CloudFormation stacks found in region: ${this.config.region}`
          )
        );
      }
    } catch (error) {
      console.log(
        chalk.red(`❌ Error listing CloudFormation stacks:`),
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private isCDKStack(stackName: string): boolean {
    // CDK stacks typically have patterns like:
    // - StackName-Environment (e.g., MyApp-Prod)
    // - StackName-Environment-RandomSuffix (e.g., MyApp-Prod-ABC123)
    // - Or contain CDK-specific tags

    // For now, we'll consider all stacks as potential CDK stacks
    // In a more sophisticated implementation, you could check for CDK-specific tags
    return true;
  }

  async deployStack(stackName: string | string[]): Promise<boolean> {
    try {
      // Check if CDK CLI is available
      const cdkInstalled = await this.cdkExecutor.checkCDKInstalled();
      if (!cdkInstalled) {
        const spinner = ora("CDK CLI not found").fail();
        console.log(
          chalk.yellow("⚠️  AWS CDK CLI is not installed or not in PATH.")
        );
        console.log(
          chalk.gray("Please install it using: npm install -g aws-cdk")
        );
        return false;
      }

      const options: CDKCommandOptions = {
        stackName,
        profile:
          this.config.profile !== "default" ? this.config.profile : undefined,
        region: this.config.region, // Pass the selected region
        verbose: this.config.verbose,
        requireApproval: false, // For automated deployment
      };

      return await this.cdkExecutor.deployStack(options);
    } catch (error) {
      ora().fail(
        `Failed to deploy stack: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  }

  async deleteStack(stackName: string): Promise<boolean> {
    try {
      const spinner = ora(`Deleting stack: ${stackName}`).start();

      const command = new DeleteStackCommand({
        StackName: stackName,
      });

      await this.cloudFormationClient.send(command);

      spinner.succeed(`Stack deletion initiated: ${stackName}`);
      spinner.info("Monitor CloudFormation console for progress");

      return true;
    } catch (error) {
      ora().fail(
        `Failed to delete stack: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  }

  async destroyStack(stackName: string | string[]): Promise<boolean> {
    try {
      // Check if CDK CLI is available
      const cdkInstalled = await this.cdkExecutor.checkCDKInstalled();
      if (!cdkInstalled) {
        const spinner = ora("CDK CLI not found").fail();
        console.log(
          chalk.yellow("⚠️  AWS CDK CLI is not installed or not in PATH.")
        );
        console.log(
          chalk.gray("Please install it using: npm install -g aws-cdk")
        );
        return false;
      }

      const options: CDKCommandOptions = {
        stackName,
        profile:
          this.config.profile !== "default" ? this.config.profile : undefined,
        region: this.config.region, // Pass the selected region
        verbose: this.config.verbose,
        requireApproval: false, // For automated deployment
      };

      return await this.cdkExecutor.destroyStack(options);
    } catch (error) {
      ora().fail(
        `Failed to destroy stack: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  }

  getStackStatusColor(status: StackStatus): string {
    switch (status) {
      case "CREATE_COMPLETE":
      case "UPDATE_COMPLETE":
        return "green";
      case "CREATE_FAILED":
      case "UPDATE_FAILED":
      case "UPDATE_ROLLBACK_FAILED":
      case "DELETE_FAILED":
      case "ROLLBACK_FAILED":
        return "red";
      case "CREATE_IN_PROGRESS":
      case "UPDATE_IN_PROGRESS":
      case "UPDATE_ROLLBACK_IN_PROGRESS":
      case "ROLLBACK_IN_PROGRESS":
      case "DELETE_IN_PROGRESS":
        return "yellow";
      case "ROLLBACK_COMPLETE":
      case "UPDATE_ROLLBACK_COMPLETE":
        return "orange";
      default:
        return "gray";
    }
  }

  getStackStatusWithEmoji(status: StackStatus): {
    emoji: string;
    color: string;
    text: string;
  } {
    switch (status) {
      case "CREATE_COMPLETE":
        return { emoji: "✅", color: "green", text: "Active" };
      case "UPDATE_COMPLETE":
        return { emoji: "✅", color: "green", text: "Updated" };
      case "CREATE_FAILED":
        return { emoji: "❌", color: "red", text: "Create Failed" };
      case "UPDATE_FAILED":
        return { emoji: "❌", color: "red", text: "Update Failed" };
      case "UPDATE_ROLLBACK_FAILED":
        return { emoji: "❌", color: "red", text: "Rollback Failed" };
      case "DELETE_FAILED":
        return { emoji: "❌", color: "red", text: "Delete Failed" };
      case "ROLLBACK_FAILED":
        return { emoji: "❌", color: "red", text: "Rollback Failed" };
      case "CREATE_IN_PROGRESS":
        return { emoji: "🔄", color: "yellow", text: "Creating" };
      case "UPDATE_IN_PROGRESS":
        return { emoji: "🔄", color: "yellow", text: "Updating" };
      case "UPDATE_ROLLBACK_IN_PROGRESS":
        return { emoji: "🔄", color: "yellow", text: "Rolling Back" };
      case "ROLLBACK_IN_PROGRESS":
        return { emoji: "🔄", color: "yellow", text: "Rolling Back" };
      case "DELETE_IN_PROGRESS":
        return { emoji: "🗑️", color: "yellow", text: "Deleting" };
      case "ROLLBACK_COMPLETE":
        return { emoji: "⚠️", color: "orange", text: "Rolled Back" };
      case "UPDATE_ROLLBACK_COMPLETE":
        return { emoji: "⚠️", color: "orange", text: "Rolled Back" };
      case "DELETE_COMPLETE":
        return { emoji: "🗑️", color: "gray", text: "Deleted" };
      case "REVIEW_IN_PROGRESS":
        return { emoji: "👀", color: "blue", text: "Reviewing" };
      case "IMPORT_IN_PROGRESS":
        return { emoji: "📥", color: "blue", text: "Importing" };
      case "IMPORT_COMPLETE":
        return { emoji: "✅", color: "green", text: "Imported" };
      case "IMPORT_ROLLBACK_IN_PROGRESS":
        return { emoji: "🔄", color: "yellow", text: "Import Rolling Back" };
      case "IMPORT_ROLLBACK_FAILED":
        return { emoji: "❌", color: "red", text: "Import Rollback Failed" };
      case "IMPORT_ROLLBACK_COMPLETE":
        return { emoji: "⚠️", color: "orange", text: "Import Rolled Back" };
      default:
        return { emoji: "❓", color: "gray", text: status };
    }
  }

  formatStackInfo(stack: CDKStack): string {
    const statusColor = this.getStackStatusColor(stack.stackStatus);

    // Use explicit color functions instead of dynamic access
    let statusText: string;
    switch (statusColor) {
      case "green":
        statusText = chalk.green(stack.stackStatus);
        break;
      case "red":
        statusText = chalk.red(stack.stackStatus);
        break;
      case "yellow":
        statusText = chalk.yellow(stack.stackStatus);
        break;
      case "blue":
        statusText = chalk.blue(stack.stackStatus);
        break;
      default:
        statusText = chalk.gray(stack.stackStatus);
        break;
    }

    let info = `${chalk.bold(stack.stackName)} - ${statusText}`;

    if (stack.description) {
      info += `\n  ${chalk.gray(stack.description)}`;
    }

    info += `\n  Created: ${chalk.gray(stack.creationTime.toLocaleString())}`;

    if (stack.lastUpdatedTime) {
      info += `\n  Updated: ${chalk.gray(
        stack.lastUpdatedTime.toLocaleString()
      )}`;
    }

    if (stack.tags && Object.keys(stack.tags).length > 0) {
      info += `\n  Tags: ${chalk.gray(
        Object.entries(stack.tags)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")
      )}`;
    }

    return info;
  }
}
