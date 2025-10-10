export class ValidationUtils {
  static validateAWSProfile(profile: string): boolean {
    // AWS profile names can contain letters, numbers, hyphens, and underscores
    // They cannot start with a hyphen
    const profileRegex = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
    return profileRegex.test(profile) && profile.length <= 64;
  }

  static validateAWSRegion(region: string): boolean {
    // Basic AWS region format validation
    const regionRegex = /^[a-z]{2}-[a-z]+-\d+$/;
    return regionRegex.test(region);
  }

  static validateStackName(stackName: string): boolean {
    // CloudFormation stack names can contain letters, numbers, hyphens, and underscores
    // They cannot start with a hyphen
    const stackNameRegex = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
    return stackNameRegex.test(stackName) && stackName.length <= 128;
  }

  static validateConfigPath(configPath: string): boolean {
    // Basic path validation
    return configPath.length > 0 && !configPath.includes('..');
  }

  static validateRefreshInterval(interval: number): boolean {
    return Number.isInteger(interval) && interval > 0 && interval <= 3600; // Max 1 hour
  }

  static sanitizeInput(input: string): string {
    // Remove potentially dangerous characters
    return input.replace(/[<>:"/\\|?*]/g, '').trim();
  }

  static validateCDKAppDirectory(path: string): boolean {
    // Check if directory contains CDK app files
    // This is a simplified check - in production you'd want more thorough validation
    return path.length > 0 && !path.includes('..');
  }

  static validateTags(tags: Record<string, string>): boolean {
    if (!tags || typeof tags !== 'object') {
      return false;
    }

    for (const [key, value] of Object.entries(tags)) {
      // Tag keys and values have specific requirements
      if (!key || key.length > 128 || !value || value.length > 256) {
        return false;
      }
      
      // Tag keys cannot contain certain characters
      if (!/^[a-zA-Z0-9\s_.:/=+\-@]+$/.test(key)) {
        return false;
      }
    }

    return true;
  }

  static validateParameters(parameters: Record<string, string>): boolean {
    if (!parameters || typeof parameters !== 'object') {
      return false;
    }

    for (const [key, value] of Object.entries(parameters)) {
      if (!key || key.length > 255 || !value || value.length > 4096) {
        return false;
      }
    }

    return true;
  }
}
