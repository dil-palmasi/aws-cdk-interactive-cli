"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InteractiveCDKManager = void 0;
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
class InteractiveCDKManager {
    constructor(cdkService, config) {
        this.stacks = [];
        this.isRunning = false;
        this.stacksLoaded = false; // Track if stacks have been loaded
        this.cdkService = cdkService;
        this.config = config;
    }
    async start() {
        this.isRunning = true;
        while (this.isRunning) {
            await this.showMainMenu();
        }
    }
    stop() {
        this.isRunning = false;
    }
    async showMainMenu() {
        // Only refresh stacks if they haven't been loaded yet
        if (!this.stacksLoaded) {
            const refreshSpinner = (0, ora_1.default)("🔄 Loading stack information...").start();
            await this.refreshStacks();
            this.stacksLoaded = true;
            refreshSpinner.succeed("✅ Stack information loaded");
        }
        console.clear();
        console.log(chalk_1.default.blue.bold("🚀 AWS CDK Interactive Manager"));
        console.log(chalk_1.default.gray("─────────────────────────────"));
        console.log("");
        // Show stack summary
        const deployedCount = this.stacks.filter((stack) => stack.stackId !== undefined).length;
        const undeployedCount = this.stacks.length - deployedCount;
        console.log(chalk_1.default.gray(`📊 Found ${this.stacks.length} stacks (${deployedCount} deployed, ${undeployedCount} not deployed)`));
        console.log("");
        // Show Deploy/Destroy options using custom searchable select
        const menuChoices = [
            { name: "🚀 Deploy stacks", value: "deploy" },
            { name: "🗑️  Destroy stacks", value: "destroy" },
            { name: "🔄 Refresh stacks", value: "refresh" },
            { name: "❌ Exit", value: "exit" },
        ];
        const action = (await this.customSearchableSelect(menuChoices, "What would you like to do?", false));
        await this.handleMainMenuAction(action);
    }
    async handleMainMenuAction(action) {
        switch (action) {
            case "deploy":
                await this.showDeployMenu();
                break;
            case "destroy":
                await this.showDestroyMenu();
                break;
            case "refresh":
                await this.refreshStacks();
                break;
            case "exit":
                this.stop();
                break;
            default:
                console.log(chalk_1.default.yellow("Unknown action. Returning to main menu."));
                break;
        }
    }
    async showDeployMenu() {
        console.clear();
        console.log(chalk_1.default.blue.bold("🚀 Deploy Stacks"));
        console.log(chalk_1.default.gray("─────────────────────────────"));
        console.log("");
        // Use the main stacks list which has full deployment information
        const fetchSpinner = (0, ora_1.default)("🔍 Fetching available stacks...").start();
        // Count deployed vs undeployed stacks
        const deployedCount = this.stacks.filter((stack) => stack.stackId !== undefined).length;
        const undeployedCount = this.stacks.length - deployedCount;
        fetchSpinner.succeed(`✅ Found ${this.stacks.length} available stacks (${deployedCount} deployed, ${undeployedCount} not deployed)`);
        if (this.stacks.length === 0) {
            console.log(chalk_1.default.yellow("⚠️  No stacks available for deployment."));
            console.log(chalk_1.default.gray("Make sure you're in a CDK project directory."));
            console.log("");
            const { back } = await inquirer_1.default.prompt([
                {
                    type: "confirm",
                    name: "back",
                    message: "🔙 Press Enter to go back to main menu",
                    default: true,
                },
            ]);
            return;
        }
        // Create choices with deployment status and custom styling
        const choices = this.stacks.map((stack) => {
            // Check if stack is deployed (has stackId)
            const isDeployed = stack.stackId !== undefined;
            // Extract CloudFormation stack name from parentheses at the end
            const cfStackNameMatch = stack.stackName.match(/\(([^)]+)\)$/);
            const cfStackName = cfStackNameMatch
                ? cfStackNameMatch[1]
                : stack.stackName;
            // Create a clean display name - extract the last part after the final slash
            const cleanStackName = stack.stackName.replace(/\s*\([^)]*\)\s*$/, "");
            const displayName = cleanStackName.includes("/")
                ? cleanStackName.split("/").pop() || cleanStackName
                : cleanStackName;
            if (isDeployed) {
                // Stack is deployed - show CloudFormation status with emoji
                const statusInfo = this.cdkService.getStackStatusWithEmoji(stack.stackStatus);
                let statusText;
                switch (statusInfo.color) {
                    case "green":
                        statusText = chalk_1.default.green(`${statusInfo.emoji} ${statusInfo.text}`);
                        break;
                    case "red":
                        statusText = chalk_1.default.red(`${statusInfo.emoji} ${statusInfo.text}`);
                        break;
                    case "yellow":
                        statusText = chalk_1.default.yellow(`${statusInfo.emoji} ${statusInfo.text}`);
                        break;
                    case "orange":
                        statusText = chalk_1.default.rgb(255, 165, 0)(`${statusInfo.emoji} ${statusInfo.text}`);
                        break;
                    case "blue":
                        statusText = chalk_1.default.blue(`${statusInfo.emoji} ${statusInfo.text}`);
                        break;
                    default:
                        statusText = chalk_1.default.gray(`${statusInfo.emoji} ${statusInfo.text}`);
                }
                return {
                    name: `${displayName} ${chalk_1.default.gray(`(${cfStackName})`)} ${statusText}`,
                    value: stack.stackName,
                    short: displayName,
                    disabled: false,
                };
            }
            else {
                // Stack is not deployed
                const statusText = chalk_1.default.gray("⏳ Not Deployed");
                const stackNameColor = chalk_1.default.gray(displayName);
                return {
                    name: `${stackNameColor} ${chalk_1.default.gray(`(${cfStackName})`)} ${statusText}`,
                    value: stack.stackName,
                    short: displayName,
                    disabled: false,
                };
            }
        });
        // Use a custom multi-select implementation with dynamic colors
        const selectedStacks = await this.customMultiSelect(choices, "Select stacks to deploy (use spacebar to select multiple):");
        // Clean up terminal state after custom multi-select
        process.stdin.setRawMode(false);
        process.stdin.pause();
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (selectedStacks.length === 0) {
            console.log(chalk_1.default.yellow("No stacks selected."));
            return;
        }
        console.log(chalk_1.default.blue(`\n🚀 Deploying ${selectedStacks.length} stack(s)...`));
        console.log(chalk_1.default.gray(`Selected stacks: ${selectedStacks
            .map((stackName) => {
            // Create clean display name - extract the last part after the final slash
            const cleanStackName = stackName.replace(/\s*\([^)]*\)\s*$/, "");
            return cleanStackName.includes("/")
                ? cleanStackName.split("/").pop() || cleanStackName
                : cleanStackName;
        })
            .join(", ")}`));
        console.log("");
        // Clean stack names
        const cleanStackNames = selectedStacks.map((stackFullName) => stackFullName.replace(/\s*\([^)]*\)\s*$/, ""));
        // Deploy stacks using CDK's native parallel execution
        const success = await this.cdkService.deployStack(cleanStackNames);
        if (success) {
            console.log(chalk_1.default.green(`✅ Successfully deployed ${cleanStackNames.length} stack(s)!`));
        }
        else {
            console.log(chalk_1.default.red(`❌ Failed to deploy stacks. Check the output above for details.`));
        }
        console.log("");
        const { back } = await inquirer_1.default.prompt([
            {
                type: "confirm",
                name: "back",
                message: "🔙 Press Enter to go back to main menu",
                default: true,
            },
        ]);
    }
    async showDestroyMenu() {
        console.clear();
        console.log(chalk_1.default.blue.bold("🗑️  Destroy Stacks"));
        console.log(chalk_1.default.gray("─────────────────────────────"));
        console.log("");
        // Filter to only show actually deployed stacks (those with stackId)
        const deployedStacks = this.stacks.filter((stack) => stack.stackId !== undefined);
        const totalStacks = this.stacks.length;
        const undeployedCount = totalStacks - deployedStacks.length;
        console.log(chalk_1.default.gray(`📊 Total stacks: ${totalStacks} (${deployedStacks.length} deployed, ${undeployedCount} not deployed)`));
        console.log("");
        if (deployedStacks.length === 0) {
            console.log(chalk_1.default.yellow("⚠️  No deployed stacks found to destroy."));
            console.log("");
            const { back } = await inquirer_1.default.prompt([
                {
                    type: "confirm",
                    name: "back",
                    message: "🔙 Press Enter to go back to main menu",
                    default: true,
                },
            ]);
            return;
        }
        // Create choices for deployed stacks
        const choices = deployedStacks.map((stack) => {
            // Extract CloudFormation stack name from parentheses at the end
            const cfStackNameMatch = stack.stackName.match(/\(([^)]+)\)$/);
            const cfStackName = cfStackNameMatch
                ? cfStackNameMatch[1]
                : stack.stackName;
            const cleanStackName = stack.stackName.replace(/\s*\([^)]*\)\s*$/, "");
            const displayName = cleanStackName.includes("/")
                ? cleanStackName.split("/").pop() || cleanStackName
                : cleanStackName;
            const statusInfo = this.cdkService.getStackStatusWithEmoji(stack.stackStatus);
            let statusText;
            switch (statusInfo.color) {
                case "green":
                    statusText = chalk_1.default.green(`${statusInfo.emoji} ${statusInfo.text}`);
                    break;
                case "red":
                    statusText = chalk_1.default.red(`${statusInfo.emoji} ${statusInfo.text}`);
                    break;
                case "yellow":
                    statusText = chalk_1.default.yellow(`${statusInfo.emoji} ${statusInfo.text}`);
                    break;
                case "orange":
                    statusText = chalk_1.default.rgb(255, 165, 0)(`${statusInfo.emoji} ${statusInfo.text}`);
                    break;
                case "blue":
                    statusText = chalk_1.default.blue(`${statusInfo.emoji} ${statusInfo.text}`);
                    break;
                default:
                    statusText = chalk_1.default.gray(`${statusInfo.emoji} ${statusInfo.text}`);
            }
            return {
                name: `${displayName} ${chalk_1.default.gray(`(${cfStackName})`)} ${statusText}`,
                value: stack.stackName,
                short: displayName,
                disabled: false,
            };
        });
        // Use a custom multi-select implementation with dynamic colors
        const selectedStacks = await this.customMultiSelect(choices, "Select stacks to destroy (use spacebar to select multiple):");
        // Clean up terminal state after custom multi-select
        process.stdin.setRawMode(false);
        process.stdin.pause();
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (selectedStacks.length === 0) {
            console.log(chalk_1.default.yellow("No stacks selected."));
            return;
        }
        console.log(chalk_1.default.red(`\n🗑️  Destroying ${selectedStacks.length} stack(s)...`));
        console.log(chalk_1.default.gray(`Selected stacks: ${selectedStacks
            .map((stackName) => {
            const cleanStackName = stackName.replace(/\s*\([^)]*\)\s*$/, "");
            return cleanStackName.includes("/")
                ? cleanStackName.split("/").pop() || cleanStackName
                : cleanStackName;
        })
            .join(", ")}`));
        console.log("");
        // Clean stack names
        const cleanStackNames = selectedStacks.map((stackFullName) => stackFullName.replace(/\s*\([^)]*\)\s*$/, ""));
        // Destroy stacks using CDK's native parallel execution
        const success = await this.cdkService.destroyStack(cleanStackNames);
        if (success) {
            console.log(chalk_1.default.green(`✅ Successfully destroyed ${cleanStackNames.length} stack(s)!`));
        }
        else {
            console.log(chalk_1.default.red(`❌ Failed to destroy stacks. Check the output above for details.`));
        }
        console.log("");
        const { back } = await inquirer_1.default.prompt([
            {
                type: "confirm",
                name: "back",
                message: "🔙 Press Enter to go back to main menu",
                default: true,
            },
        ]);
    }
    async customSearchableSelect(choices, message, multiSelect = false) {
        console.log(chalk_1.default.blue(message));
        console.log(chalk_1.default.gray(`Use ↑↓ arrows to navigate, ${multiSelect ? "spacebar to select/deselect, " : ""}type to search, Enter to confirm`));
        console.log("");
        const selectedItems = [];
        let currentIndex = 0;
        const selectedIndices = new Set();
        let searchQuery = "";
        let filteredChoices = choices;
        // Simple interactive selection
        const readline = require("readline");
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true,
        });
        const filterChoices = (query) => {
            if (!query.trim()) {
                return choices;
            }
            return choices.filter((choice) => choice.name.toLowerCase().includes(query.toLowerCase()) ||
                choice.value.toLowerCase().includes(query.toLowerCase()));
        };
        const displayChoices = () => {
            console.clear();
            console.log(chalk_1.default.blue(message));
            console.log(chalk_1.default.gray(`Use ↑↓ arrows to navigate, ${multiSelect ? "spacebar to select/deselect, " : ""}type to search, Enter to confirm`));
            if (searchQuery) {
                console.log(chalk_1.default.green(`🔍 Search: ${searchQuery} (${filteredChoices.length} results)`));
            }
            console.log("");
            filteredChoices.forEach((choice, index) => {
                const isSelected = multiSelect
                    ? selectedIndices.has(choices.indexOf(choice))
                    : false;
                const isCurrent = index === currentIndex && currentIndex < filteredChoices.length;
                const marker = isCurrent ? "❯" : " ";
                const checkbox = multiSelect ? (isSelected ? "◉" : "◯") : "";
                const color = isCurrent ? chalk_1.default.cyan : chalk_1.default.white;
                console.log(`${marker}${checkbox} ${color(choice.name)}`);
            });
            console.log("");
            if (multiSelect) {
                console.log(chalk_1.default.gray(`Selected: ${selectedItems.length} item(s)`));
                if (filteredChoices.length !== choices.length) {
                    console.log(chalk_1.default.gray(`Showing ${filteredChoices.length} of ${choices.length} items`));
                }
            }
        };
        displayChoices();
        return new Promise((resolve) => {
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.setEncoding("utf8");
            const handleKey = (key) => {
                if (key === "\u0003") {
                    // Ctrl+C
                    process.exit(0);
                }
                else if (key === "\u001b[A" ||
                    key === "\u001b[1;2A" ||
                    key === "\u001b[1;9A" ||
                    key === "\u001bOA") {
                    // Up arrow (different escape sequences including Option+Arrow)
                    currentIndex = Math.max(0, currentIndex - 1);
                    displayChoices();
                }
                else if (key === "\u001b[B" ||
                    key === "\u001b[1;2B" ||
                    key === "\u001b[1;9B" ||
                    key === "\u001bOB") {
                    // Down arrow (different escape sequences including Option+Arrow)
                    currentIndex = Math.min(filteredChoices.length - 1, currentIndex + 1);
                    displayChoices();
                }
                else if (key === " " && multiSelect) {
                    // Spacebar (only for multi-select)
                    const actualChoice = filteredChoices[currentIndex];
                    const actualIndex = choices.indexOf(actualChoice);
                    if (selectedIndices.has(actualIndex)) {
                        selectedIndices.delete(actualIndex);
                        selectedItems.splice(selectedItems.indexOf(actualChoice.value), 1);
                    }
                    else {
                        selectedIndices.add(actualIndex);
                        selectedItems.push(actualChoice.value);
                    }
                    displayChoices();
                }
                else if (key === "\r") {
                    // Enter
                    process.stdin.setRawMode(false);
                    process.stdin.pause();
                    rl.close();
                    if (multiSelect) {
                        resolve(selectedItems);
                    }
                    else {
                        // Ensure we have a valid choice before accessing its value
                        if (filteredChoices.length > 0 &&
                            currentIndex < filteredChoices.length) {
                            resolve(filteredChoices[currentIndex].value);
                        }
                        else {
                            resolve("");
                        }
                    }
                }
                else if (key === "\u007f" || key === "\b") {
                    // Backspace
                    searchQuery = searchQuery.slice(0, -1);
                    filteredChoices = filterChoices(searchQuery);
                    currentIndex = Math.min(currentIndex, Math.max(0, filteredChoices.length - 1));
                    displayChoices();
                }
                else if (key.length === 1 && key >= " " && key <= "~") {
                    // Printable characters - add to search query
                    searchQuery += key;
                    filteredChoices = filterChoices(searchQuery);
                    currentIndex = Math.min(currentIndex, Math.max(0, filteredChoices.length - 1));
                    displayChoices();
                }
            };
            process.stdin.on("data", handleKey);
        });
    }
    async customMultiSelect(choices, message) {
        console.log(chalk_1.default.blue(message));
        console.log(chalk_1.default.gray("Use ↑↓ arrows to navigate, spacebar to select/deselect, type to search, Enter to confirm"));
        console.log("");
        const selectedStacks = [];
        let currentIndex = 0;
        const selectedIndices = new Set();
        let searchQuery = "";
        let isSearching = false;
        let filteredChoices = choices;
        // Simple interactive selection
        const readline = require("readline");
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true,
        });
        const filterChoices = (query) => {
            if (!query.trim()) {
                return choices;
            }
            return choices.filter((choice) => choice.name.toLowerCase().includes(query.toLowerCase()) ||
                choice.value.toLowerCase().includes(query.toLowerCase()));
        };
        const displayChoices = () => {
            console.clear();
            console.log(chalk_1.default.blue(message));
            console.log(chalk_1.default.gray("Use ↑↓ arrows to navigate, spacebar to select/deselect, type to search, Enter to confirm"));
            if (isSearching) {
                console.log(chalk_1.default.yellow(`🔍 Search: ${searchQuery}_`));
            }
            else if (searchQuery) {
                console.log(chalk_1.default.green(`🔍 Search: ${searchQuery} (${filteredChoices.length} results)`));
            }
            console.log("");
            filteredChoices.forEach((choice, index) => {
                const isSelected = selectedIndices.has(choices.indexOf(choice));
                const isCurrent = index === currentIndex;
                const marker = isCurrent ? "❯" : " ";
                const checkbox = isSelected ? "◉" : "◯";
                const color = isCurrent ? chalk_1.default.cyan : chalk_1.default.white;
                console.log(`${marker}${checkbox} ${color(choice.name)}`);
            });
            console.log("");
            console.log(chalk_1.default.gray(`Selected: ${selectedStacks.length} stack(s)`));
            if (filteredChoices.length !== choices.length) {
                console.log(chalk_1.default.gray(`Showing ${filteredChoices.length} of ${choices.length} stacks`));
            }
        };
        displayChoices();
        return new Promise((resolve) => {
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.setEncoding("utf8");
            const handleKey = (key) => {
                if (key === "\u0003") {
                    // Ctrl+C
                    process.exit(0);
                }
                else if (key === "/" && !isSearching) {
                    // Start search mode
                    isSearching = true;
                    searchQuery = "";
                    displayChoices();
                }
                else if (isSearching) {
                    if (key === "\r" || key === "\u001b") {
                        // Enter or Escape - exit search mode
                        isSearching = false;
                        filteredChoices = filterChoices(searchQuery);
                        currentIndex = Math.min(currentIndex, filteredChoices.length - 1);
                        displayChoices();
                    }
                    else if (key === "\u007f" || key === "\b") {
                        // Backspace
                        searchQuery = searchQuery.slice(0, -1);
                        filteredChoices = filterChoices(searchQuery);
                        currentIndex = Math.min(currentIndex, filteredChoices.length - 1);
                        displayChoices();
                    }
                    else if (key.length === 1 && key >= " " && key <= "~") {
                        // Printable characters
                        searchQuery += key;
                        filteredChoices = filterChoices(searchQuery);
                        currentIndex = Math.min(currentIndex, filteredChoices.length - 1);
                        displayChoices();
                    }
                }
                else if (key === "\u001b[A" ||
                    key === "\u001b[1;2A" ||
                    key === "\u001b[1;9A" ||
                    key === "\u001bOA") {
                    // Up arrow (different escape sequences including Option+Arrow)
                    currentIndex = Math.max(0, currentIndex - 1);
                    displayChoices();
                }
                else if (key === "\u001b[B" ||
                    key === "\u001b[1;2B" ||
                    key === "\u001b[1;9B" ||
                    key === "\u001bOB") {
                    // Down arrow (different escape sequences including Option+Arrow)
                    currentIndex = Math.min(filteredChoices.length - 1, currentIndex + 1);
                    displayChoices();
                }
                else if (key === " ") {
                    // Spacebar
                    const actualChoice = filteredChoices[currentIndex];
                    const actualIndex = choices.indexOf(actualChoice);
                    if (selectedIndices.has(actualIndex)) {
                        selectedIndices.delete(actualIndex);
                        selectedStacks.splice(selectedStacks.indexOf(actualChoice.value), 1);
                    }
                    else {
                        selectedIndices.add(actualIndex);
                        selectedStacks.push(actualChoice.value);
                    }
                    displayChoices();
                }
                else if (key === "\r") {
                    // Enter
                    process.stdin.setRawMode(false);
                    process.stdin.pause();
                    rl.close();
                    resolve(selectedStacks);
                }
            };
            process.stdin.on("data", handleKey);
        });
    }
    async refreshStacks() {
        try {
            this.stacks = await this.cdkService.listStacks();
        }
        catch (error) {
            console.error(chalk_1.default.red("Failed to refresh stacks:"), error instanceof Error ? error.message : String(error));
        }
    }
}
exports.InteractiveCDKManager = InteractiveCDKManager;
//# sourceMappingURL=InteractiveCDKManager.js.map