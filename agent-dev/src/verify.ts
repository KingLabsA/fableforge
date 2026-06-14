import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { VerifyResult, SyntaxError, TestResult, LintResult, AgentConfig, getConfig } from './types';

export class VerifyPhase {
  private config: AgentConfig;

  constructor(config?: AgentConfig) {
    this.config = config ?? getConfig();
  }

  async run_verification(
    code: string | null,
    expectedBehavior: string,
    filePath?: string
  ): Promise<VerifyResult> {
    const syntaxErrors: SyntaxError[] = [];
    let testResults: TestResult | null = null;
    let lintResults: LintResult | null = null;

    if (code && filePath) {
      const syntaxCheck = await this.check_syntax(filePath);
      syntaxErrors.push(...syntaxCheck);
    } else if (code) {
      const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (workspacePath) {
        const syntaxCheck = await this.check_syntax(workspacePath);
        syntaxErrors.push(...syntaxCheck);
      }
    }

    const hasSyntaxErrors = syntaxErrors.some(e => e.severity === 'error');

    if (!hasSyntaxErrors && this.config.verifyTests) {
      testResults = await this.check_tests(this.config.testCommand);
    }

    if (!hasSyntaxErrors && this.config.verifyLint) {
      lintResults = await this.check_lint(this.config.lintCommand);
    }

    const allPassed =
      !hasSyntaxErrors &&
      (testResults?.passed ?? true) &&
      (lintResults?.passed ?? true);

    const parts: string[] = [];
    if (syntaxErrors.length > 0) {
      const errCount = syntaxErrors.filter(e => e.severity === 'error').length;
      const warnCount = syntaxErrors.filter(e => e.severity === 'warning').length;
      parts.push(`${errCount} error(s), ${warnCount} warning(s) found`);
    } else {
      parts.push('Syntax: OK');
    }

    if (testResults) {
      parts.push(testResults.passed
        ? `Tests: ${testResults.passedTests}/${testResults.totalTests} passed`
        : `Tests: ${testResults.failedTests} of ${testResults.totalTests} failed`);
    }

    if (lintResults) {
      parts.push(lintResults.passed
        ? 'Lint: Clean'
        : `Lint: ${lintResults.errorCount} error(s), ${lintResults.warningCount} warning(s)`);
    }

    return {
      passed: allPassed,
      syntaxErrors,
      testResults,
      lintResults,
      summary: parts.join(' | '),
    };
  }

  async check_syntax(file: string): Promise<SyntaxError[]> {
    const errors: SyntaxError[] = [];
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    try {
      const stat = fs.statSync(file);
      if (stat.isDirectory()) {
        return await this.check_syntax_directory(file);
      }
    } catch {
      // File may not exist yet; skip
      return [];
    }

    const ext = path.extname(file).toLowerCase();
    if (!['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs'].includes(ext)) {
      return [];
    }

    const tscPath = path.join(workspacePath || '', 'node_modules', '.bin', 'tsc');
    if (ext === '.ts' || ext === '.tsx') {
      try {
        const result = await this.exec_command(`${tscPath} --noEmit "${file}"`, workspacePath);
        if (result.exitCode !== 0) {
          const parsed = this.parseTypeScriptErrors(result.stderr || result.stdout);
          errors.push(...parsed);
        }
      } catch (err) {
        errors.push({
          file,
          line: 0,
          column: 0,
          message: `Syntax check failed: ${(err as Error).message}`,
          severity: 'warning',
        });
      }
    } else if (ext === '.py') {
      try {
        const result = await this.exec_command(`python3 -m py_compile "${file}"`, workspacePath);
        if (result.exitCode !== 0) {
          errors.push({
            file,
            line: 0,
            column: 0,
            message: result.stderr || 'Python syntax error',
            severity: 'error',
          });
        }
      } catch {
        // Python may not be available
      }
    } else if (ext === '.go') {
      try {
        const result = await this.exec_command(`go vet "${file}"`, workspacePath);
        if (result.exitCode !== 0) {
          errors.push({
            file,
            line: 0,
            column: 0,
            message: result.stderr || 'Go syntax error',
            severity: 'error',
          });
        }
      } catch {
        // Go may not be available
      }
    }

    return errors;
  }

  private async check_syntax_directory(dirPath: string): Promise<SyntaxError[]> {
    const errors: SyntaxError[] = [];
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const tscPath = path.join(workspacePath || '', 'node_modules', '.bin', 'tsc');

    try {
      const result = await this.exec_command(`${tscPath} --noEmit`, workspacePath);
      if (result.exitCode !== 0) {
        errors.push(...this.parseTypeScriptErrors(result.stderr || result.stdout));
      }
    } catch (err) {
      errors.push({
        file: dirPath,
        line: 0,
        column: 0,
        message: `Directory syntax check failed: ${(err as Error).message}`,
        severity: 'warning',
      });
    }

    return errors;
  }

  async check_tests(testCommand: string): Promise<TestResult> {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    try {
      const result = await this.exec_command(testCommand, workspacePath, 120000);

      const output = result.stdout + '\n' + result.stderr;
      const passed = result.exitCode === 0;

      const totalMatch = output.match(/(\d+)\s+(?:test|tests|spec|specs)\s+(?:passed|pass|PASSED)/i)
        ?? output.match(/(\d+)\s+passing/i)
        ?? output.match(/Tests:\s+(\d+)\s+passed/i);
      const failMatch = output.match(/(\d+)\s+(?:fail|failed|failing)/i);

      const totalTests = totalMatch ? parseInt(totalMatch[1], 10) : (passed ? 1 : 0);
      const failedTests = failMatch ? parseInt(failMatch[1], 10) : (passed ? 0 : totalTests);
      const passedTests = totalTests - failedTests;

      return {
        passed,
        totalTests,
        passedTests,
        failedTests,
        output,
        duration: 0,
      };
    } catch (err) {
      return {
        passed: false,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        output: (err as Error).message,
        duration: 0,
      };
    }
  }

  async check_lint(fileOrCommand: string): Promise<LintResult> {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    try {
      const result = await this.exec_command(fileOrCommand, workspacePath, 60000);
      const output = result.stdout + '\n' + result.stderr;

      const errorMatch = output.match(/(\d+)\s+error/i);
      const warningMatch = output.match(/(\d+)\s+warning/i);

      const errorCount = errorMatch ? parseInt(errorMatch[1], 10) : (result.exitCode !== 0 ? 1 : 0);
      const warningCount = warningMatch ? parseInt(warningMatch[1], 10) : 0;

      return {
        passed: result.exitCode === 0 && errorCount === 0,
        errorCount,
        warningCount,
        output,
      };
    } catch (err) {
      return {
        passed: false,
        errorCount: 1,
        warningCount: 0,
        output: (err as Error).message,
      };
    }
  }

  private parseTypeScriptErrors(output: string): SyntaxError[] {
    const errors: SyntaxError[] = [];
    const regex = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/gm;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(output)) !== null) {
      errors.push({
        file: match[1],
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
        message: `[${match[4]}] ${match[5]}`,
        severity: 'error',
      });
    }

    const warnRegex = /^(.+?)\((\d+),(\d+)\):\s+warning\s+(.+)$/gm;
    while ((match = warnRegex.exec(output)) !== null) {
      errors.push({
        file: match[1],
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
        message: match[4],
        severity: 'warning',
      });
    }

    return errors;
  }

  private exec_command(
    command: string,
    cwd?: string,
    timeout: number = 30000
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const options: { cwd?: string; timeout: number; maxBuffer: number; shell: string } = {
        cwd: cwd || undefined,
        timeout,
        maxBuffer: 1024 * 1024 * 10,
        shell: '/bin/bash',
      };

      exec(command, options, (error, stdout, stderr) => {
        resolve({
          exitCode: error ? (error as NodeJS.ErrnoException & { code?: number }).code ?? 1 : 0,
          stdout: stdout || '',
          stderr: stderr || '',
        });
      });
    });
  }
}
