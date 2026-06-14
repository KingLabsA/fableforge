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
exports.AgentController = void 0;
const vscode = __importStar(require("vscode"));
const types_1 = require("./types");
const verify_1 = require("./verify");
const recover_1 = require("./recover");
let stepCounter = 0;
function generateId() {
    stepCounter++;
    return `step-${stepCounter}-${Date.now()}`;
}
class AgentController {
    constructor(provider, config) {
        this.currentPlan = null;
        this.isRunning = false;
        this.abortController = null;
        this.eventLog = [];
        this.onDidStateChange = new vscode.EventEmitter();
        this.panels = {};
        this.onStateChanged = this.onDidStateChange.event;
        this.provider = provider;
        this.config = config ?? (0, types_1.getConfig)();
        this.verifier = new verify_1.VerifyPhase(this.config);
        this.recoverer = new recover_1.RecoveryPhase(provider, this.config);
    }
    initialize(model) {
        if (model) {
            this.config.model = model;
        }
        this.emit('plan', { message: `Agent initialized with provider: ${this.provider.name}` });
    }
    async run(task) {
        if (this.isRunning) {
            throw new types_1.AgentError('Agent is already running a task', 'ALREADY_RUNNING', false);
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
            }
            else {
                plan.status = 'completed';
                this.emit('complete', { planId: plan.id, message: `Task completed successfully: ${task}` });
            }
            return plan;
        }
        catch (error) {
            if (this.currentPlan) {
                this.currentPlan.status = 'failed';
            }
            this.emit('error', { message: error.message });
            throw error;
        }
        finally {
            this.isRunning = false;
            this.abortController = null;
        }
    }
    async plan(task) {
        this.emit('plan', { message: `Planning task: ${task}` });
        const planId = `plan-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const messages = [
            {
                role: 'system',
                content: `You are an expert software development planning agent. Given a task, break it down into concrete, executable steps. Each step should be a clear action that can be independently verified. Return a JSON array of steps, where each step has "id" (number) and "description" (string). Example: [{"id": 1, "description": "Read current implementation of X"}]. Output ONLY the JSON array, no other text.`,
            },
            {
                role: 'user',
                content: `Task: ${task}\n\nBreak this task into concrete executable steps:`,
            },
        ];
        let response;
        try {
            const llmResponse = await this.provider.chat(messages, { temperature: 0.2 });
            response = llmResponse.content;
        }
        catch (error) {
            throw new types_1.AgentError(`Planning failed: ${error.message}`, 'PLAN_ERROR', true);
        }
        const steps = this.parsePlanSteps(response);
        const plan = {
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
    async execute(plan) {
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
                        const recovery = await this.recoverer.recover(new types_1.AgentError(verifyResult.summary, 'VERIFY_FAILED', true), { verifyResult, attempt: attempts });
                        if (recovery.type === 'modify' && recovery.modifiedCode) {
                            this.emit('recover', { stepId: step.id, action: recovery, message: `Recovery: ${recovery.description}` });
                            const activeEditor = vscode.window.activeTextEditor;
                            if (activeEditor) {
                                const fullRange = new vscode.Range(activeEditor.document.lineAt(0).range.start, activeEditor.document.lineAt(activeEditor.document.lineCount - 1).range.end);
                                await activeEditor.edit(editBuilder => {
                                    editBuilder.replace(fullRange, recovery.modifiedCode);
                                });
                            }
                        }
                        else if (recovery.type === 'abort') {
                            step.status = 'failed';
                            step.error = recovery.description;
                            break;
                        }
                    }
                }
                catch (error) {
                    if (attempts >= this.config.maxRetries) {
                        step.status = 'failed';
                        step.error = error.message;
                        this.emit('error', { stepId: step.id, error: error.message });
                        break;
                    }
                    const recovery = await this.recoverer.recover(error, {
                        attempt: attempts,
                    });
                    this.emit('recover', { stepId: step.id, action: recovery, message: `Recovery attempt ${attempts}: ${recovery.description}` });
                    if (recovery.type === 'abort') {
                        step.status = 'failed';
                        step.error = error.message;
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
    async verify(result) {
        const verifyResult = await this.verifier.run_verification(null, result);
        this.panels.verify?.update(verifyResult);
        this.emit('verify', verifyResult);
        return verifyResult;
    }
    async recover(error) {
        this.emit('recover', { error: error.message, message: `Attempting recovery: ${error.message}` });
        const recovery = await this.recoverer.recover(error, {
            attempt: this.eventLog.filter(e => e.type === 'recover').length,
        });
        this.emit('recover', { action: recovery, message: `Recovery action: ${recovery.description}` });
    }
    stop() {
        if (this.abortController) {
            this.abortController.abort();
            this.isRunning = false;
            this.emit('error', { message: 'Agent stopped by user' });
        }
    }
    registerPanels(plan, execution, verify) {
        this.panels = { plan, execution, verify };
    }
    getPlan() {
        return this.currentPlan;
    }
    getEventLog() {
        return [...this.eventLog];
    }
    getIsRunning() {
        return this.isRunning;
    }
    async executeStep(step, plan) {
        const completedSteps = plan.steps
            .filter(s => s.status === 'completed')
            .map(s => s.description)
            .join(', ') || 'none';
        const contextMessages = [
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
    parsePlanSteps(response) {
        let jsonStr = response.trim();
        const codeBlockMatch = jsonStr.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
        if (codeBlockMatch) {
            jsonStr = codeBlockMatch[1].trim();
        }
        const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            jsonStr = jsonMatch[0];
        }
        else {
            const singleMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (singleMatch) {
                jsonStr = `[${singleMatch[0]}]`;
            }
        }
        try {
            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed)) {
                return parsed.map((item, index) => {
                    const obj = item;
                    return {
                        id: String(typeof obj.id === 'number' ? obj.id : index + 1),
                        description: typeof obj.description === 'string'
                            ? obj.description
                            : String(obj.description || obj.step || `Step ${index + 1}`),
                        status: 'pending',
                    };
                });
            }
        }
        catch {
            const lines = response.split('\n').filter(l => l.trim());
            return lines.map((line, i) => {
                const cleaned = line.replace(/^\d+[\.\)]\s*/, '').replace(/^[-*]\s*/, '').trim();
                return {
                    id: String(i + 1),
                    description: cleaned || `Step ${i + 1}`,
                    status: 'pending',
                };
            }).filter(s => s.description.length > 0);
        }
        return [{ id: '1', description: 'Execute task', status: 'pending' }];
    }
    emit(type, data) {
        const event = {
            type,
            timestamp: Date.now(),
            data,
        };
        this.eventLog.push(event);
        this.onDidStateChange.fire(event);
    }
}
exports.AgentController = AgentController;
//# sourceMappingURL=agent.js.map