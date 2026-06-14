import * as vscode from 'vscode';
import { AgentPlan } from '../types';
export declare class PlanPanel {
    private extensionUri;
    static currentPanel: PlanPanel | undefined;
    static readonly viewType = "agent-dev-plan";
    private readonly panel;
    private disposables;
    private currentPlan;
    static createOrShow(extensionUri: vscode.Uri): PlanPanel;
    private constructor();
    update(plan: AgentPlan): void;
    static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri): PlanPanel;
    private updateHtml;
    private getHtml;
    private statusIcon;
    private escapeHtml;
    dispose(): void;
}
//# sourceMappingURL=plan_panel.d.ts.map