export type ProviderType = 'openai' | 'anthropic' | 'local';
export interface AgentConfig {
    provider: ProviderType;
    apiKey: string;
    model: string;
    localEndpoint: string;
    maxRetries: number;
    verifyTests: boolean;
    verifyLint: boolean;
    testCommand: string;
    lintCommand: string;
}
export interface PlanStep {
    id: string;
    description: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: string;
    error?: string;
}
export interface AgentPlan {
    id: string;
    task: string;
    steps: PlanStep[];
    createdAt: number;
    status: 'planning' | 'ready' | 'executing' | 'completed' | 'failed';
}
export interface VerifyResult {
    passed: boolean;
    syntaxErrors: SyntaxError[];
    testResults: TestResult | null;
    lintResults: LintResult | null;
    summary: string;
}
export interface SyntaxError {
    file: string;
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning';
}
export interface TestResult {
    passed: boolean;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    output: string;
    duration: number;
}
export interface LintResult {
    passed: boolean;
    errorCount: number;
    warningCount: number;
    output: string;
}
export interface RecoveryAction {
    type: 'retry' | 'modify' | 'skip' | 'abort';
    description: string;
    modifiedCode?: string;
    modifiedCommand?: string;
}
export interface AgentEvent {
    type: 'plan' | 'execute' | 'verify' | 'recover' | 'complete' | 'error';
    timestamp: number;
    data: unknown;
}
export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface LLMResponse {
    content: string;
    model: string;
    usage: {
        promptTokens: number;
        completionTokens: number;
    };
}
export interface ILLMProvider {
    chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMResponse>;
    get name(): string;
}
export interface LLMChatOptions {
    temperature?: number;
    maxTokens?: number;
    stop?: string[];
}
export declare class AgentError extends Error {
    readonly code: string;
    readonly retryable: boolean;
    readonly context?: Record<string, unknown> | undefined;
    constructor(message: string, code: string, retryable?: boolean, context?: Record<string, unknown> | undefined);
}
export declare function getConfig(): AgentConfig;
//# sourceMappingURL=types.d.ts.map