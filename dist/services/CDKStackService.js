"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CDKStackService = void 0;
const client_cloudformation_1 = require("@aws-sdk/client-cloudformation");
const client_sts_1 = require("@aws-sdk/client-sts");
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const CDKCommandExecutor_1 = require("./CDKCommandExecutor");
const AWSVaultService_1 = require("./AWSVaultService");
class CDKStackService {
    constructor(config) {
        this.currentSession = null;
        this.config = config;
        this.cdkExecutor = new CDKCommandExecutor_1.CDKCommandExecutor({
            verbose: config.verbose,
            appPath: config.appPath,
        });
        this.vaultService = new AWSVaultService_1.AWSVaultService();
        // Initialize AWS clients - will be updated when vault session is set
        this.initializeClients();
    }
    async initializeCDKProject() {
        // Try to find CDK project directory
        const cdkProjectDir = await this.cdkExecutor.findCDKProjectDirectory();
        if (cdkProjectDir) {
            // Update the executor with the found directory (don't search again)
            this.cdkExecutor = new CDKCommandExecutor_1.CDKCommandExecutor({
                verbose: this.config.verbose,
                workingDirectory: cdkProjectDir,
                skipProjectDetection: true, // Don't search for project directory again
                vaultProfile: this.cdkExecutor.getConfig()?.vaultProfile, // Preserve vault profile
                appPath: this.config.appPath, // Preserve app path
            });
            if (this.config.verbose) {
                console.log(chalk_1.default.green(`✅ Found CDK project in: ${cdkProjectDir}`));
            }
        }
        else {
            if (this.config.verbose) {
                console.log(chalk_1.default.yellow(`⚠️  No CDK project found. Please run from a directory containing cdk.json`));
            }
        }
    }
    initializeClients() {
        const clientConfig = {
            region: this.config.region, // Always use the user-selected region
        };
        // Use vault session credentials if available, otherwise use profile
        if (this.currentSession) {
            // Ensure all required credential fields are present
            if (!this.currentSession.credentials.accessKeyId ||
                !this.currentSession.credentials.secretAccessKey) {
                console.error(chalk_1.default.red("❌ Invalid vault session credentials: missing access key or secret key"));
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
                console.log(chalk_1.default.gray(`🔑 Using vault session credentials:`));
                console.log(chalk_1.default.gray(`   Access Key ID: ${this.currentSession.credentials.accessKeyId.substring(0, 8)}...`));
                console.log(chalk_1.default.gray(`   Session Token: ${this.currentSession.credentials.sessionToken
                    ? "Present"
                    : "Not present"}`));
                console.log(chalk_1.default.gray(`   Expiration: ${this.currentSession.credentials.expiration?.toLocaleString() ||
                    "Unknown"}`));
                console.log(chalk_1.default.gray(`   Region: ${clientConfig.region}`));
            }
        }
        else if (this.config.profile !== "default") {
            clientConfig.credentials = this.getCredentialsFromProfile(this.config.profile);
        }
        this.cloudFormationClient = new client_cloudformation_1.CloudFormationClient(clientConfig);
        this.stsClient = new client_sts_1.STSClient(clientConfig);
    }
    async setVaultSession(session) {
        this.currentSession = session;
        this.initializeClients();
        // Update CDK executor with vault profile
        this.cdkExecutor = new CDKCommandExecutor_1.CDKCommandExecutor({
            verbose: this.config.verbose,
            workingDirectory: this.cdkExecutor.getConfig()?.workingDirectory,
            skipProjectDetection: true,
            vaultProfile: session.profile,
            appPath: this.config.appPath, // Preserve app path
        });
        if (this.config.verbose) {
            console.log(chalk_1.default.green(`✅ Using AWS Vault session: ${session.profile}`));
            // Remove region display - CDK will handle region determination
            if (session.credentials.expiration) {
                console.log(chalk_1.default.gray(`Expires: ${session.credentials.expiration.toLocaleString()}`));
            }
        }
    }
    getCurrentSession() {
        return this.currentSession;
    }
    async loginWithVault(profileName, duration) {
        try {
            const session = await this.vaultService.loginWithVault(profileName, duration);
            if (session) {
                await this.setVaultSession(session);
                return true;
            }
            return false;
        }
        catch (error) {
            console.error(chalk_1.default.red("Failed to login with AWS Vault:"), error instanceof Error ? error.message : String(error));
            return false;
        }
    }
    async listVaultProfiles() {
        return await this.vaultService.listProfiles();
    }
    async checkVaultInstalled() {
        return await this.vaultService.checkVaultInstalled();
    }
    async setDirectCredentials(credentials) {
        // Set environment variables for direct credentials
        process.env.AWS_ACCESS_KEY_ID = credentials.accessKeyId;
        process.env.AWS_SECRET_ACCESS_KEY = credentials.secretAccessKey;
        process.env.AWS_DEFAULT_REGION = credentials.region;
        if (credentials.sessionToken) {
            process.env.AWS_SESSION_TOKEN = credentials.sessionToken;
        }
        // Create a mock vault session for tracking purposes only
        const session = {
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
        this.cdkExecutor = new CDKCommandExecutor_1.CDKCommandExecutor({
            verbose: this.config.verbose,
            workingDirectory: this.cdkExecutor.getConfig()?.workingDirectory,
            skipProjectDetection: true,
            appPath: this.config.appPath, // Preserve app path
            // Don't set vaultProfile - this will make it use environment variables
        });
        if (this.config.verbose) {
            console.log(chalk_1.default.green(`✅ Using AWS Vault session: ${session.profile}`));
            console.log(chalk_1.default.gray(`Session Token: ${credentials.sessionToken ? "Present" : "Not present"}`));
            console.log(chalk_1.default.gray(`Expiration: Unknown`));
            console.log(chalk_1.default.gray(`Region: ${credentials.region}`));
        }
    }
    getCredentialsFromProfile(profile) {
        // This is a simplified approach - in production, you'd want to use AWS SDK's credential chain
        // For now, we'll rely on AWS CLI configuration
        return undefined;
    }
    async verifyConnection() {
        try {
            const spinner = (0, ora_1.default)("Verifying AWS connection...").start();
            // Add timeout to prevent hanging
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error("Connection timeout after 10 seconds")), 10000);
            });
            const command = new client_sts_1.GetCallerIdentityCommand({});
            const resultPromise = this.stsClient.send(command);
            const result = await Promise.race([resultPromise, timeoutPromise]);
            spinner.succeed(`Connected as: ${chalk_1.default.green(result.Arn)}`);
            if (this.config.verbose) {
                console.log(chalk_1.default.gray(`Account ID: ${result.Account}`));
                console.log(chalk_1.default.gray(`User ID: ${result.UserId}`));
            }
            return true;
        }
        catch (error) {
            (0, ora_1.default)().fail(`Failed to connect to AWS: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }
    async listCDKStacks() {
        try {
            const spinner = (0, ora_1.default)("Fetching CDK stacks...").start();
            spinner.text = "Fetching CDK stacks...";
            // Use CDK CLI to list stacks (like 'cdk ls')
            const stackInfo = await this.cdkExecutor.listStacks();
            if (stackInfo.length === 0) {
                spinner.succeed("No CDK stacks found");
                return [];
            }
            spinner.text = `Found ${stackInfo.length} CDK stacks, fetching details...`;
            // Get detailed information for each stack
            const detailedStacks = [];
            for (const stack of stackInfo) {
                try {
                    const stackDetails = await this.getStackDetails(stack.fullName, stack.cfStackName);
                    if (stackDetails) {
                        // Stack exists in CloudFormation
                        detailedStacks.push(stackDetails);
                    }
                    else {
                        // Stack doesn't exist in CloudFormation (not deployed yet)
                        detailedStacks.push({
                            stackName: stack.fullName,
                            stackStatus: "NOT_DEPLOYED",
                            creationTime: new Date(),
                            lastUpdatedTime: new Date(),
                            description: "CDK Stack (not deployed)",
                            tags: {},
                        });
                    }
                }
                catch (error) {
                    // If we can't get details due to an error, create a basic stack entry
                    detailedStacks.push({
                        stackName: stack.fullName,
                        stackStatus: "UNKNOWN",
                        creationTime: new Date(),
                        lastUpdatedTime: new Date(),
                        description: "CDK Stack (details unavailable)",
                        tags: {},
                    });
                }
            }
            // Count deployed vs undeployed stacks
            const deployedCount = detailedStacks.filter((stack) => stack.stackId !== undefined).length;
            const undeployedCount = detailedStacks.length - deployedCount;
            spinner.succeed(`Found ${detailedStacks.length} CDK stacks (${deployedCount} deployed, ${undeployedCount} not deployed)`);
            return detailedStacks;
        }
        catch (error) {
            (0, ora_1.default)().fail(`Failed to list CDK stacks: ${error instanceof Error ? error.message : String(error)}`);
            return [];
        }
    }
    async getCDKStackNames() {
        try {
            return await this.cdkExecutor.listStacks();
        }
        catch (error) {
            console.error(chalk_1.default.red("Failed to get CDK stack names:"), error instanceof Error ? error.message : String(error));
            return [];
        }
    }
    async getStackDetails(stackName, cfStackName) {
        try {
            if (this.config.verbose) {
                console.log(chalk_1.default.gray(`🔍 Looking for CloudFormation stack: ${cfStackName} (from CDK: ${stackName}) in region: ${this.config.region}`));
                console.log(chalk_1.default.gray(`🔑 Using AWS SDK CloudFormation client with credentials`));
                if (this.currentSession) {
                    console.log(chalk_1.default.gray(`   Profile: ${this.currentSession.profile}`));
                    console.log(chalk_1.default.gray(`   Region: ${this.currentSession.region}`));
                    console.log(chalk_1.default.gray(`   Access Key ID: ${this.currentSession.credentials.accessKeyId.substring(0, 8)}...`));
                }
            }
            // Try the primary region first
            let command = new client_cloudformation_1.DescribeStacksCommand({
                StackName: cfStackName,
            });
            let response;
            try {
                response = await this.cloudFormationClient.send(command);
                if (response.Stacks && response.Stacks.length > 0) {
                    const stack = response.Stacks[0];
                    return {
                        stackName: stackName,
                        stackId: stack.StackId,
                        stackStatus: stack.StackStatus,
                        creationTime: new Date(stack.CreationTime),
                        lastUpdatedTime: stack.LastUpdatedTime
                            ? new Date(stack.LastUpdatedTime)
                            : undefined,
                        description: stack.Description,
                        tags: stack.Tags?.reduce((acc, tag) => {
                            if (tag.Key && tag.Value) {
                                acc[tag.Key] = tag.Value;
                            }
                            return acc;
                        }, {}),
                    };
                }
            }
            catch (error) {
                // Stack not found - only log in verbose mode
                if (this.config.verbose) {
                    console.log(chalk_1.default.gray(`🔍 Stack not found in ${this.config.region}: ${error instanceof Error ? error.message : String(error)}`));
                }
            }
            return null;
        }
        catch (error) {
            if (this.config.verbose) {
                console.log(chalk_1.default.red(`❌ Error checking CloudFormation stack ${cfStackName}:`, error instanceof Error ? error.message : String(error)));
            }
            return null;
        }
    }
    async listStacks() {
        // Use the new CDK-specific method that uses 'cdk ls'
        return await this.listCDKStacks();
    }
    async listAllCloudFormationStacks() {
        try {
            console.log(chalk_1.default.blue(`🔍 Listing all CloudFormation stacks in region: ${this.config.region}`));
            const command = new client_cloudformation_1.ListStacksCommand({
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
                console.log(chalk_1.default.green(`✅ Found ${response.StackSummaries.length} CloudFormation stacks:`));
                response.StackSummaries.forEach((stack, index) => {
                    console.log(chalk_1.default.gray(`   ${index + 1}. ${stack.StackName} (${stack.StackStatus})`));
                });
            }
            else {
                console.log(chalk_1.default.yellow(`⚠️  No CloudFormation stacks found in region: ${this.config.region}`));
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error listing CloudFormation stacks:`), error instanceof Error ? error.message : String(error));
        }
    }
    isCDKStack(stackName) {
        // CDK stacks typically have patterns like:
        // - StackName-Environment (e.g., MyApp-Prod)
        // - StackName-Environment-RandomSuffix (e.g., MyApp-Prod-ABC123)
        // - Or contain CDK-specific tags
        // For now, we'll consider all stacks as potential CDK stacks
        // In a more sophisticated implementation, you could check for CDK-specific tags
        return true;
    }
    async deployStack(stackName) {
        try {
            // Check if CDK CLI is available
            const cdkInstalled = await this.cdkExecutor.checkCDKInstalled();
            if (!cdkInstalled) {
                const spinner = (0, ora_1.default)("CDK CLI not found").fail();
                console.log(chalk_1.default.yellow("⚠️  AWS CDK CLI is not installed or not in PATH."));
                console.log(chalk_1.default.gray("Please install it using: npm install -g aws-cdk"));
                return false;
            }
            const options = {
                stackName,
                profile: this.config.profile !== "default" ? this.config.profile : undefined,
                region: this.config.region, // Pass the selected region
                verbose: this.config.verbose,
                requireApproval: false, // For automated deployment
            };
            return await this.cdkExecutor.deployStack(options);
        }
        catch (error) {
            (0, ora_1.default)().fail(`Failed to deploy stack: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }
    async deleteStack(stackName) {
        try {
            const spinner = (0, ora_1.default)(`Deleting stack: ${stackName}`).start();
            const command = new client_cloudformation_1.DeleteStackCommand({
                StackName: stackName,
            });
            await this.cloudFormationClient.send(command);
            spinner.succeed(`Stack deletion initiated: ${stackName}`);
            spinner.info("Monitor CloudFormation console for progress");
            return true;
        }
        catch (error) {
            (0, ora_1.default)().fail(`Failed to delete stack: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }
    async destroyStack(stackName) {
        try {
            // Check if CDK CLI is available
            const cdkInstalled = await this.cdkExecutor.checkCDKInstalled();
            if (!cdkInstalled) {
                const spinner = (0, ora_1.default)("CDK CLI not found").fail();
                console.log(chalk_1.default.yellow("⚠️  AWS CDK CLI is not installed or not in PATH."));
                console.log(chalk_1.default.gray("Please install it using: npm install -g aws-cdk"));
                return false;
            }
            const options = {
                stackName,
                profile: this.config.profile !== "default" ? this.config.profile : undefined,
                region: this.config.region, // Pass the selected region
                verbose: this.config.verbose,
                requireApproval: false, // For automated deployment
            };
            return await this.cdkExecutor.destroyStack(options);
        }
        catch (error) {
            (0, ora_1.default)().fail(`Failed to destroy stack: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }
    getStackStatusColor(status) {
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
    getStackStatusWithEmoji(status) {
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
    formatStackInfo(stack) {
        const statusColor = this.getStackStatusColor(stack.stackStatus);
        // Use explicit color functions instead of dynamic access
        let statusText;
        switch (statusColor) {
            case "green":
                statusText = chalk_1.default.green(stack.stackStatus);
                break;
            case "red":
                statusText = chalk_1.default.red(stack.stackStatus);
                break;
            case "yellow":
                statusText = chalk_1.default.yellow(stack.stackStatus);
                break;
            case "blue":
                statusText = chalk_1.default.blue(stack.stackStatus);
                break;
            default:
                statusText = chalk_1.default.gray(stack.stackStatus);
                break;
        }
        let info = `${chalk_1.default.bold(stack.stackName)} - ${statusText}`;
        if (stack.description) {
            info += `\n  ${chalk_1.default.gray(stack.description)}`;
        }
        info += `\n  Created: ${chalk_1.default.gray(stack.creationTime.toLocaleString())}`;
        if (stack.lastUpdatedTime) {
            info += `\n  Updated: ${chalk_1.default.gray(stack.lastUpdatedTime.toLocaleString())}`;
        }
        if (stack.tags && Object.keys(stack.tags).length > 0) {
            info += `\n  Tags: ${chalk_1.default.gray(Object.entries(stack.tags)
                .map(([k, v]) => `${k}=${v}`)
                .join(", "))}`;
        }
        return info;
    }
}
exports.CDKStackService = CDKStackService;
//# sourceMappingURL=CDKStackService.js.map