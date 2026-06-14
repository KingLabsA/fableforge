import * as vscode from 'vscode';
import { ILLMProvider, AgentConfig, AgentPlan, AgentEvent, VerifyResult } from './types';
import { PlanPanel } from './panels/plan_panel';
import { ExecutionPanel } from './panels/execution_panel';
import { VerifyPanel } from './panels/verify_panel';
export declare class AgentController {
    private provider;
    private config;
    private verifier;
    private recoverer;
    private currentPlan;
    private isRunning;
    private abortController;
    private eventLog;
    private onDidStateChange;
    private panels;
    readonly onStateChanged: vscode.Event<AgentEvent>;
    constructor(provider: ILLMProvider, config?: AgentConfig);
    initialize(model?: string): void;
    run(task: string): Promise<AgentPlan>;
    plan(task: string): Promise<AgentPlan>;
    execute(plan: AgentPlan): Promise<AgentPlan>;
    verify(result: string): Promise<VerifyResult>;
    recover(error: Error): Promise<void>;
    stop(): void;
    registerPanels(plan: PlanPanel, execution: ExecutionPanel, verify: VerifyPanel): void;
    getPlan(): AgentPlan | null;
    getEventLog(): AgentEvent[];
    getIsRunning(): boolean;
    private executeStep;
    private parsePlanSteps;
    private emit;
}
//# sourceMappingURL=agent.d.ts.map