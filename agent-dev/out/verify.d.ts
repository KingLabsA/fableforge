import { VerifyResult, SyntaxError, TestResult, LintResult, AgentConfig } from './types';
export declare class VerifyPhase {
    private config;
    constructor(config?: AgentConfig);
    run_verification(code: string | null, expectedBehavior: string, filePath?: string): Promise<VerifyResult>;
    check_syntax(file: string): Promise<SyntaxError[]>;
    private check_syntax_directory;
    check_tests(testCommand: string): Promise<TestResult>;
    check_lint(fileOrCommand: string): Promise<LintResult>;
    private parseTypeScriptErrors;
    private exec_command;
}
//# sourceMappingURL=verify.d.ts.map