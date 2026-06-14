import * as vscode from 'vscode';
import { AgentPlan } from '../types';
export declare class ExecutionPanel {
    private extensionUri;
    static currentPanel: ExecutionPanel | undefined;
    static readonly viewType = "agent-dev-execution";
    private readonly panel;
    private disposables;
    private currentPlan;
    private logs;
    static createOrShow(extensionUri: vscode.Uri): ExecutionPanel;
    private constructor();
    update(plan: AgentPlan): void;
    addLog(message: string, level?: string): void;
    static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri): ExecutionPanel;
    private updateHtml;
    private getHtml;
    private statusIcon;
    private escapeHtml;
    dispose(): void;
}
//# sourceMappingURL=execution_panel.d.ts.map