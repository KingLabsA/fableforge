import { AgentError, RecoveryAction, VerifyResult, AgentConfig } from './types';
import { ILLMProvider } from './types';
export type ErrorType = 'syntax_error' | 'test_failure' | 'lint_error' | 'api_error' | 'timeout' | 'connection_error' | 'unknown_error';
export declare class RecoveryPhase {
    private config;
    private provider;
    constructor(provider: ILLMProvider, config?: AgentConfig);
    recover(error: Error | AgentError, context?: {
        code?: string;
        filePath?: string;
        verifyResult?: VerifyResult;
        attempt: number;
    }): Promise<RecoveryAction>;
    strategy_for_error(errorType: ErrorType): 'llm_fix' | 'retry' | 'skip' | 'abort';
    classify_error(error: Error | AgentError): ErrorType;
    private llm_fix;
    private describe_error;
    private extract_code;
}
//# sourceMappingURL=recover.d.ts.map