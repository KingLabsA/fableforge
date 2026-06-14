import * as vscode from 'vscode';
import { AgentPlan } from '../types';

export class PlanPanel {
  public static currentPanel: PlanPanel | undefined;
  public static readonly viewType = 'agent-dev-plan';
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private currentPlan: AgentPlan | null = null;

  public static createOrShow(extensionUri: vscode.Uri): PlanPanel {
    if (PlanPanel.currentPanel) {
      PlanPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside);
      return PlanPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      PlanPanel.viewType,
      'AgentDev - Plan',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    return new PlanPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, private extensionUri: vscode.Uri) {
    this.panel = panel;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (message: { command: string; stepId: string }) => {
        switch (message.command) {
          case 'executeStep':
            vscode.commands.executeCommand('agent-dev.executePlan');
            break;
        }
      },
      null,
      this.disposables
    );

    this.updateHtml();
  }

  public update(plan: AgentPlan): void {
    this.currentPlan = plan;
    this.panel.webview.postMessage({
      type: 'update',
      plan: {
        id: plan.id,
        task: plan.task,
        status: plan.status,
        steps: plan.steps.map(s => ({
          id: s.id,
          description: s.description,
          status: s.status,
          result: s.result,
          error: s.error,
        })),
      },
    });
    this.updateHtml();
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri): PlanPanel {
    return new PlanPanel(panel, extensionUri);
  }

  private updateHtml(): void {
    const plan = this.currentPlan;
    this.panel.webview.html = this.getHtml(plan);
  }

  private getHtml(plan: AgentPlan | null): string {
    const stepsHtml = plan
      ? plan.steps
          .map(
            (s) => `
          <div class="step step-${s.status}">
            <div class="step-header">
              <span class="step-status ${s.status}">${this.statusIcon(s.status)}</span>
              <span class="step-id">${s.id}</span>
              <span class="step-description">${this.escapeHtml(s.description)}</span>
            </div>
            ${s.result ? `<div class="step-result"><pre>${this.escapeHtml(s.result)}</pre></div>` : ''}
            ${s.error ? `<div class="step-error"><pre>${this.escapeHtml(s.error)}</pre></div>` : ''}
          </div>`
          )
          .join('')
      : '<div class="empty">No plan yet. Run or plan a task to begin.</div>';

    const statusClass = plan ? `plan-${plan.status}` : '';
    const taskText = plan ? this.escapeHtml(plan.task) : 'No active task';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AgentDev - Plan</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --accent: var(--vscode-button-background);
      --accent-fg: var(--vscode-button-foreground);
      --error: var(--vscode-errorForeground, #f44747);
      --border: var(--vscode-panel-border, #444);
      --success: #4ec9b0;
      --warning: #dcdcaa;
      --running: #569cd6;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-editor-font-family, -apple-system, sans-serif);
      font-size: var(--vscode-editor-font-size, 13px);
      background: var(--bg);
      color: var(--fg);
      padding: 16px;
      line-height: 1.5;
    }
    h1 { font-size: 1.4em; margin-bottom: 8px; }
    h2 { font-size: 1.1em; margin-bottom: 12px; color: var(--accent); }
    .task { font-size: 1.1em; padding: 8px 12px; margin-bottom: 16px; border-left: 3px solid var(--accent); }
    .step {
      padding: 8px 12px;
      margin-bottom: 8px;
      border-radius: 4px;
      border: 1px solid var(--border);
    }
    .step-header { display: flex; align-items: center; gap: 8px; }
    .step-status { font-weight: bold; }
    .step-status.pending { color: var(--fg); opacity: 0.6; }
    .step-status.running { color: var(--running); }
    .step-status.completed { color: var(--success); }
    .step-status.failed { color: var(--error); }
    .step-id { font-family: monospace; color: var(--fg); opacity: 0.5; }
    .step-description { flex: 1; }
    .step-result pre {
      margin-top: 8px;
      padding: 8px;
      background: rgba(0,0,0,0.2);
      border-radius: 3px;
      font-size: 0.9em;
      overflow-x: auto;
      max-height: 200px;
    }
    .step-error pre {
      margin-top: 8px;
      padding: 8px;
      background: rgba(244,71,71,0.1);
      border-radius: 3px;
      color: var(--error);
      font-size: 0.9em;
    }
    .empty { opacity: 0.5; font-style: italic; padding: 20px; text-align: center; }
    .plan-status {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 0.85em;
      font-weight: 600;
      margin-left: 8px;
    }
    .plan-ready { background: rgba(86,156,214,0.2); color: var(--running); }
    .plan-executing { background: rgba(86,156,214,0.3); color: var(--running); }
    .plan-completed { background: rgba(78,201,176,0.2); color: var(--success); }
    .plan-failed { background: rgba(244,71,71,0.2); color: var(--error); }
  </style>
</head>
<body>
  <h1>AgentDev Plan <span class="plan-status ${statusClass}">${plan?.status ?? 'idle'}</span></h1>
  <div class="task">${taskText}</div>
  <h2>Steps</h2>
  <div id="steps">${stepsHtml}</div>
  <script>
    const vscode = acquireVsCodeApi();
    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.type === 'update') {
        document.getElementById('steps').innerHTML = msg.plan.steps.map(s =>
          '<div class="step step-' + s.status + '">' +
            '<div class="step-header">' +
              '<span class="step-status ' + s.status + '">' + statusIcon(s.status) + '</span>' +
              '<span class="step-id">' + s.id + '</span>' +
              '<span class="step-description">' + escapeHtml(s.description) + '</span>' +
            '</div>' +
            (s.result ? '<div class="step-result"><pre>' + escapeHtml(s.result) + '</pre></div>' : '') +
            (s.error ? '<div class="step-error"><pre>' + escapeHtml(s.error) + '</pre></div>' : '') +
          '</div>'
        ).join('');
        document.querySelector('.task').textContent = msg.plan.task;
        const badge = document.querySelector('.plan-status');
        if (badge) { badge.className = 'plan-status plan-' + msg.plan.status; badge.textContent = msg.plan.status; }
      }
    });
    function statusIcon(s) { return s === 'completed' ? '\\u2713' : s === 'running' ? '\\u25B6' : s === 'failed' ? '\\u2717' : '\\u25CB'; }
    function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
  </script>
</body>
</html>`;
  }

  private statusIcon(status: string): string {
    switch (status) {
      case 'completed': return '\u2713';
      case 'running': return '\u25B6';
      case 'failed': return '\u2717';
      default: return '\u25CB';
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  public dispose(): void {
    PlanPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) { d.dispose(); }
    }
  }
}
