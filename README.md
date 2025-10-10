# AWS CDK Interactive CLI (`cdki`)

A powerful, interactive command-line interface for managing AWS CDK stacks with arrow navigation, AWS Vault integration, and intuitive controls.

## Features

- 🎯 **Interactive Stack Management**: Navigate through your CDK stacks using arrow keys
- 🚀 **Deploy & Delete**: Deploy or delete stacks directly from the interactive interface
- 📊 **Real-time Status**: View stack status with color-coded indicators
- 🔐 **AWS Vault Integration**: Secure profile-based authentication with session management
- 👤 **Profile Management**: List and select AWS profiles from ~/.aws/config
- ⚙️ **Configurable Settings**: Customize behavior through configuration files
- 🔍 **Detailed Information**: Get comprehensive stack details and metadata
- 🛡️ **Safety Features**: Confirmation prompts for destructive operations
- 🌍 **Multi-Region Support**: Work with stacks across different AWS regions
- 🔑 **Session Management**: Automatic credential refresh and expiration handling

## Installation

### Prerequisites

- Node.js 16.0.0 or higher
- AWS CLI configured with appropriate credentials
- AWS CDK CLI installed globally (`npm install -g aws-cdk`)
- AWS Vault installed (optional but recommended for secure credential management)

### Install the CLI

```bash
# Clone the repository
git clone <repository-url>
cd aws-cdki-cli

# Install dependencies
npm install

# Build the project
npm run build

# Install globally (optional)
npm link
```

## Usage

### Basic Usage

```bash
# Start the interactive CLI
cdki

# Use specific AWS profile
cdki --profile my-profile

# Use specific AWS region
cdki --region us-west-2

# Enable verbose logging
cdki --verbose

# Login with specific AWS Vault profile (bypasses authentication prompt)
cdki --vault-profile my-profile --vault-duration 7200
```

### Command Line Options

| Option             | Short | Description                                                      | Default             |
| ------------------ | ----- | ---------------------------------------------------------------- | ------------------- |
| `--profile`        | `-p`  | AWS profile to use                                               | `default`           |
| `--region`         | `-r`  | AWS region to use                                                | `us-east-1`         |
| `--verbose`        | -     | Enable verbose logging                                           | `false`             |
| `--config`         | `-c`  | Path to configuration file                                       | `./cdk-config.json` |
| `--vault-profile`  | -     | AWS Vault profile to use (bypasses auth prompt)                  | -                   |
| `--vault-duration` | -     | AWS Vault session duration in seconds (only for --vault-profile) | `3600`              |
| `--help`           | `-h`  | Show help information                                            | -                   |
| `--version`        | -     | Show version information                                         | -                   |

## Interactive Interface

### Authentication Flow

When you start the CLI, it will prompt you to choose your authentication method:

```
🔐 AWS Authentication Required
Please choose your authentication method:

? How would you like to authenticate?
❯ 🔐 AWS Vault (Recommended)
  🔑 Access Key & Secret Key
  ⚙️  Use existing AWS credentials
  ❌ Exit
```

#### AWS Vault Authentication (Recommended)

If you select AWS Vault, the CLI will:

1. **List Available Profiles**: Shows all profiles from `~/.aws/config` and `~/.aws/credentials`
2. **Profile Selection**: Navigate with arrow keys and select with Enter
3. **Secure Login**: Uses AWS Vault to get temporary credentials (AWS Vault handles session duration)

Profile indicators:

- **🔐**: AWS SSO (Single Sign-On) profile
- **🔗**: Role-based profile
- **🔐**: MFA-enabled profile
- **Region**: Shows configured region

#### AWS SSO Integration

The CLI supports AWS SSO (Single Sign-On) through multiple methods:

##### Method 1: AWS Access Portal (Recommended)

Direct integration with your AWS SSO portal:

1. **Select "🌐 AWS Access Portal"** from the authentication menu
2. **Enter SSO Details**: Provide your SSO start URL and region
3. **Choose Account**: Select from available AWS accounts
4. **Select Role**: Choose the role you want to assume
5. **Authenticate**: Complete authentication in your browser

This method provides the most direct integration with your SSO portal at [https://d-9267742869.awsapps.com/start](https://d-9267742869.awsapps.com/start).

##### Method 2: AWS Vault Integration

Configure SSO profiles through AWS Vault:

1. **Add SSO Profile to AWS Vault**:

   ```bash
   aws-vault add --sso-start-url https://your-sso-portal.awsapps.com/start --sso-region us-east-1 sso-profile
   ```

2. **Configure in AWS Config** (`~/.aws/config`):

   ```ini
   [profile sso-profile]
   sso_start_url = https://your-sso-portal.awsapps.com/start
   sso_region = us-east-1
   sso_account_id = 123456789012
   sso_role_name = YourRoleName
   region = us-east-1
   ```

3. **Use with CLI**:
   ```bash
   cdki --vault-profile sso-profile
   ```

The CLI will automatically detect SSO profiles and show them with a 🔐 indicator.

#### Direct Credentials

For direct credential entry (not recommended for security):

- Enter AWS Access Key ID
- Enter AWS Secret Access Key
- Specify AWS Region

#### Existing Credentials

Uses credentials from:

- Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
- AWS CLI configuration (`aws configure`)
- IAM roles (if running on EC2)

### Main Menu

The main interface displays all your CDK stacks with their current status:

```
🚀 AWS CDK Interactive CLI
Using AWS Profile: default
Using AWS Region: us-east-1

Select a CDK stack:
❯ ✅ MyApp-Prod (CREATE_COMPLETE)
  ⏳ MyApp-Dev (UPDATE_IN_PROGRESS)
  ❌ MyApp-Test (CREATE_FAILED)
  ─────────────────────────────
  🔄 Refresh stacks
  ⚙️  Settings
  ❌ Exit
```

### Stack Actions

For each stack, you can perform the following actions:

- **📋 View detailed information**: See comprehensive stack details
- **🚀 Deploy stack**: Deploy the selected stack
- **🗑️ Delete stack**: Delete the selected stack (with confirmation)
- **🔄 Refresh stack status**: Update stack information
- **⬅️ Back to main menu**: Return to the main interface

### Status Indicators

| Icon | Status                                       | Description                      |
| ---- | -------------------------------------------- | -------------------------------- |
| ✅   | CREATE_COMPLETE, UPDATE_COMPLETE             | Stack is healthy and operational |
| ❌   | CREATE_FAILED, UPDATE_FAILED, etc.           | Stack has failed operations      |
| ⏳   | CREATE_IN_PROGRESS, UPDATE_IN_PROGRESS, etc. | Stack operation in progress      |
| 🔄   | ROLLBACK_COMPLETE, UPDATE_ROLLBACK_COMPLETE  | Stack rolled back                |
| 📦   | Other statuses                               | Default indicator                |

## Configuration

### Configuration File (Optional)

You can optionally create a `cdk-config.json` file in your project directory:

```json
{
  "autoRefresh": false,
  "refreshInterval": 30,
  "defaultAction": "info",
  "confirmActions": true
}
```

### Configuration Options

| Option            | Type    | Description                                  | Default  |
| ----------------- | ------- | -------------------------------------------- | -------- |
| `autoRefresh`     | boolean | Automatically refresh stack list             | `false`  |
| `refreshInterval` | number  | Refresh interval in seconds                  | `30`     |
| `defaultAction`   | string  | Default action for stack selection           | `"info"` |
| `confirmActions`  | boolean | Require confirmation for destructive actions | `true`   |

## AWS Setup

### AWS Vault Integration (Recommended)

AWS Vault provides secure credential management and is the recommended way to use this CLI:

1. **Install AWS Vault**:

   ```bash
   # macOS
   brew install aws-vault

   # Linux
   sudo snap install aws-vault

   # Or download from GitHub releases
   ```

2. **Configure AWS Profiles**:

   ```bash
   # Add profiles to ~/.aws/config
   aws-vault add my-profile
   ```

3. **Use with CLI**:

   ```bash
   # Interactive vault login
   cdki --vault

   # Direct profile login
   cdki --vault-profile my-profile
   ```

### Traditional Credentials Configuration

The CLI also supports traditional AWS credential methods:

1. **AWS CLI Configuration**:

   ```bash
   aws configure
   ```

2. **Environment Variables**:

   ```bash
   export AWS_ACCESS_KEY_ID=your_access_key
   export AWS_SECRET_ACCESS_KEY=your_secret_key
   export AWS_DEFAULT_REGION=us-east-1
   ```

3. **IAM Roles** (if running on EC2)

### Required Permissions

Your AWS credentials need the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:ListStacks",
        "cloudformation:DescribeStacks",
        "cloudformation:DeleteStack",
        "cloudformation:DescribeStackEvents",
        "sts:GetCallerIdentity"
      ],
      "Resource": "*"
    }
  ]
}
```

## Development

### Project Structure

```
src/
├── index.ts                    # Main CLI entry point
├── services/
│   ├── CDKStackService.ts      # AWS CloudFormation operations
│   ├── InteractiveCDKManager.ts # Interactive UI management
│   ├── ConfigService.ts        # Configuration management
│   └── CDKCommandExecutor.ts   # CDK CLI command execution
└── utils/
    ├── ErrorHandler.ts         # Error handling utilities
    └── ValidationUtils.ts       # Input validation utilities
```

### Building

```bash
# Development build
npm run build

# Development mode with watch
npm run dev

# Clean build artifacts
npm run clean
```

### Testing

```bash
# Run tests (when implemented)
npm test

# Run tests with coverage
npm run test:coverage
```

## Troubleshooting

### Common Issues

1. **AWS Credentials Error**:

   ```
   ❌ AWS Credentials Error: Please check your AWS credentials configuration.
   ```

   - Solution: Run `aws configure` or set environment variables

2. **CDK CLI Not Found**:

   ```
   ❌ CDK CLI Not Found: AWS CDK CLI is not installed or not in PATH.
   ```

   - Solution: Install CDK CLI with `npm install -g aws-cdk`

3. **Access Denied**:

   ```
   ❌ AWS Access Denied: Your AWS credentials do not have sufficient permissions.
   ```

   - Solution: Ensure your credentials have the required CloudFormation permissions

4. **No Stacks Found**:
   ```
   ⚠️ No CDK stacks found.
   ```
   - Solution: Verify you're in the correct AWS region and have CDK stacks deployed

### Debug Mode

Enable verbose logging to see detailed information:

```bash
cdki --verbose
```

### Log Files

The CLI doesn't create log files by default. For debugging, redirect output:

```bash
cdki --verbose > cdk-cli.log 2>&1
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:

- Create an issue in the GitHub repository
- Check the troubleshooting section above
- Review AWS CDK documentation for CDK-specific issues

## Changelog

### Version 1.0.0

- Initial release
- Interactive stack management
- Deploy and delete functionality
- Configuration support
- Multi-region and profile support
