import * as vscode from 'vscode';
import { AgentPlan } from '../types';

export class ExecutionPanel {
  public static currentPanel: ExecutionPanel | undefined;
  public static readonly viewType = 'agent-dev-execution';
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private currentPlan: AgentPlan | null = null;
  private logs: Array<{ timestamp: number; message: string; level: string }> = [];

  public static createOrShow(extensionUri: vscode.Uri): ExecutionPanel {
    if (ExecutionPanel.currentPanel) {
      ExecutionPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside);
      return ExecutionPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      ExecutionPanel.viewType,
      'AgentDev - Execution',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    return new ExecutionPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, private extensionUri: vscode.Uri) {
    this.panel = panel;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      (message: { command: string }) => {
        switch (message.command) {
          case 'stop':
            vscode.commands.executeCommand('agent-dev.stopAgent');
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
    this.addLog(`Step updated: ${plan.steps.filter(s => s.status === 'running').map(s => s.description).join(', ') || 'idle'}`, 'info');
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
      logs: this.logs,
    });
  }

  public addLog(message: string, level: string = 'info'): void {
    this.logs.push({ timestamp: Date.now(), message, level });
    if (this.logs.length > 500) {
      this.logs = this.logs.slice(-250);
    }
    this.panel.webview.postMessage({
      type: 'log',
      log: { timestamp: Date.now(), message, level },
    });
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri): ExecutionPanel {
    return new ExecutionPanel(panel, extensionUri);
  }

  private updateHtml(): void {
    const plan = this.currentPlan;
    this.panel.webview.html = this.getHtml(plan);
  }

  private getHtml(plan: AgentPlan | null): string {
    const progressSteps = plan
      ? plan.steps
          .map(
            (s) => `
          <div class="progress-step ${s.status}">
            <span class="icon">${this.statusIcon(s.status)}</span>
            <span class="desc">${this.escapeHtml(s.description)}</span>
            <span class="status-badge ${s.status}">${s.status}</span>
          </div>`
          )
          .join('')
      : '';

    const completed = plan?.steps.filter(s => s.status === 'completed').length ?? 0;
    const total = plan?.steps.length ?? 0;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    const logEntries = this.logs
      .slice(-50)
      .map(
        (l) =>
          `<div class="log-entry ${l.level}"><span class="time">${new Date(l.timestamp).toLocaleTimeString()}</span> ${this.escapeHtml(l.message)}</div>`
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AgentDev - Execution</title>
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
    body { font-family: var(--vscode-editor-font-family, -apple-system, sans-serif); font-size: 13px; background: var(--bg); color: var(--fg); padding: 16px; }
    h1 { font-size: 1.3em; margin-bottom: 12px; }
    .progress-bar { background: var(--border); border-radius: 8px; height: 24px; margin-bottom: 16px; overflow: hidden; position: relative; }
    .progress-fill { background: var(--success); height: 100%; transition: width 0.3s ease; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--bg); font-weight: 600; font-size: 0.85em; }
    .progress-step { display: flex; align-items: center; gap: 8px; padding: 6px 12px; margin-bottom: 4px; border-radius: 3px; }
    .progress-step.pending { opacity: 0.5; }
    .progress-step.running { background: rgba(86,156,214,0.15); }
    .progress-step.completed { background: rgba(78,201,176,0.1); }
    .progress-step.failed { background: rgba(244,71,71,0.1); }
    .icon { font-weight: bold; width: 20px; text-align: center; }
    .desc { flex: 1; }
    .status-badge { font-size: 0.75em; padding: 1px 6px; border-radius: 3px; text-transform: uppercase; }
    .status-badge.pending { background: rgba(255,255,255,0.1); }
    .status-badge.running { background: rgba(86,156,214,0.3); color: var(--running); }
    .status-badge.completed { background: rgba(78,201,176,0.3); color: var(--success); }
    .status-badge.failed { background: rgba(244,71,71,0.3); color: var(--error); }
    .log-container { margin-top: 16px; border-top: 1px solid var(--border); padding-top: 12px; }
    .log-entry { font-family: monospace; font-size: 0.85em; padding: 2px 4px; border-bottom: 1px solid rgba(255,255,255,0.03); }
    .log-entry.error { color: var(--error); }
    .log-entry.warning { color: var(--warning); }
    .log-entry .time { opacity: 0.5; margin-right: 8px; }
    .stop-btn {
      background: var(--error); color: #fff; border: none; padding: 6px 16px;
      border-radius: 4px; cursor: pointer; font-size: 0.9em; margin-top: 12px;
    }
    .stop-btn:hover { opacity: 0.8; }
  </style>
</head>
<body>
  <h1>Execution Progress <span id="percent">${percent}%</span></h1>
  <div class="progress-bar"><div class="progress-fill" style="width: ${percent}%">${percent}%</div></div>
  <div id="steps">${progressSteps}</div>
  <button class="stop-btn" onclick="stop()">Stop Agent</button>
  <div class="log-container">
    <h2>Log</h2>
    <div id="logs">${logEntries}</div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    function stop() { vscode.postMessage({ command: 'stop' }); }
    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.type === 'update' && msg.plan) {
        document.getElementById('steps').innerHTML = msg.plan.steps.map(s =>
          '<div class="progress-step ' + s.status + '">' +
            '<span class="icon">' + iconFor(s.status) + '</span>' +
            '<span class="desc">' + escapeHtml(s.description) + '</span>' +
            '<span class="status-badge ' + s.status + '">' + s.status + '</span>' +
          '</div>'
        ).join('');
        const done = msg.plan.steps.filter(s => s.status === 'completed').length;
        const total = msg.plan.steps.length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        document.getElementById('percent').textContent = pct + '%';
        document.querySelector('.progress-fill').style.width = pct + '%';
        document.querySelector('.progress-fill').textContent = pct + '%';
      }
      if (msg.type === 'log' && msg.log) {
        const el = document.createElement('div');
        el.className = 'log-entry ' + (msg.log.level || 'info');
        el.innerHTML = '<span class="time">' + new Date(msg.log.timestamp).toLocaleTimeString() + '</span> ' + escapeHtml(msg.log.message);
        document.getElementById('logs').appendChild(el);
        if (document.getElementById('logs').childElementCount > 200) {
          document.getElementById('logs').removeChild(document.getElementById('logs').firstChild);
        }
      }
    });
    function iconFor(s) { return s === 'completed' ? '\\u2713' : s === 'running' ? '\\u25B6' : s === 'failed' ? '\\u2717' : '\\u25CB'; }
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
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  public dispose(): void {
    ExecutionPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) { d.dispose(); }
    }
  }
}
