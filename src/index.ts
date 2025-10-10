#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import { CDKStackService } from "./services/CDKStackService";
import { InteractiveCDKManager } from "./services/InteractiveCDKManager";
import { ConfigService } from "./services/ConfigService";
// Generic searchable select function
async function customSearchableSelect(
  choices: any[],
  message: string,
  multiSelect: boolean = false
): Promise<string | string[]> {
  console.log(chalk.blue(message));
  console.log(
    chalk.gray(
      `Use ↑↓ arrows to navigate, ${
        multiSelect ? "spacebar to select/deselect, " : ""
      }type to search, Enter to confirm`
    )
  );
  console.log("");

  const selectedItems: string[] = [];
  let currentIndex = 0;
  const selectedIndices = new Set<number>();
  let searchQuery = "";
  let filteredChoices = choices;

  // Simple interactive selection
  const readline = require("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const filterChoices = (query: string) => {
    if (!query.trim()) {
      return choices;
    }
    return choices.filter(
      (choice) =>
        choice.name.toLowerCase().includes(query.toLowerCase()) ||
        choice.value.toLowerCase().includes(query.toLowerCase())
    );
  };

  const displayChoices = () => {
    console.clear();
    console.log(chalk.blue(message));
    console.log(
      chalk.gray(
        `Use ↑↓ arrows to navigate, ${
          multiSelect ? "spacebar to select/deselect, " : ""
        }type to search, Enter to confirm`
      )
    );

    if (searchQuery) {
      console.log(
        chalk.green(
          `🔍 Search: ${searchQuery} (${filteredChoices.length} results)`
        )
      );
    }

    console.log("");

    filteredChoices.forEach((choice, index) => {
      const isSelected = multiSelect
        ? selectedIndices.has(choices.indexOf(choice))
        : false;
      const isCurrent =
        index === currentIndex && currentIndex < filteredChoices.length;
      const marker = isCurrent ? "❯" : " ";
      const checkbox = multiSelect ? (isSelected ? "◉" : "◯") : "";
      const color = isCurrent ? chalk.cyan : chalk.white;

      console.log(`${marker}${checkbox} ${color(choice.name)}`);
    });

    console.log("");
    if (multiSelect) {
      console.log(chalk.gray(`Selected: ${selectedItems.length} item(s)`));
      if (filteredChoices.length !== choices.length) {
        console.log(
          chalk.gray(
            `Showing ${filteredChoices.length} of ${choices.length} items`
          )
        );
      }
    }
  };

  displayChoices();

  return new Promise((resolve) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    const handleKey = (key: string) => {
      if (key === "\u0003") {
        // Ctrl+C
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeAllListeners("data");
        rl.close();
        process.exit(0);
      } else if (
        key === "\u001b[A" ||
        key === "\u001b[1;2A" ||
        key === "\u001b[1;9A" ||
        key === "\u001bOA"
      ) {
        // Up arrow (different escape sequences including Option+Arrow)
        currentIndex = Math.max(0, currentIndex - 1);
        displayChoices();
      } else if (
        key === "\u001b[B" ||
        key === "\u001b[1;2B" ||
        key === "\u001b[1;9B" ||
        key === "\u001bOB"
      ) {
        // Down arrow (different escape sequences including Option+Arrow)
        currentIndex = Math.min(filteredChoices.length - 1, currentIndex + 1);
        displayChoices();
      } else if (key === " " && multiSelect) {
        // Spacebar (only for multi-select)
        const actualChoice = filteredChoices[currentIndex];
        const actualIndex = choices.indexOf(actualChoice);

        if (selectedIndices.has(actualIndex)) {
          selectedIndices.delete(actualIndex);
          selectedItems.splice(selectedItems.indexOf(actualChoice.value), 1);
        } else {
          selectedIndices.add(actualIndex);
          selectedItems.push(actualChoice.value);
        }
        displayChoices();
      } else if (key === "\r") {
        // Enter
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeAllListeners("data");
        rl.close();

        if (multiSelect) {
          resolve(selectedItems);
        } else {
          // Ensure we have a valid choice before accessing its value
          if (
            filteredChoices.length > 0 &&
            currentIndex < filteredChoices.length
          ) {
            resolve(filteredChoices[currentIndex].value);
          } else {
            resolve("");
          }
        }
      } else if (key === "\u007f" || key === "\b") {
        // Backspace
        searchQuery = searchQuery.slice(0, -1);
        filteredChoices = filterChoices(searchQuery);
        currentIndex = Math.min(
          currentIndex,
          Math.max(0, filteredChoices.length - 1)
        );
        displayChoices();
      } else if (key.length === 1 && key >= " " && key <= "~") {
        // Printable characters - add to search query
        searchQuery += key;
        filteredChoices = filterChoices(searchQuery);
        currentIndex = Math.min(
          currentIndex,
          Math.max(0, filteredChoices.length - 1)
        );
        displayChoices();
      }
    };

    process.stdin.on("data", handleKey);
  });
}

// AWS Regions list
const AWS_REGIONS = [
  { name: "US East (N. Virginia) - us-east-1", value: "us-east-1" },
  { name: "US East (Ohio) - us-east-2", value: "us-east-2" },
  { name: "US West (N. California) - us-west-1", value: "us-west-1" },
  { name: "US West (Oregon) - us-west-2", value: "us-west-2" },
  { name: "Europe (Ireland) - eu-west-1", value: "eu-west-1" },
  { name: "Europe (London) - eu-west-2", value: "eu-west-2" },
  { name: "Europe (Paris) - eu-west-3", value: "eu-west-3" },
  { name: "Europe (Frankfurt) - eu-central-1", value: "eu-central-1" },
  { name: "Europe (Stockholm) - eu-north-1", value: "eu-north-1" },
  { name: "Europe (Milan) - eu-south-1", value: "eu-south-1" },
  { name: "Asia Pacific (Tokyo) - ap-northeast-1", value: "ap-northeast-1" },
  { name: "Asia Pacific (Seoul) - ap-northeast-2", value: "ap-northeast-2" },
  { name: "Asia Pacific (Osaka) - ap-northeast-3", value: "ap-northeast-3" },
  {
    name: "Asia Pacific (Singapore) - ap-southeast-1",
    value: "ap-southeast-1",
  },
  { name: "Asia Pacific (Sydney) - ap-southeast-2", value: "ap-southeast-2" },
  { name: "Asia Pacific (Jakarta) - ap-southeast-3", value: "ap-southeast-3" },
  { name: "Asia Pacific (Mumbai) - ap-south-1", value: "ap-south-1" },
  { name: "Canada (Central) - ca-central-1", value: "ca-central-1" },
  { name: "South America (São Paulo) - sa-east-1", value: "sa-east-1" },
  { name: "Africa (Cape Town) - af-south-1", value: "af-south-1" },
  { name: "Middle East (Bahrain) - me-south-1", value: "me-south-1" },
  { name: "Middle East (UAE) - me-central-1", value: "me-central-1" },
  { name: "Asia Pacific (Hong Kong) - ap-east-1", value: "ap-east-1" },
];

// Helper function for formatting profile choices
function formatProfileChoice(
  profile: any,
  projectName?: string,
  diligentContent?: string
): string {
  let choice = chalk.bold(profile.name);

  // Add prioritization indicator using the same matching logic as sorting
  if (projectName) {
    const containsProject = profile.name
      .toLowerCase()
      .includes(projectName.toLowerCase());
    const projectContainsProfile = projectName
      .toLowerCase()
      .includes(profile.name.toLowerCase());

    // Check for word-based partial matches (e.g., "rc-audit" should match "audit-tools")
    const projectWords = projectName
      .split(/[-_\s]+/)
      .filter((word: string) => word.length > 2);
    const profileWords = profile.name
      .toLowerCase()
      .split(/[-_\s]+/)
      .filter((word: string) => word.length > 2);

    const partialMatch = projectWords.some((pWord: string) =>
      profileWords.some(
        (profileWord: string) =>
          profileWord.includes(pWord) || pWord.includes(profileWord)
      )
    );

    if (containsProject || projectContainsProfile || partialMatch) {
      choice = chalk.green(`⭐ ${choice}`);
    }
  }

  // Add diligent content matching indicator
  if (diligentContent) {
    const diligentMatch = diligentContent
      .toLowerCase()
      .includes(profile.name.toLowerCase());
    if (diligentMatch) {
      choice = chalk.green(`⭐ ${choice}`);
    }
  }

  return choice;
}

async function promptForRegion(): Promise<string> {
  console.log(chalk.blue.bold("🌍 AWS Region Selection"));
  console.log(chalk.gray("Please select the AWS region to work with:"));
  console.log("");

  const region = (await customSearchableSelect(
    AWS_REGIONS,
    "Select AWS region:"
  )) as string;

  console.log(chalk.green(`✅ Selected region: ${region}`));
  console.log("");

  // Small delay to ensure terminal is properly reset
  await new Promise((resolve) => setTimeout(resolve, 100));

  return region;
}

async function promptForAuthentication(
  cdkService: CDKStackService,
  selectedRegion: string
): Promise<boolean> {
  console.log(chalk.blue.bold("🔐 AWS Authentication Required"));
  console.log(chalk.gray("Please choose your authentication method:"));
  console.log("");

  const authChoices = [
    { name: "🔐 AWS Vault (Recommended)", value: "vault" },
    { name: "🔑 Access Key & Secret Key", value: "credentials" },
    { name: "⚙️  Use existing AWS credentials", value: "existing" },
    { name: "❌ Exit", value: "exit" },
  ];

  const authMethod = (await customSearchableSelect(
    authChoices,
    "How would you like to authenticate?"
  )) as string;

  switch (authMethod) {
    case "vault":
      return await handleVaultAuthentication(cdkService);
    case "credentials":
      return await handleCredentialsAuthentication(cdkService, selectedRegion);
    case "existing":
      return await handleExistingCredentials(cdkService);
    case "exit":
      return false;
    default:
      return false;
  }
}

async function handleVaultAuthentication(
  cdkService: CDKStackService
): Promise<boolean> {
  const vaultInstalled = await cdkService.checkVaultInstalled();
  if (!vaultInstalled) {
    console.log(chalk.red("❌ AWS Vault is not installed."));
    console.log(chalk.gray("Please install AWS Vault first:"));
    console.log(chalk.gray("  macOS: brew install aws-vault"));
    console.log(chalk.gray("  Linux: sudo snap install aws-vault"));
    console.log(chalk.gray("  Visit: https://github.com/99designs/aws-vault"));
    return false;
  }

  try {
    const profiles = await cdkService.listVaultProfiles();

    if (profiles.length === 0) {
      console.log(chalk.yellow("⚠️  No AWS profiles found."));
      console.log(
        chalk.gray(
          "Please configure AWS profiles in ~/.aws/config or ~/.aws/credentials"
        )
      );
      return false;
    }

    console.log(chalk.green(`✅ Found ${profiles.length} AWS profiles`));
    console.log("");

    // Detect project name for profile prioritization
    let projectName = "";
    let diligentContent = "";

    // First, try to find .diligent/*.yaml files in repository root
    try {
      const fs = require("fs");
      const path = require("path");

      // Find repository root first (where lock files are)
      let repoRoot = process.cwd();
      let foundRepoRoot = false;

      while (repoRoot !== path.dirname(repoRoot)) {
        const lockFiles = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"];
        const hasLockFile = lockFiles.some((lockFile) =>
          fs.existsSync(path.join(repoRoot, lockFile))
        );

        if (hasLockFile) {
          // Check if this directory also has a .diligent folder
          const diligentDir = path.join(repoRoot, ".diligent");
          if (fs.existsSync(diligentDir)) {
            foundRepoRoot = true;
            break;
          }
        }
        repoRoot = path.dirname(repoRoot);
      }

      // If no directory with both lock file and .diligent found, fall back to any directory with lock file
      if (!foundRepoRoot) {
        repoRoot = process.cwd();
        while (repoRoot !== path.dirname(repoRoot)) {
          const lockFiles = [
            "package-lock.json",
            "pnpm-lock.yaml",
            "yarn.lock",
          ];
          const hasLockFile = lockFiles.some((lockFile) =>
            fs.existsSync(path.join(repoRoot, lockFile))
          );
          if (hasLockFile) {
            break;
          }
          repoRoot = path.dirname(repoRoot);
        }
      }

      // Look for .diligent/*.yaml files in the repository root
      const diligentDir = path.join(repoRoot, ".diligent");
      if (fs.existsSync(diligentDir)) {
        const yamlFiles = fs
          .readdirSync(diligentDir)
          .filter((file: string) => file.endsWith(".yaml"));
        if (yamlFiles.length > 0) {
          // Read the first yaml file content
          const yamlContent = fs.readFileSync(
            path.join(diligentDir, yamlFiles[0]),
            "utf8"
          );
          diligentContent = yamlContent.toLowerCase();

          // Use the first yaml file name (without extension) as project name
          projectName = yamlFiles[0].replace(".yaml", "").toLowerCase();
        }
      }
    } catch (error) {
      // Ignore errors, fall back to repo name
    }

    // Fallback to repository name if no .diligent yaml files found
    if (!projectName) {
      // Traverse up the directory tree to find the repository root (where package-lock.json or pnpm-lock.yaml exists)
      let currentDir = process.cwd();
      const fs = require("fs");
      const path = require("path");

      // Look for repository root indicators
      while (currentDir !== path.dirname(currentDir)) {
        // Stop at root directory
        // Check for common lock files that indicate a repository root
        const lockFiles = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"];
        const hasLockFile = lockFiles.some((lockFile) =>
          fs.existsSync(path.join(currentDir, lockFile))
        );

        if (hasLockFile) {
          projectName = path.basename(currentDir).toLowerCase();
          break;
        }

        currentDir = path.dirname(currentDir);
      }

      // If we still don't have a project name, use the current directory name
      if (!projectName) {
        projectName = process.cwd().split("/").pop()?.toLowerCase() || "";
      }
    }

    // Sort profiles to prioritize those containing the project name or diligent content
    const sortedProfiles = profiles.sort((a: any, b: any) => {
      const aContainsProject = a.name.toLowerCase().includes(projectName);
      const bContainsProject = b.name.toLowerCase().includes(projectName);

      // Also check if project name contains parts of the profile name (bidirectional matching)
      const aProjectContainsProfile = projectName.includes(
        a.name.toLowerCase()
      );
      const bProjectContainsProfile = projectName.includes(
        b.name.toLowerCase()
      );

      // Check for word-based partial matches (e.g., "rc-audit" should match "audit-tools")
      const projectWords = projectName
        .split(/[-_\s]+/)
        .filter((word: string) => word.length > 2);
      const aWords = a.name
        .toLowerCase()
        .split(/[-_\s]+/)
        .filter((word: string) => word.length > 2);
      const bWords = b.name
        .toLowerCase()
        .split(/[-_\s]+/)
        .filter((word: string) => word.length > 2);

      const aPartialMatch = projectWords.some((pWord: string) =>
        aWords.some(
          (aWord: string) => aWord.includes(pWord) || pWord.includes(aWord)
        )
      );
      const bPartialMatch = projectWords.some((pWord: string) =>
        bWords.some(
          (bWord: string) => bWord.includes(pWord) || pWord.includes(bWord)
        )
      );

      // Also check if profile name appears in diligent content (case-insensitive)
      const aInDiligent =
        diligentContent &&
        diligentContent.toLowerCase().includes(a.name.toLowerCase());
      const bInDiligent =
        diligentContent &&
        diligentContent.toLowerCase().includes(b.name.toLowerCase());

      // Prioritize profiles that match any of the criteria
      const aMatches =
        aContainsProject ||
        aProjectContainsProfile ||
        aPartialMatch ||
        aInDiligent;
      const bMatches =
        bContainsProject ||
        bProjectContainsProfile ||
        bPartialMatch ||
        bInDiligent;

      if (aMatches && !bMatches) return -1;
      if (!aMatches && bMatches) return 1;
      return 0; // Keep original order if both or neither match
    });

    // Debug: Show detected project name and diligent content
    if (projectName) {
      console.log(chalk.gray(`🔍 Detected project name: "${projectName}"`));
    }
    if (diligentContent) {
      console.log(
        chalk.gray(`🔍 Detected diligent content: "${diligentContent}"`)
      );
    }
    if (!projectName && !diligentContent) {
      console.log(
        chalk.gray(`🔍 No project name or diligent content detected`)
      );
    }
    console.log("");

    // Debug: Show which profiles match
    console.log(chalk.gray("🔍 Checking profile matches:"));
    sortedProfiles.forEach((profile: any) => {
      const containsProject = profile.name
        .toLowerCase()
        .includes(projectName.toLowerCase());
      const projectContainsProfile = projectName
        .toLowerCase()
        .includes(profile.name.toLowerCase());
      if (containsProject || projectContainsProfile) {
        console.log(
          chalk.gray(`  ⭐ ${profile.name} matches project "${projectName}"`)
        );
      }
    });
    console.log("");

    // Show profile selection with arrow navigation
    const choices = sortedProfiles.map((profile: any) => ({
      name: formatProfileChoice(profile, projectName, diligentContent),
      value: profile.name,
      short: profile.name,
    }));

    const selectedProfile = (await customSearchableSelect(
      choices,
      "Select an AWS profile:"
    )) as string;

    // Login with selected profile (AWS Vault handles session duration)
    const success = await cdkService.loginWithVault(selectedProfile);

    if (success) {
      // Show session info
      const session = cdkService.getCurrentSession();
      if (session) {
        // Remove region display - CDK will handle region determination
        if (session.credentials.expiration) {
          console.log(
            chalk.gray(
              `Session expires: ${session.credentials.expiration.toLocaleString()}`
            )
          );
        }
      }

      return true;
    } else {
      console.log(
        chalk.red(`❌ Failed to login with profile: ${selectedProfile}`)
      );
      return false;
    }
  } catch (error) {
    console.error(
      chalk.red("❌ Error during vault authentication:"),
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}

async function handleCredentialsAuthentication(
  cdkService: CDKStackService,
  selectedRegion: string
): Promise<boolean> {
  const credentials = await inquirer.prompt([
    {
      type: "input",
      name: "accessKeyId",
      message: "AWS Access Key ID:",
      validate: (input) => input.length > 0 || "Access Key ID is required",
    },
    {
      type: "password",
      name: "secretAccessKey",
      message: "AWS Secret Access Key:",
      validate: (input) => input.length > 0 || "Secret Access Key is required",
    },
  ]);

  // Check if this is a temporary credential (starts with ASIA)
  const isTemporaryCredential = credentials.accessKeyId.startsWith("ASIA");

  let sessionToken: string | undefined;
  if (isTemporaryCredential) {
    const sessionTokenPrompt = await inquirer.prompt([
      {
        type: "password",
        name: "sessionToken",
        message: "AWS Session Token (required for temporary credentials):",
        validate: (input) =>
          input.length > 0 ||
          "Session Token is required for temporary credentials",
      },
    ]);
    sessionToken = sessionTokenPrompt.sessionToken;
  }

  try {
    // Set credentials directly in the CDK service using the selected region
    await cdkService.setDirectCredentials({
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: sessionToken,
      region: selectedRegion,
    });

    console.log(chalk.green("✅ Credentials set successfully"));
    return true;
  } catch (error) {
    console.error(
      chalk.red("❌ Failed to set credentials:"),
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}

async function handleExistingCredentials(
  cdkService: CDKStackService
): Promise<boolean> {
  console.log(
    chalk.blue(
      "ℹ️  Using existing AWS credentials from environment or AWS CLI configuration"
    )
  );

  try {
    const connected = await cdkService.verifyConnection();
    if (connected) {
      console.log(
        chalk.green("✅ Successfully connected with existing credentials")
      );
      return true;
    } else {
      console.log(chalk.red("❌ Failed to connect with existing credentials"));
      return false;
    }
  } catch (error) {
    console.error(
      chalk.red("❌ Error verifying existing credentials:"),
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .scriptName("cdk-interactive")
    .usage("$0 [options]")
    .option("profile", {
      alias: "p",
      type: "string",
      description: "AWS profile to use",
      default: "default",
    })
    .option("region", {
      alias: "r",
      type: "string",
      description: "AWS region to use",
      default: "us-east-1",
    })
    .option("verbose", {
      type: "boolean",
      description: "Enable verbose logging",
      default: false,
    })
    .option("config", {
      alias: "c",
      type: "string",
      description: "Path to configuration file",
      default: "./cdk-config.json",
    })
    .option("vault-profile", {
      type: "string",
      description: "AWS Vault profile to use (bypasses authentication prompt)",
    })
    .option("vault-duration", {
      type: "number",
      description:
        "AWS Vault session duration in seconds (only for --vault-profile)",
      default: 3600,
    })
    .option("app", {
      alias: "a",
      type: "string",
      description: "CDK app path (e.g., ./bin/pipeline.ts)",
    })
    .help()
    .version()
    .epilogue(
      "Interactive AWS CDK CLI for managing stacks with arrow navigation"
    ).argv;

  try {
    console.log(chalk.blue.bold("🚀 AWS CDK Interactive CLI"));
    console.log(chalk.gray(`Using AWS Profile: ${argv.profile}`));
    console.log("");

    // Initialize configuration
    const configService = new ConfigService(argv.config);
    const config = await configService.loadConfig();

    console.log(
      chalk.gray(`📁 Using ${config ? "custom" : "default"} configuration`)
    );
    console.log("");

    // Prompt for region selection
    const selectedRegion = await promptForRegion();

    // Initialize CDK service
    const cdkService = new CDKStackService({
      profile: argv.profile,
      region: selectedRegion,
      verbose: argv.verbose,
      appPath: argv.app,
    });

    // Handle authentication first
    let authenticated = false;

    // Check if vault profile is specified via command line
    if (argv.vaultProfile) {
      const vaultInstalled = await cdkService.checkVaultInstalled();
      if (!vaultInstalled) {
        console.log(
          chalk.red("❌ AWS Vault is not installed. Please install it first.")
        );
        console.log(
          chalk.gray("Visit: https://github.com/99designs/aws-vault")
        );
        process.exit(1);
      }

      const success = await cdkService.loginWithVault(
        argv.vaultProfile,
        argv.vaultDuration
      );
      if (success) {
        console.log(
          chalk.green(
            `✅ Successfully logged in with vault profile: ${argv.vaultProfile}`
          )
        );
        authenticated = true;
      } else {
        console.log(
          chalk.red(
            `❌ Failed to login with vault profile: ${argv.vaultProfile}`
          )
        );
        process.exit(1);
      }
    } else {
      // Prompt for authentication method
      authenticated = await promptForAuthentication(cdkService, selectedRegion);
    }

    if (!authenticated) {
      console.log(chalk.red("❌ Authentication failed. Exiting."));
      process.exit(1);
    }

    // Initialize interactive manager
    const interactiveManager = new InteractiveCDKManager(cdkService, config);

    // Start interactive session
    await interactiveManager.start();
  } catch (error) {
    console.error(
      chalk.red.bold("❌ Error:"),
      error instanceof Error ? error.message : String(error)
    );

    if (argv.verbose && error instanceof Error) {
      console.error(chalk.gray("Stack trace:"));
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error(chalk.red.bold("❌ Uncaught Exception:"), error.message);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error(chalk.red.bold("❌ Unhandled Rejection:"), reason);
  process.exit(1);
});

main().catch((error) => {
  console.error(chalk.red.bold("❌ Fatal Error:"), error);
  process.exit(1);
});
