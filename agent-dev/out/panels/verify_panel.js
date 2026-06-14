"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifyPanel = void 0;
const vscode = __importStar(require("vscode"));
class VerifyPanel {
    static createOrShow(extensionUri) {
        if (VerifyPanel.currentPanel) {
            VerifyPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside);
            return VerifyPanel.currentPanel;
        }
        const panel = vscode.window.createWebviewPanel(VerifyPanel.viewType, 'AgentDev - Verification', vscode.ViewColumn.Beside, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [extensionUri],
        });
        return new VerifyPanel(panel, extensionUri);
    }
    constructor(panel, extensionUri) {
        this.extensionUri = extensionUri;
        this.disposables = [];
        this.currentResult = null;
        this.panel = panel;
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.updateHtml();
    }
    update(result) {
        this.currentResult = result;
        this.panel.webview.postMessage({
            type: 'update',
            result: {
                passed: result.passed,
                summary: result.summary,
                syntaxErrors: result.syntaxErrors.map(e => ({
                    file: e.file,
                    line: e.line,
                    column: e.column,
                    message: e.message,
                    severity: e.severity,
                })),
                testResults: result.testResults ? {
                    passed: result.testResults.passed,
                    totalTests: result.testResults.totalTests,
                    passedTests: result.testResults.passedTests,
                    failedTests: result.testResults.failedTests,
                    output: result.testResults.output,
                } : null,
                lintResults: result.lintResults ? {
                    passed: result.lintResults.passed,
                    errorCount: result.lintResults.errorCount,
                    warningCount: result.lintResults.warningCount,
                    output: result.lintResults.output,
                } : null,
            },
        });
        this.updateHtml();
    }
    static revive(panel, extensionUri) {
        return new VerifyPanel(panel, extensionUri);
    }
    updateHtml() {
        const result = this.currentResult;
        this.panel.webview.html = this.getHtml(result);
    }
    getHtml(result) {
        const statusIcon = result ? (result.passed ? '\u2713 PASSED' : '\u2717 FAILED') : 'No verification yet';
        const statusClass = result ? (result.passed ? 'passed' : 'failed') : 'pending';
        const syntaxSection = result && result.syntaxErrors.length > 0
            ? `<div class="section">
           <h3>Syntax Errors (${result.syntaxErrors.filter(e => e.severity === 'error').length} errors, ${result.syntaxErrors.filter(e => e.severity === 'warning').length} warnings)</h3>
           <div class="error-list">
             ${result.syntaxErrors.map(e => `
               <div class="error-item ${e.severity}">
                 <span class="file">${this.escapeHtml(e.file)}</span>
                 <span class="loc">${e.line}:${e.column}</span>
                 <span class="msg">${this.escapeHtml(e.message)}</span>
               </div>
             `).join('')}
           </div>
         </div>`
            : result ? '<div class="section"><h3>Syntax: No errors</h3></div>' : '';
        const testSection = result?.testResults
            ? `<div class="section">
           <h3>Tests: ${result.testResults.passed ? '\u2713' : '\u2717'} ${result.testResults.passedTests}/${result.testResults.totalTests} passed</h3>
           ${result.testResults.failedTests > 0 ? `<div class="failure-count">${result.testResults.failedTests} failed</div>` : ''}
           <details><summary>Output</summary><pre>${this.escapeHtml(result.testResults.output)}</pre></details>
         </div>`
            : '';
        const lintSection = result?.lintResults
            ? `<div class="section">
           <h3>Lint: ${result.lintResults.passed ? '\u2713 Clean' : '\u2717 Issues found'} (${result.lintResults.errorCount} errors, ${result.lintResults.warningCount} warnings)</h3>
           <details><summary>Output</summary><pre>${this.escapeHtml(result.lintResults.output)}</pre></details>
         </div>`
            : '';
        const summaryText = result ? this.escapeHtml(result.summary) : 'Run a task to see verification results.';
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AgentDev - Verification</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --accent: var(--vscode-button-background);
      --error: var(--vscode-errorForeground, #f44747);
      --border: var(--vscode-panel-border, #444);
      --success: #4ec9b0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--vscode-editor-font-family, -apple-system, sans-serif); font-size: 13px; background: var(--bg); color: var(--fg); padding: 16px; }
    h1 { font-size: 1.3em; margin-bottom: 12px; }
    h3 { font-size: 1em; margin-bottom: 8px; color: var(--accent); }
    .status { font-size: 1.4em; font-weight: bold; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px; text-align: center; }
    .status.passed { background: rgba(78,201,176,0.15); color: var(--success); }
    .status.failed { background: rgba(244,71,71,0.15); color: var(--error); }
    .status.pending { background: rgba(255,255,255,0.05); opacity: 0.5; }
    .section { margin-bottom: 16px; padding: 12px; border: 1px solid var(--border); border-radius: 4px; }
    .summary { padding: 12px; background: rgba(255,255,255,0.03); border-radius: 4px; margin-bottom: 16px; }
    .error-item { display: flex; gap: 12px; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.03); font-family: monospace; font-size: 0.85em; }
    .error-item.error .msg { color: var(--error); }
    .error-item.warning .msg { color: #dcdcaa; }
    .file { color: #569cd6; min-width: 200px; }
    .loc { color: #888; min-width: 60px; }
    .failure-count { color: var(--error); font-weight: bold; margin-bottom: 8px; }
    details { margin-top: 8px; }
    details pre { background: rgba(0,0,0,0.2); padding: 8px; border-radius: 3px; overflow-x: auto; font-size: 0.85em; max-height: 300px; overflow-y: auto; }
    summary { cursor: pointer; color: var(--accent); }
  </style>
</head>
<body>
  <h1>Verification Results</h1>
  <div class="status ${statusClass}">${statusIcon}</div>
  <div class="summary">${summaryText}</div>
  ${syntaxSection}
  ${testSection}
  ${lintSection}
  <script>
    const vscode = acquireVsCodeApi();
    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.type === 'update' && msg.result) {
        location.reload();
      }
    });
  </script>
</body>
</html>`;
    }
    escapeHtml(text) {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    dispose() {
        VerifyPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const d = this.disposables.pop();
            if (d) {
                d.dispose();
            }
        }
    }
}
exports.VerifyPanel = VerifyPanel;
VerifyPanel.viewType = 'agent-dev-verify';
//# sourceMappingURL=verify_panel.js.map