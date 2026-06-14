"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecoveryPhase = void 0;
const types_1 = require("./types");
class RecoveryPhase {
    constructor(provider, config) {
        this.provider = provider;
        this.config = config ?? (0, types_1.getConfig)();
    }
    async recover(error, context) {
        const errorType = this.classify_error(error);
        const attempt = context?.attempt ?? 0;
        if (attempt >= this.config.maxRetries) {
            return {
                type: 'abort',
                description: `Maximum retries (${this.config.maxRetries}) reached. Giving up.`,
            };
        }
        if (error instanceof types_1.AgentError && !error.retryable) {
            return {
                type: 'abort',
                description: `Non-retryable error: ${error.message}`,
            };
        }
        const strategy = this.strategy_for_error(errorType);
        switch (strategy) {
            case 'llm_fix':
                return this.llm_fix(error, errorType, context);
            case 'retry':
                return {
                    type: 'retry',
                    description: `Retrying after ${errorType} (attempt ${attempt + 1}/${this.config.maxRetries})`,
                };
            case 'skip':
                return {
                    type: 'skip',
                    description: `Skipping after non-critical error: ${errorType}`,
                };
            default:
                return {
                    type: 'abort',
                    description: `Cannot recover from error type: ${errorType}`,
                };
        }
    }
    strategy_for_error(errorType) {
        switch (errorType) {
            case 'syntax_error':
                return 'llm_fix';
            case 'test_failure':
                return 'llm_fix';
            case 'lint_error':
                return 'llm_fix';
            case 'api_error':
                return 'retry';
            case 'timeout':
                return 'retry';
            case 'connection_error':
                return 'retry';
            case 'unknown_error':
                return 'retry';
            default:
                return 'abort';
        }
    }
    classify_error(error) {
        if (error instanceof types_1.AgentError) {
            switch (error.code) {
                case 'NO_API_KEY':
                case 'EMPTY_RESPONSE':
                    return 'api_error';
                case 'API_ERROR':
                    return 'api_error';
                case 'NETWORK_ERROR':
                case 'LOCAL_CONNECTION_ERROR':
                    return 'connection_error';
                case 'LOCAL_TIMEOUT':
                case 'LOCAL_MODEL_ERROR':
                    return 'timeout';
                default:
                    return 'unknown_error';
            }
        }
        const msg = error.message.toLowerCase();
        if (msg.includes('syntax') || msg.includes('parse error') || msg.includes('unexpected token')) {
            return 'syntax_error';
        }
        if (msg.includes('test') || msg.includes('assert') || msg.includes('fail') || msg.includes('expect')) {
            return 'test_failure';
        }
        if (msg.includes('lint') || msg.includes('eslint') || msg.includes('style')) {
            return 'lint_error';
        }
        if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('etimedout')) {
            return 'timeout';
        }
        if (msg.includes('econnrefused') || msg.includes('econnreset') || msg.includes('network') || msg.includes('connect')) {
            return 'connection_error';
        }
        if (msg.includes('api') || msg.includes('rate limit') || msg.includes('429') || msg.includes('500')) {
            return 'api_error';
        }
        return 'unknown_error';
    }
    async llm_fix(error, errorType, context) {
        const errorDescription = this.describe_error(error, errorType);
        const verifyInfo = context?.verifyResult
            ? `Verification results: ${context.verifyResult.summary}`
            : '';
        let codeSection = '';
        if (context?.code) {
            codeSection = `\n\nCurrent code:\n\`\`\`\n${context.code}\n\`\`\``;
        }
        const messages = [
            {
                role: 'system',
                content: `You are a code recovery agent. Your job is to fix code errors. Analyze the error, determine the root cause, and provide corrected code. Output ONLY the corrected code with no explanation outside the code.`,
            },
            {
                role: 'user',
                content: `Error: ${errorDescription}\n${verifyInfo}${codeSection}\n\nProvide the corrected code:`,
            },
        ];
        try {
            const response = await this.provider.chat(messages, { temperature: 0.1 });
            const code = this.extract_code(response.content);
            return {
                type: 'modify',
                description: `LLM-recovered fix for ${errorType}`,
                modifiedCode: code,
            };
        }
        catch (llmError) {
            return {
                type: 'retry',
                description: `LLM recovery failed (${llmError.message}), falling back to retry`,
            };
        }
    }
    describe_error(error, errorType) {
        let desc = `[${errorType}] ${error.message}`;
        if (error instanceof types_1.AgentError && error.context) {
            desc += `\nContext: ${JSON.stringify(error.context)}`;
        }
        return desc;
    }
    extract_code(response) {
        const codeBlockMatch = response.match(/```(?:\w+)?\n([\s\S]*?)```/);
        if (codeBlockMatch) {
            return codeBlockMatch[1].trim();
        }
        if (response.includes('\n') && (response.includes('function ') || response.includes('const ') || response.includes('class '))) {
            return response.trim();
        }
        return response.trim();
    }
}
exports.RecoveryPhase = RecoveryPhase;
//# sourceMappingURL=recover.js.map