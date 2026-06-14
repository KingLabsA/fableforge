import * as vscode from 'vscode';
import { VerifyResult } from '../types';
export declare class VerifyPanel {
    private extensionUri;
    static currentPanel: VerifyPanel | undefined;
    static readonly viewType = "agent-dev-verify";
    private readonly panel;
    private disposables;
    private currentResult;
    static createOrShow(extensionUri: vscode.Uri): VerifyPanel;
    private constructor();
    update(result: VerifyResult): void;
    static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri): VerifyPanel;
    private updateHtml;
    private getHtml;
    private escapeHtml;
    dispose(): void;
}
//# sourceMappingURL=verify_panel.d.ts.map