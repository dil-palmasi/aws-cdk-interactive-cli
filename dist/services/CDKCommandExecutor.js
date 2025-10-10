"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CDKCommandExecutor = void 0;
const child_process_1 = require("child_process");
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
class CDKCommandExecutor {
    // Expose cdkPath for external access
    get cdkPath() {
        return this._cdkPath;
    }
    constructor(config) {
        this._cdkPath = this.findCDKPath();
        this.config = config;
    }
    getConfig() {
        return this.config;
    }
    shouldStopSpinner(text) {
        // Stop spinner when CDK starts detailed output to prevent text jumping
        const stopKeywords = [
            // Asset bundling
            "Bundling asset",
            "Building",
            "Installing",
            "Compiling",
            // Deployment operations
            "Deploying",
            "Creating",
            "Updating",
            "Deleting",
            "Modifying",
            // CDK synthesis and operations
            "Synthesizing",
            "Synthesis",
            "✨",
            "⚠️",
            "ℹ️",
            // Progress indicators
            "⠋",
            "⠙",
            "⠹",
            "⠸",
            "⠼",
            "⠴",
            "⠦",
            "⠧",
            "⠇",
            "⠏",
            // Error and warning messages
            "Error",
            "Warning",
            "Failed",
            "Exception",
            // Stack operations
            "Stack",
            "Resource",
            "Change",
            // AWS operations
            "AWS",
            "CloudFormation",
            "Lambda",
            "S3",
            "IAM",
            // Any line that looks like detailed output (contains specific patterns)
            /^\s*[├└│─]/, // Tree-like output
            /^\s*\d+\.\d+[km]b/, // File sizes
            /^\s*[✓✗●○]/, // Checkmarks and bullets
        ];
        return stopKeywords.some((keyword) => {
            if (typeof keyword === "string") {
                return text.includes(keyword);
            }
            else if (keyword instanceof RegExp) {
                return keyword.test(text);
            }
            return false;
        });
    }
    async findCDKProjectDirectory() {
        // If we already have a working directory and skipProjectDetection is true, return it
        if (this.config?.skipProjectDetection && this.config?.workingDirectory) {
            return this.config.workingDirectory;
        }
        try {
            // Try to find cdk.json in current directory and parent directories
            const { execSync } = require("child_process");
            const path = require("path");
            let currentDir = process.cwd();
            const maxDepth = 10; // Prevent infinite loops
            let depth = 0;
            if (this.config?.verbose) {
                console.log(chalk_1.default.gray(`🔍 Searching for CDK project starting from: ${currentDir}`));
            }
            while (depth < maxDepth) {
                try {
                    const cdkJsonPath = path.join(currentDir, "cdk.json");
                    execSync(`test -f ${cdkJsonPath}`, {
                        encoding: "utf8",
                    });
                    if (this.config?.verbose) {
                        console.log(chalk_1.default.green(`✅ Found CDK project in: ${currentDir}`));
                    }
                    // Read cdk.json to get app path
                    try {
                        const fs = require("fs");
                        const cdkJsonPath = path.join(currentDir, "cdk.json");
                        const cdkJsonContent = fs.readFileSync(cdkJsonPath, "utf8");
                        const cdkJson = JSON.parse(cdkJsonContent);
                        if (cdkJson.app && !this.config?.appPath) {
                            // Set the app path from cdk.json if not already set
                            this.config = {
                                ...this.config,
                                appPath: cdkJson.app,
                                workingDirectory: currentDir,
                            };
                            if (this.config?.verbose) {
                                console.log(chalk_1.default.green(`📁 Auto-detected app path: ${cdkJson.app}`));
                            }
                        }
                    }
                    catch (parseError) {
                        if (this.config?.verbose) {
                            console.log(chalk_1.default.yellow(`⚠️  Could not parse cdk.json: ${parseError}`));
                        }
                    }
                    return currentDir;
                }
                catch (error) {
                    // cdk.json not found in current directory
                    if (this.config?.verbose) {
                        console.log(chalk_1.default.gray(`   Checking: ${currentDir} - no cdk.json`));
                    }
                }
                const parentDir = path.dirname(currentDir);
                if (parentDir === currentDir) {
                    // Reached root directory
                    if (this.config?.verbose) {
                        console.log(chalk_1.default.yellow(`⚠️  Reached root directory, no CDK project found`));
                    }
                    break;
                }
                currentDir = parentDir;
                depth++;
            }
            return null;
        }
        catch (error) {
            if (this.config?.verbose) {
                console.log(chalk_1.default.red(`❌ Error searching for CDK project: ${error}`));
            }
            return null;
        }
    }
    findCDKPath() {
        // Always use npx cdk
        return "npx cdk";
    }
    async deployStack(options) {
        try {
            const args = ["deploy", "--require-approval=never"];
            if (options.stackName) {
                // Handle both single stack name and array of stack names
                if (Array.isArray(options.stackName)) {
                    args.push(...options.stackName);
                }
                else {
                    args.push(options.stackName);
                }
            }
            if (options.profile) {
                args.push("--profile", options.profile);
            }
            if (options.region) {
                args.push("--region", options.region);
            }
            if (options.requireApproval === false) {
                args.push("--require-approval", "never");
            }
            if (options.verbose) {
                args.push("--verbose");
            }
            // Add parameters
            if (options.parameters) {
                Object.entries(options.parameters).forEach(([key, value]) => {
                    args.push("--parameters", `${key}=${value}`);
                });
            }
            // Add tags
            if (options.tags) {
                Object.entries(options.tags).forEach(([key, value]) => {
                    args.push("--tags", `${key}=${value}`);
                });
            }
            // Execute command with real-time output (no spinner)
            const result = await this.executeCommandWithRealTimeOutput(args);
            return result.success;
        }
        catch (error) {
            console.log(chalk_1.default.red(`Error details: ${error}`));
            return false;
        }
    }
    async destroyStack(options) {
        try {
            const args = ["destroy", "--force"];
            if (options.stackName) {
                // Handle both single stack name and array of stack names
                if (Array.isArray(options.stackName)) {
                    args.push(...options.stackName);
                }
                else {
                    args.push(options.stackName);
                }
            }
            if (options.profile) {
                args.push("--profile", options.profile);
            }
            if (options.region) {
                args.push("--region", options.region);
            }
            if (options.verbose) {
                args.push("--verbose");
            }
            // Execute command with real-time output (no spinner)
            const result = await this.executeCommandWithRealTimeOutput(args);
            return result.success;
        }
        catch (error) {
            console.log(chalk_1.default.red(`Error details: ${error}`));
            return false;
        }
    }
    async listStacks() {
        const args = ["list"];
        // Add app path if specified
        if (this.config?.appPath) {
            args.unshift("--app", this.config.appPath);
        }
        const result = await this.executeCommand(args);
        if (!result.success) {
            // CDK ls failed - cancel terminal and bubble up the error
            console.error(chalk_1.default.red("❌ CDK list command failed:"));
            if (result.error) {
                console.error(chalk_1.default.red(result.error));
            }
            if (result.output) {
                console.error(chalk_1.default.gray("Output:"));
                console.error(chalk_1.default.gray(result.output));
            }
            process.exit(1);
        }
        if (!result.output) {
            console.error(chalk_1.default.red("❌ CDK list command returned no output"));
            if (result.error) {
                console.error(chalk_1.default.red("Error output:"));
                console.error(chalk_1.default.red(result.error));
            }
            process.exit(1);
        }
        // Parse CDK list output - filter out warnings and build output
        const lines = result.output.split("\n").filter((line) => {
            const trimmed = line.trim();
            // Skip empty lines, warnings, and build output
            return (trimmed &&
                !trimmed.startsWith("[WARNING]") &&
                !trimmed.startsWith("> nx run") &&
                !trimmed.startsWith("————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————") &&
                !trimmed.startsWith("NX   Successfully ran target") &&
                !trimmed.includes("deprecated") &&
                !trimmed.includes("This API will be removed") &&
                !trimmed.startsWith("CDK") &&
                !trimmed.startsWith("npm") &&
                !trimmed.startsWith("yarn") &&
                !trimmed.startsWith("pnpm") &&
                !trimmed.includes("Installing") &&
                !trimmed.includes("Building") &&
                !trimmed.includes("Synthesizing") &&
                !trimmed.includes("✨") &&
                !trimmed.includes("⚠") &&
                !trimmed.includes("ℹ") &&
                !trimmed.includes("⠋") &&
                !trimmed.includes("⠙") &&
                !trimmed.includes("⠹") &&
                !trimmed.includes("⠸") &&
                !trimmed.includes("⠼") &&
                !trimmed.includes("⠴") &&
                !trimmed.includes("⠦") &&
                !trimmed.includes("⠧") &&
                !trimmed.includes("⠇") &&
                !trimmed.includes("⠏") &&
                // Include lines that look like stack names (allow slashes, spaces, parentheses for complex names)
                /^[a-zA-Z0-9-_/()\s]+$/.test(trimmed) &&
                // Must contain at least one letter to be a valid stack name
                /[a-zA-Z]/.test(trimmed));
        });
        // Extract stack names and create display/full name pairs
        const stackInfo = lines
            .map((line) => {
            const trimmed = line.trim();
            if (!trimmed)
                return null;
            // Extract CloudFormation stack name from parentheses
            const cfStackNameMatch = trimmed.match(/\(([^)]+)\)$/);
            const cfStackName = cfStackNameMatch ? cfStackNameMatch[1] : null;
            // Remove parenthetical descriptions like "(rc-audit-replication-RCP-28671-audit-referreded-entity-updates)"
            const cleanLine = trimmed.replace(/\s*\([^)]*\)\s*$/, "");
            // Extract display name (last part after final slash, or the whole name if no slash)
            const displayName = cleanLine.includes("/")
                ? cleanLine.split("/").pop() || cleanLine
                : cleanLine;
            return {
                displayName: displayName.trim(),
                fullName: trimmed, // Keep original full name for CDK commands
                cfStackName: cfStackName || cleanLine, // Use CF name from parentheses, fallback to clean line
            };
        })
            .filter((info) => info !== null);
        if (this.config?.verbose) {
            console.log(chalk_1.default.gray(`CDK list raw output:`));
            console.log(chalk_1.default.gray(result.output));
            console.log(chalk_1.default.gray(`Parsed stack info: ${JSON.stringify(stackInfo)}`));
        }
        return stackInfo;
    }
    async synthStack(stackName) {
        const spinner = (0, ora_1.default)(`Synthesizing ${stackName || "stacks"}`).start();
        try {
            const args = ["synth"];
            // Add app path if specified
            if (this.config?.appPath) {
                args.unshift("--app", this.config.appPath);
            }
            if (stackName) {
                args.push(stackName);
            }
            const result = await this.executeCommand(args, spinner);
            if (result.success) {
                spinner.succeed(`Synthesis completed: ${stackName || "all stacks"}`);
                return true;
            }
            else {
                spinner.fail(`Synthesis failed: ${stackName || "all stacks"}`);
                if (result.error) {
                    console.error(chalk_1.default.red("Error details:"), result.error);
                }
                return false;
            }
        }
        catch (error) {
            spinner.fail(`Failed to synthesize: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }
    async executeCommand(args, spinner) {
        return new Promise((resolve) => {
            const spawnOptions = {
                stdio: ["pipe", "pipe", "pipe"],
                shell: false, // Use shell: false to avoid shell interpretation of arguments
                env: { ...process.env }, // Inherit all environment variables (including AWS credentials)
            };
            // Use working directory if specified
            if (this.config?.workingDirectory) {
                spawnOptions.cwd = this.config.workingDirectory;
            }
            // Handle commands with spaces (like "npx cdk") and AWS Vault
            let command;
            let commandArgs;
            const finalArgs = [...args];
            if (this.config?.vaultProfile) {
                // Use aws-vault exec to run CDK with proper credentials
                const cdkCommandParts = this._cdkPath.split(" ");
                // Use aws-vault exec directly
                command = "aws-vault";
                commandArgs = [
                    "exec",
                    this.config.vaultProfile,
                    "--",
                    ...this._cdkPath.split(" "),
                    ...finalArgs,
                ];
                // Pass all environment variables
                spawnOptions.env = process.env;
                spawnOptions.shell = false;
                spawnOptions.stdio = ["pipe", "pipe", "pipe"]; // Use pipe for output capture
                // Debug: Log the command being executed
                if (this.config?.verbose) {
                    console.log(chalk_1.default.gray(`🔍 Executing: ${command} ${commandArgs.join(" ")}`));
                }
            }
            else {
                // Use CDK directly
                const commandParts = this._cdkPath.split(" ");
                command = commandParts[0];
                commandArgs = [...commandParts.slice(1), ...finalArgs];
            }
            const child = (0, child_process_1.spawn)(command, commandArgs, spawnOptions);
            let output = "";
            let error = "";
            child.stdout?.on("data", (data) => {
                const text = data.toString();
                output += text;
                // Stop spinner updates when CDK starts detailed output to prevent text jumping
                if (spinner && this.shouldStopSpinner(text)) {
                    spinner.stop();
                }
            });
            child.stderr?.on("data", (data) => {
                const text = data.toString();
                error += text;
                // Stop spinner updates when CDK starts detailed output to prevent text jumping
                if (spinner && this.shouldStopSpinner(text)) {
                    spinner.stop();
                }
            });
            child.on("close", (code) => {
                resolve({
                    success: code === 0,
                    output: output.trim(),
                    error: error.trim(),
                });
            });
            child.on("error", (err) => {
                resolve({
                    success: false,
                    error: err.message,
                });
            });
        });
    }
    async checkCDKInstalled() {
        try {
            const result = await this.executeCommand(["--version"]);
            return result.success;
        }
        catch (error) {
            return false;
        }
    }
    async executeCommandWithRealTimeOutput(args) {
        return new Promise((resolve) => {
            const spawnOptions = {
                stdio: "inherit", // Use inherit to preserve colors and direct output to terminal
                shell: false, // Will be set to true for aws-vault commands
                env: { ...process.env }, // Inherit all environment variables (including AWS credentials)
            };
            // Use working directory if specified
            if (this.config?.workingDirectory) {
                spawnOptions.cwd = this.config.workingDirectory;
            }
            // Handle commands with spaces (like "npx cdk") and AWS Vault
            let command;
            let commandArgs;
            const finalArgs = [...args];
            if (this.config?.vaultProfile) {
                // Use aws-vault exec to run CDK with proper credentials
                command = "aws-vault";
                commandArgs = [
                    "exec",
                    this.config.vaultProfile,
                    "--",
                    ...this._cdkPath.split(" "),
                    ...finalArgs,
                ];
                // Pass all environment variables
                spawnOptions.env = process.env;
                spawnOptions.shell = false;
                spawnOptions.stdio = "inherit"; // Use inherit to preserve colors and direct output to terminal
                // Debug: Log the command being executed
                if (this.config?.verbose) {
                    console.log(chalk_1.default.gray(`🔍 Executing: ${command} ${commandArgs.join(" ")}`));
                }
            }
            else {
                // Use CDK directly
                const commandParts = this._cdkPath.split(" ");
                command = commandParts[0];
                commandArgs = [...commandParts.slice(1), ...finalArgs];
            }
            const child = (0, child_process_1.spawn)(command, commandArgs, spawnOptions);
            child.on("close", (code) => {
                resolve({
                    success: code === 0,
                    output: "", // Output is not captured when using stdio: "inherit"
                    error: "", // Error is not captured when using stdio: "inherit"
                });
            });
            child.on("error", (err) => {
                resolve({
                    success: false,
                    error: err.message,
                });
            });
        });
    }
    getCDKVersion() {
        return new Promise((resolve) => {
            const child = (0, child_process_1.spawn)(this._cdkPath, ["--version"], {
                stdio: ["pipe", "pipe", "pipe"],
                shell: true,
            });
            let output = "";
            child.stdout?.on("data", (data) => {
                output += data.toString();
            });
            child.on("close", (code) => {
                if (code === 0) {
                    resolve(output.trim());
                }
                else {
                    resolve(null);
                }
            });
            child.on("error", () => {
                resolve(null);
            });
        });
    }
}
exports.CDKCommandExecutor = CDKCommandExecutor;
//# sourceMappingURL=CDKCommandExecutor.js.map