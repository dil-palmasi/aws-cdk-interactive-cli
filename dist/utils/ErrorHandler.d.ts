export declare class ErrorHandler {
    static handleError(error: unknown, context: string): void;
    static handleAWSError(error: unknown, operation: string): void;
    static handleCDKError(error: unknown, operation: string): void;
    static handleValidationError(message: string, suggestions?: string[]): void;
    static handleNetworkError(error: unknown): void;
    static logWarning(message: string): void;
    static logInfo(message: string): void;
    static logSuccess(message: string): void;
}
//# sourceMappingURL=ErrorHandler.d.ts.map