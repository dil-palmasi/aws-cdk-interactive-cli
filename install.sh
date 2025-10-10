#!/bin/bash

# AWS CDK Interactive CLI Installation Script

set -e

echo "🚀 Installing AWS CDK Interactive CLI..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16.0.0 or higher."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
REQUIRED_VERSION="16.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please install Node.js 16.0.0 or higher."
    exit 1
fi

echo "✅ Node.js version $NODE_VERSION detected"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm."
    exit 1
fi

echo "✅ npm detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building the project..."
npm run build

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "⚠️  AWS CLI is not installed. Please install it for full functionality."
    echo "   Visit: https://aws.amazon.com/cli/"
else
    echo "✅ AWS CLI detected"
fi

# Check if CDK CLI is installed
if ! command -v cdk &> /dev/null; then
    echo "⚠️  AWS CDK CLI is not installed. Please install it for deploy functionality."
    echo "   Run: npm install -g aws-cdk"
else
    echo "✅ AWS CDK CLI detected"
fi

# Create sample configuration if it doesn't exist
if [ ! -f "cdk-config.json" ]; then
    echo "📝 Creating sample configuration file..."
    cp cdk-config.json cdk-config.json.example
fi

echo ""
echo "🎉 Installation completed successfully!"
echo ""
echo "To get started:"
echo "  1. Configure your AWS credentials: aws configure"
echo "  2. Run the CLI: npm run dev"
echo "  3. Or build and run: npm run build && npm start"
echo ""
echo "For more information, see README.md"
