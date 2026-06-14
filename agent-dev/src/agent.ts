import * as vscode from 'vscode';
import { ILLMProvider, AgentConfig, AgentPlan, PlanStep, AgentEvent, VerifyResult, LLMMessage, AgentError, getConfig } from './types';
import { VerifyPhase } from './verify';
import { RecoveryPhase } from './recover';
import { PlanPanel } from './panels/plan_panel';
import { ExecutionPanel } from './panels/execution_panel';
import { VerifyPanel } from './panels/verify_panel';

let stepCounter = 0;

function generateId(): string {
  stepCounter++;
  return `step-${stepCounter}-${Date.now()}`;
}

export class AgentController {
  private provider: ILLMProvider;
  private config: AgentConfig;
  private verifier: VerifyPhase;
  private recoverer: RecoveryPhase;
  private currentPlan: AgentPlan | null = null;
  private isRunning: boolean = false;
  private abortController: AbortController | null = null;
  private eventLog: AgentEvent[] = [];
  private onDidStateChange = new vscode.EventEmitter<AgentEvent>();
  private panels: {
    plan?: PlanPanel;
    execution?: ExecutionPanel;
    verify?: VerifyPanel;
  } = {};

  readonly onStateChanged = this.onDidStateChange.event;

  constructor(provider: ILLMProvider, config?: AgentConfig) {
    this.provider = provider;
    this.config = config ?? getConfig();
    this.verifier = new VerifyPhase(this.config);
    this.recoverer = new RecoveryPhase(provider, this.config);
  }

  initialize(model?: string): void {
    if (model) {
      this.config.model = model;
    }
    this.emit('plan', { message: `Agent initialized with provider: ${this.provider.name}` });
  }

  async run(task: string): Promise<AgentPlan> {
    if (this.isRunning) {
      throw new AgentError('Agent is already running a task', 'ALREADY_RUNNING', false);
    }

    this.isRunning = true;
    this.abortController = new AbortController();
    this.eventLog = [];

    try {
      this.emit('plan', { task, message: `Starting task: ${task}` });

      const plan = await this.plan(task);
      this.currentPlan = plan;

      if (this.abortController?.signal.aborted) {
        plan.status = 'failed';
        this.emit('error', { message: 'Task aborted during planning' });
        return plan;
      }

      this.emit('execute', { planId: plan.id, message: `Executing plan with ${plan.steps.length} steps` });

      const result = await this.execute(plan);

      this.emit('verify', { message: 'Running verification...' });
      const verifyResult = await this.verifier.run_verification(null, task);

      this.emit('verify', verifyResult);

      if (!verifyResult.passed) {
        plan.status = 'failed';
        this.emit('error', { message: `Verification failed: ${verifyResult.summary}` });
      } else {
        plan.status = 'completed';
        this.emit('complete', { planId: plan.id, message: `Task completed successfully: ${task}` });
      }

      return plan;
    } catch (error) {
      if (this.currentPlan) {
        this.currentPlan.status = 'failed';
      }
      this.emit('error', { message: (error as Error).message });
      throw error;
    } finally {
      this.isRunning = false;
      this.abortController = null;
    }
  }

  async plan(task: string): Promise<AgentPlan> {
    this.emit('plan', { message: `Planning task: ${task}` });

    const planId = `plan-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `You are an expert software development planning agent. Given a task, break it down into concrete, executable steps. Each step should be a clear action that can be independently verified. Return a JSON array of steps, where each step has "id" (number) and "description" (string). Example: [{"id": 1, "description": "Read current implementation of X"}]. Output ONLY the JSON array, no other text.`,
      },
      {
        role: 'user',
        content: `Task: ${task}\n\nBreak this task into concrete executable steps:`,
      },
    ];

    let response: string;
    try {
      const llmResponse = await this.provider.chat(messages, { temperature: 0.2 });
      response = llmResponse.content;
    } catch (error) {
      throw new AgentError(
        `Planning failed: ${(error as Error).message}`,
        'PLAN_ERROR',
        true
      );
    }

    const steps = this.parsePlanSteps(response);

    const plan: AgentPlan = {
      id: planId,
      task,
      steps,
      createdAt: Date.now(),
      status: 'ready',
    };

    this.panels.plan?.update(plan);
    this.emit('plan', { planId, steps: plan.steps, message: `Plan created with ${plan.steps.length} steps` });

    return plan;
  }

  async execute(plan: AgentPlan): Promise<AgentPlan> {
    plan.status = 'executing';

    for (const step of plan.steps) {
      if (this.abortController?.signal.aborted) {
        step.status = 'failed';
        step.error = 'Aborted by user';
        break;
      }

      step.status = 'running';
      this.panels.execution?.update(plan);
      this.emit('execute', { planId: plan.id, stepId: step.id, message: `Executing: ${step.description}` });

      let attempts = 0;
      let stepCompleted = false;

      while (!stepCompleted && attempts < this.config.maxRetries) {
        attempts++;

        try {
          const stepResult = await this.executeStep(step, plan);
          step.result = stepResult;
          step.status = 'completed';
          stepCompleted = true;

          this.panels.execution?.update(plan);
          this.emit('execute', { planId: plan.id, stepId: step.id, result: stepResult, message: `Completed: ${step.description}` });

          const verifyResult = await this.verifier.run_verification(null, step.description);
          this.panels.verify?.update(verifyResult);
          this.emit('verify', verifyResult);

          if (!verifyResult.passed && attempts < this.config.maxRetries) {
            const recovery = await this.recoverer.recover(
              new AgentError(verifyResult.summary, 'VERIFY_FAILED', true),
              { verifyResult, attempt: attempts }
            );

            if (recovery.type === 'modify' && recovery.modifiedCode) {
              this.emit('recover', { stepId: step.id, action: recovery, message: `Recovery: ${recovery.description}` });
              const activeEditor = vscode.window.activeTextEditor;
              if (activeEditor) {
                const fullRange = new vscode.Range(
                  activeEditor.document.lineAt(0).range.start,
                  activeEditor.document.lineAt(activeEditor.document.lineCount - 1).range.end
                );
                await activeEditor.edit(editBuilder => {
                  editBuilder.replace(fullRange, recovery.modifiedCode!);
                });
              }
            } else if (recovery.type === 'abort') {
              step.status = 'failed';
              step.error = recovery.description;
              break;
            }
          }
        } catch (error) {
          if (attempts >= this.config.maxRetries) {
            step.status = 'failed';
            step.error = (error as Error).message;
            this.emit('error', { stepId: step.id, error: (error as Error).message });
            break;
          }

          const recovery = await this.recoverer.recover(error as Error, {
            attempt: attempts,
          });

          this.emit('recover', { stepId: step.id, action: recovery, message: `Recovery attempt ${attempts}: ${recovery.description}` });

          if (recovery.type === 'abort') {
            step.status = 'failed';
            step.error = (error as Error).message;
            break;
          }

          if (recovery.type === 'skip') {
            step.status = 'completed';
            step.result = 'Skipped after recovery';
            stepCompleted = true;
            break;
          }

          this.emit('execute', { planId: plan.id, stepId: step.id, message: `Retry ${attempts}: ${step.description}` });
        }
      }
    }

    const allCompleted = plan.steps.every(s => s.status === 'completed');
    plan.status = allCompleted ? 'completed' : 'failed';

    return plan;
  }

  async verify(result: string): Promise<VerifyResult> {
    const verifyResult = await this.verifier.run_verification(null, result);
    this.panels.verify?.update(verifyResult);
    this.emit('verify', verifyResult);
    return verifyResult;
  }

  async recover(error: Error): Promise<void> {
    this.emit('recover', { error: error.message, message: `Attempting recovery: ${error.message}` });
    const recovery = await this.recoverer.recover(error, {
      attempt: this.eventLog.filter(e => e.type === 'recover').length,
    });
    this.emit('recover', { action: recovery, message: `Recovery action: ${recovery.description}` });
  }

  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.isRunning = false;
      this.emit('error', { message: 'Agent stopped by user' });
    }
  }

  registerPanels(plan: PlanPanel, execution: ExecutionPanel, verify: VerifyPanel): void {
    this.panels = { plan, execution, verify };
  }

  getPlan(): AgentPlan | null {
    return this.currentPlan;
  }

  getEventLog(): AgentEvent[] {
    return [...this.eventLog];
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  private async executeStep(step: PlanStep, plan: AgentPlan): Promise<string> {
    const completedSteps = plan.steps
      .filter(s => s.status === 'completed')
      .map(s => s.description)
      .join(', ') || 'none';

    const contextMessages: LLMMessage[] = [
      {
        role: 'system',
        content: `You are an expert software developer. Execute the given step precisely.

Current plan: ${plan.task}
Previous completed steps: ${completedSteps}

If the step requires writing code, write the complete code. If it requires analysis, provide the analysis. If it requires running a command, suggest the exact command. Output the result directly.`,
      },
      {
        role: 'user',
        content: `Execute this step: ${step.description}`,
      },
    ];

    const response = await this.provider.chat(contextMessages, { temperature: 0.1 });
    return response.content;
  }

  private parsePlanSteps(response: string): PlanStep[] {
    let jsonStr = response.trim();

    const codeBlockMatch = jsonStr.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    } else {
      const singleMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (singleMatch) {
        jsonStr = `[${singleMatch[0]}]`;
      }
    }

    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        return parsed.map((item: unknown, index: number) => {
          const obj = item as Record<string, unknown>;
          return {
            id: String(typeof obj.id === 'number' ? obj.id : index + 1),
            description: typeof obj.description === 'string'
              ? obj.description
              : String(obj.description || obj.step || `Step ${index + 1}`),
            status: 'pending' as const,
          };
        });
      }
    } catch {
      const lines = response.split('\n').filter(l => l.trim());
      return lines.map((line, i) => {
        const cleaned = line.replace(/^\d+[\.\)]\s*/, '').replace(/^[-*]\s*/, '').trim();
        return {
          id: String(i + 1),
          description: cleaned || `Step ${i + 1}`,
          status: 'pending' as const,
        };
      }).filter(s => s.description.length > 0);
    }

    return [{ id: '1', description: 'Execute task', status: 'pending' as const }];
  }

  private emit(type: AgentEvent['type'], data: unknown): void {
    const event: AgentEvent = {
      type,
      timestamp: Date.now(),
      data,
    };
    this.eventLog.push(event);
    this.onDidStateChange.fire(event);
  }
}
