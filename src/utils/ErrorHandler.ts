import chalk from "chalk";

export class ErrorHandler {
  static handleError(error: unknown, context: string): void {
    if (error instanceof Error) {
      console.error(chalk.red.bold(`❌ ${context}:`), error.message);

      // Log stack trace in development
      if (process.env.NODE_ENV === "development") {
        console.error(chalk.gray("Stack trace:"));
        console.error(error.stack);
      }
    } else {
      console.error(chalk.red.bold(`❌ ${context}:`), String(error));
    }
  }

  static handleAWSError(error: unknown, operation: string): void {
    if (error instanceof Error) {
      // Check for common AWS error patterns
      if (error.message.includes("CredentialsError")) {
        console.error(chalk.red.bold("❌ AWS Credentials Error:"));
        console.error(
          chalk.yellow("Please check your AWS credentials configuration.")
        );
        console.error(chalk.gray("You can configure credentials using:"));
        console.error(chalk.gray("  - AWS CLI: aws configure"));
        console.error(
          chalk.gray(
            "  - Environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY"
          )
        );
        console.error(chalk.gray("  - IAM roles (if running on EC2)"));
      } else if (error.message.includes("AccessDenied")) {
        console.error(chalk.red.bold("❌ AWS Access Denied:"));
        console.error(
          chalk.yellow(
            "Your AWS credentials do not have sufficient permissions."
          )
        );
        console.error(
          chalk.gray(
            "Required permissions: CloudFormation:ListStacks, CloudFormation:DescribeStacks"
          )
        );
      } else if (error.message.includes("Region")) {
        console.error(chalk.red.bold("❌ AWS Region Error:"));
        console.error(chalk.yellow("Invalid or unsupported AWS region."));
        console.error(chalk.gray("Please check your region configuration."));
      } else {
        console.error(
          chalk.red.bold(`❌ AWS ${operation} Error:`),
          error.message
        );
      }
    } else {
      console.error(
        chalk.red.bold(`❌ AWS ${operation} Error:`),
        String(error)
      );
    }
  }

  static handleCDKError(error: unknown, operation: string): void {
    if (error instanceof Error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("command not found")
      ) {
        console.error(chalk.red.bold("❌ CDK CLI Not Found:"));
        console.error(
          chalk.yellow("AWS CDK CLI is not installed or not in PATH.")
        );
        console.error(chalk.gray("Install it using: npm install -g aws-cdk"));
      } else if (error.message.includes("synthesis")) {
        console.error(chalk.red.bold("❌ CDK Synthesis Error:"));
        console.error(chalk.yellow("Failed to synthesize CDK app."));
        console.error(chalk.gray("Please check your CDK code for errors."));
      } else if (error.message.includes("deploy")) {
        console.error(chalk.red.bold("❌ CDK Deploy Error:"));
        console.error(chalk.yellow("Failed to deploy CDK stack."));
        console.error(
          chalk.gray(
            "Check CloudFormation console for detailed error information."
          )
        );
      } else {
        console.error(
          chalk.red.bold(`❌ CDK ${operation} Error:`),
          error.message
        );
      }
    } else {
      console.error(
        chalk.red.bold(`❌ CDK ${operation} Error:`),
        String(error)
      );
    }
  }

  static handleValidationError(message: string, suggestions?: string[]): void {
    console.error(chalk.red.bold("❌ Validation Error:"), message);

    if (suggestions && suggestions.length > 0) {
      console.error(chalk.yellow("Suggestions:"));
      suggestions.forEach((suggestion) => {
        console.error(chalk.gray(`  - ${suggestion}`));
      });
    }
  }

  static handleNetworkError(error: unknown): void {
    if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        console.error(chalk.red.bold("❌ Network Timeout:"));
        console.error(
          chalk.yellow(
            "Request timed out. Please check your internet connection."
          )
        );
      } else if (
        error.message.includes("ENOTFOUND") ||
        error.message.includes("ECONNREFUSED")
      ) {
        console.error(chalk.red.bold("❌ Network Connection Error:"));
        console.error(
          chalk.yellow(
            "Cannot connect to AWS services. Please check your network connection."
          )
        );
      } else {
        console.error(chalk.red.bold("❌ Network Error:"), error.message);
      }
    } else {
      console.error(chalk.red.bold("❌ Network Error:"), String(error));
    }
  }

  static logWarning(message: string): void {
    console.warn(chalk.yellow.bold("⚠️  Warning:"), message);
  }

  static logInfo(message: string): void {
    console.log(chalk.blue.bold("ℹ️  Info:"), message);
  }

  static logSuccess(message: string): void {
    console.log(chalk.green.bold("✅ Success:"), message);
  }
}
