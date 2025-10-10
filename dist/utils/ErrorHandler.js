"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorHandler = void 0;
const chalk_1 = __importDefault(require("chalk"));
class ErrorHandler {
    static handleError(error, context) {
        if (error instanceof Error) {
            console.error(chalk_1.default.red.bold(`❌ ${context}:`), error.message);
            // Log stack trace in development
            if (process.env.NODE_ENV === "development") {
                console.error(chalk_1.default.gray("Stack trace:"));
                console.error(error.stack);
            }
        }
        else {
            console.error(chalk_1.default.red.bold(`❌ ${context}:`), String(error));
        }
    }
    static handleAWSError(error, operation) {
        if (error instanceof Error) {
            // Check for common AWS error patterns
            if (error.message.includes("CredentialsError")) {
                console.error(chalk_1.default.red.bold("❌ AWS Credentials Error:"));
                console.error(chalk_1.default.yellow("Please check your AWS credentials configuration."));
                console.error(chalk_1.default.gray("You can configure credentials using:"));
                console.error(chalk_1.default.gray("  - AWS CLI: aws configure"));
                console.error(chalk_1.default.gray("  - Environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY"));
                console.error(chalk_1.default.gray("  - IAM roles (if running on EC2)"));
            }
            else if (error.message.includes("AccessDenied")) {
                console.error(chalk_1.default.red.bold("❌ AWS Access Denied:"));
                console.error(chalk_1.default.yellow("Your AWS credentials do not have sufficient permissions."));
                console.error(chalk_1.default.gray("Required permissions: CloudFormation:ListStacks, CloudFormation:DescribeStacks"));
            }
            else if (error.message.includes("Region")) {
                console.error(chalk_1.default.red.bold("❌ AWS Region Error:"));
                console.error(chalk_1.default.yellow("Invalid or unsupported AWS region."));
                console.error(chalk_1.default.gray("Please check your region configuration."));
            }
            else {
                console.error(chalk_1.default.red.bold(`❌ AWS ${operation} Error:`), error.message);
            }
        }
        else {
            console.error(chalk_1.default.red.bold(`❌ AWS ${operation} Error:`), String(error));
        }
    }
    static handleCDKError(error, operation) {
        if (error instanceof Error) {
            if (error.message.includes("not found") ||
                error.message.includes("command not found")) {
                console.error(chalk_1.default.red.bold("❌ CDK CLI Not Found:"));
                console.error(chalk_1.default.yellow("AWS CDK CLI is not installed or not in PATH."));
                console.error(chalk_1.default.gray("Install it using: npm install -g aws-cdk"));
            }
            else if (error.message.includes("synthesis")) {
                console.error(chalk_1.default.red.bold("❌ CDK Synthesis Error:"));
                console.error(chalk_1.default.yellow("Failed to synthesize CDK app."));
                console.error(chalk_1.default.gray("Please check your CDK code for errors."));
            }
            else if (error.message.includes("deploy")) {
                console.error(chalk_1.default.red.bold("❌ CDK Deploy Error:"));
                console.error(chalk_1.default.yellow("Failed to deploy CDK stack."));
                console.error(chalk_1.default.gray("Check CloudFormation console for detailed error information."));
            }
            else {
                console.error(chalk_1.default.red.bold(`❌ CDK ${operation} Error:`), error.message);
            }
        }
        else {
            console.error(chalk_1.default.red.bold(`❌ CDK ${operation} Error:`), String(error));
        }
    }
    static handleValidationError(message, suggestions) {
        console.error(chalk_1.default.red.bold("❌ Validation Error:"), message);
        if (suggestions && suggestions.length > 0) {
            console.error(chalk_1.default.yellow("Suggestions:"));
            suggestions.forEach((suggestion) => {
                console.error(chalk_1.default.gray(`  - ${suggestion}`));
            });
        }
    }
    static handleNetworkError(error) {
        if (error instanceof Error) {
            if (error.message.includes("timeout")) {
                console.error(chalk_1.default.red.bold("❌ Network Timeout:"));
                console.error(chalk_1.default.yellow("Request timed out. Please check your internet connection."));
            }
            else if (error.message.includes("ENOTFOUND") ||
                error.message.includes("ECONNREFUSED")) {
                console.error(chalk_1.default.red.bold("❌ Network Connection Error:"));
                console.error(chalk_1.default.yellow("Cannot connect to AWS services. Please check your network connection."));
            }
            else {
                console.error(chalk_1.default.red.bold("❌ Network Error:"), error.message);
            }
        }
        else {
            console.error(chalk_1.default.red.bold("❌ Network Error:"), String(error));
        }
    }
    static logWarning(message) {
        console.warn(chalk_1.default.yellow.bold("⚠️  Warning:"), message);
    }
    static logInfo(message) {
        console.log(chalk_1.default.blue.bold("ℹ️  Info:"), message);
    }
    static logSuccess(message) {
        console.log(chalk_1.default.green.bold("✅ Success:"), message);
    }
}
exports.ErrorHandler = ErrorHandler;
//# sourceMappingURL=ErrorHandler.js.map