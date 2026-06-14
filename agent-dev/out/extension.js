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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const agent_1 = require("./agent");
const api_provider_1 = require("./providers/api_provider");
const local_provider_1 = require("./providers/local_provider");
const plan_panel_1 = require("./panels/plan_panel");
const execution_panel_1 = require("./panels/execution_panel");
const verify_panel_1 = require("./panels/verify_panel");
const types_1 = require("./types");
let agentController = null;
let outputChannel;
let tasksProvider;
let historyProvider;
function activate(context) {
    outputChannel = vscode.window.createOutputChannel('AgentDev');
    outputChannel.appendLine('AgentDev extension activated');
    const config = (0, types_1.getConfig)();
    agentController = createAgent(config);
    outputChannel.appendLine(`Agent initialized with provider: ${config.provider}/${config.model}`);
    tasksProvider = new AgentTasksProvider();
    historyProvider = new AgentHistoryProvider();
    registerCommands(context);
    registerTreeViews(context);
    registerEventListeners(context);
    outputChannel.show();
}
function deactivate() {
    if (agentController) {
        agentController.stop();
        agentController = null;
    }
    if (outputChannel) {
        outputChannel.dispose();
    }
}
function createAgent(config) {
    let provider;
    switch (config.provider) {
        case 'openai':
            provider = new api_provider_1.APIProvider('openai', config.apiKey, config.model);
            break;
        case 'anthropic':
            provider = new api_provider_1.APIProvider('anthropic', config.apiKey, config.model);
            break;
        case 'local':
            provider = new local_provider_1.LocalProvider(config.localEndpoint, config.model);
            break;
        default:
            provider = new api_provider_1.APIProvider('openai', config.apiKey, config.model);
    }
    const agent = new agent_1.AgentController(provider, config);
    agent.initialize(config.model);
    return agent;
}
function registerCommands(context) {
    const runTaskCmd = vscode.commands.registerCommand('agent-dev.runTask', async () => {
        const task = await vscode.window.showInputBox({
            prompt: 'Enter the development task for the agent',
            placeHolder: 'e.g., Refactor the authentication module to use JWT',
            title: 'AgentDev - Run Task',
        });
        if (!task || task.trim().length === 0) {
            return;
        }
        if (!agentController) {
            vscode.window.showErrorMessage('AgentDev is not initialized');
            return;
        }
        if (agentController.getIsRunning()) {
            vscode.window.showWarningMessage('AgentDev is already running a task');
            return;
        }
        outputChannel.appendLine(`\n=== Running task: ${task} ===`);
        const planPanel = plan_panel_1.PlanPanel.createOrShow(context.extensionUri);
        const executionPanel = execution_panel_1.ExecutionPanel.createOrShow(context.extensionUri);
        const verifyPanelObj = verify_panel_1.VerifyPanel.createOrShow(context.extensionUri);
        const planExecutionPanel = execution_panel_1.ExecutionPanel.createOrShow(context.extensionUri);
        const planVerifyPanel = verify_panel_1.VerifyPanel.createOrShow(context.extensionUri);
        agentController.registerPanels(planPanel, planExecutionPanel, planVerifyPanel);
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'AgentDev',
            cancellable: true,
        }, async (progress, token) => {
            token.onCancellationRequested(() => {
                agentController.stop();
            });
            progress.report({ message: `Running: ${task.substring(0, 50)}...` });
            try {
                const plan = await agentController.run(task);
                if (plan.status === 'completed') {
                    const completedCount = plan.steps.filter((s) => s.status === 'completed').length;
                    vscode.window.showInformationMessage('AgentDev: Task completed successfully');
                    outputChannel.appendLine(`Task completed: ${completedCount}/${plan.steps.length} steps passed`);
                }
                else {
                    vscode.window.showWarningMessage('AgentDev: Task completed with issues');
                    outputChannel.appendLine(`Task finished with status: ${plan.status}`);
                }
            }
            catch (error) {
                vscode.window.showErrorMessage(`AgentDev: ${error.message}`);
                outputChannel.appendLine(`Error: ${error.message}`);
            }
            tasksProvider.refresh();
            historyProvider.refresh();
        });
    });
    const planTaskCmd = vscode.commands.registerCommand('agent-dev.planTask', async () => {
        const task = await vscode.window.showInputBox({
            prompt: 'Enter the task to plan',
            placeHolder: 'e.g., Add caching to the API layer',
            title: 'AgentDev - Plan Task',
        });
        if (!task || task.trim().length === 0 || !agentController) {
            return;
        }
        outputChannel.appendLine(`\n=== Planning task: ${task} ===`);
        const planPanel = plan_panel_1.PlanPanel.createOrShow(context.extensionUri);
        const planExecutionPanel = execution_panel_1.ExecutionPanel.createOrShow(context.extensionUri);
        const planVerifyPanel = verify_panel_1.VerifyPanel.createOrShow(context.extensionUri);
        agentController.registerPanels(planPanel, planExecutionPanel, planVerifyPanel);
        try {
            const plan = await agentController.plan(task);
            vscode.window.showInformationMessage(`AgentDev: Plan created with ${plan.steps.length} steps`);
            outputChannel.appendLine(`Plan created: ${plan.steps.length} steps`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`AgentDev: Planning failed - ${error.message}`);
            outputChannel.appendLine(`Planning error: ${error.message}`);
        }
        tasksProvider.refresh();
    });
    const executePlanCmd = vscode.commands.registerCommand('agent-dev.executePlan', async () => {
        if (!agentController) {
            vscode.window.showErrorMessage('AgentDev is not initialized');
            return;
        }
        const plan = agentController.getPlan();
        if (!plan) {
            vscode.window.showWarningMessage('No plan available. Run or plan a task first.');
            return;
        }
        if (agentController.getIsRunning()) {
            vscode.window.showWarningMessage('AgentDev is already running');
            return;
        }
        outputChannel.appendLine(`\n=== Executing plan: ${plan.id} ===`);
        const executionPanel = execution_panel_1.ExecutionPanel.createOrShow(context.extensionUri);
        const verifyPanelObj = verify_panel_1.VerifyPanel.createOrShow(context.extensionUri);
        const planPanel = plan_panel_1.PlanPanel.createOrShow(context.extensionUri);
        const planExecutionPanel = execution_panel_1.ExecutionPanel.createOrShow(context.extensionUri);
        const planVerifyPanel = verify_panel_1.VerifyPanel.createOrShow(context.extensionUri);
        agentController.registerPanels(planPanel, planExecutionPanel, planVerifyPanel);
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'AgentDev',
            cancellable: true,
        }, async (progress, token) => {
            token.onCancellationRequested(() => {
                agentController.stop();
            });
            progress.report({ message: 'Executing plan...' });
            try {
                const result = await agentController.execute(plan);
                if (result.status === 'completed') {
                    vscode.window.showInformationMessage('AgentDev: Plan executed successfully');
                }
                else {
                    vscode.window.showWarningMessage('AgentDev: Plan execution had issues');
                }
            }
            catch (error) {
                vscode.window.showErrorMessage(`AgentDev: ${error.message}`);
            }
            tasksProvider.refresh();
            historyProvider.refresh();
        });
    });
    const stopAgentCmd = vscode.commands.registerCommand('agent-dev.stopAgent', () => {
        if (agentController) {
            agentController.stop();
            vscode.window.showInformationMessage('AgentDev: Agent stopped');
            outputChannel.appendLine('Agent stopped by user');
            tasksProvider.refresh();
        }
    });
    const configureProviderCmd = vscode.commands.registerCommand('agent-dev.configureProvider', async () => {
        const providers = ['openai', 'anthropic', 'local'];
        const selected = await vscode.window.showQuickPick(providers.map(p => ({
            label: p.charAt(0).toUpperCase() + p.slice(1),
            description: p === 'local' ? 'Local model via Ollama or llama.cpp' : `Cloud API (${p})`,
            provider: p,
        })), {
            placeHolder: 'Select LLM provider',
            title: 'AgentDev - Configure Provider',
        });
        if (!selected) {
            return;
        }
        const cfg = vscode.workspace.getConfiguration('agent-dev');
        await cfg.update('provider', selected.provider, vscode.ConfigurationTarget.Global);
        if (selected.provider !== 'local') {
            const apiKey = await vscode.window.showInputBox({
                prompt: `Enter your ${selected.provider} API key`,
                password: true,
                title: `AgentDev - ${selected.provider} API Key`,
            });
            if (apiKey) {
                await cfg.update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
            }
            const models = selected.provider === 'openai'
                ? ['gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-3.5-turbo']
                : ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'];
            const model = await vscode.window.showQuickPick(models, {
                placeHolder: 'Select model',
                title: 'AgentDev - Model Selection',
            });
            if (model) {
                await cfg.update('model', model, vscode.ConfigurationTarget.Global);
            }
        }
        else {
            const endpoint = await vscode.window.showInputBox({
                prompt: 'Enter local model endpoint URL',
                value: 'http://localhost:11434',
                title: 'AgentDev - Local Endpoint',
            });
            if (endpoint) {
                await cfg.update('localEndpoint', endpoint, vscode.ConfigurationTarget.Global);
            }
            const model = await vscode.window.showInputBox({
                prompt: 'Enter local model name',
                value: 'llama3',
                title: 'AgentDev - Model Name',
            });
            if (model) {
                await cfg.update('model', model, vscode.ConfigurationTarget.Global);
            }
        }
        const newConfig = (0, types_1.getConfig)();
        agentController = createAgent(newConfig);
        vscode.window.showInformationMessage(`AgentDev: Provider configured - ${selected.provider}`);
        outputChannel.appendLine(`Provider switched to: ${selected.provider}/${newConfig.model}`);
    });
    const showPlanPanelCmd = vscode.commands.registerCommand('agent-dev.showPlanPanel', () => {
        plan_panel_1.PlanPanel.createOrShow(context.extensionUri);
    });
    const showExecutionPanelCmd = vscode.commands.registerCommand('agent-dev.showExecutionPanel', () => {
        execution_panel_1.ExecutionPanel.createOrShow(context.extensionUri);
    });
    const showVerifyPanelCmd = vscode.commands.registerCommand('agent-dev.showVerifyPanel', () => {
        verify_panel_1.VerifyPanel.createOrShow(context.extensionUri);
    });
    const refreshSidebarCmd = vscode.commands.registerCommand('agent-dev.refreshSidebar', () => {
        tasksProvider.refresh();
        historyProvider.refresh();
    });
    context.subscriptions.push(runTaskCmd, planTaskCmd, executePlanCmd, stopAgentCmd, configureProviderCmd, showPlanPanelCmd, showExecutionPanelCmd, showVerifyPanelCmd, refreshSidebarCmd);
}
function registerTreeViews(context) {
    const tasksView = vscode.window.createTreeView('agent-dev-tasks', {
        treeDataProvider: tasksProvider,
        showCollapseAll: true,
    });
    const historyView = vscode.window.createTreeView('agent-dev-history', {
        treeDataProvider: historyProvider,
        showCollapseAll: true,
    });
    context.subscriptions.push(tasksView, historyView);
    if (agentController) {
        agentController.onStateChanged(() => {
            tasksProvider.refresh();
            historyProvider.refresh();
        });
    }
}
function registerEventListeners(context) {
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('agent-dev')) {
            const newConfig = (0, types_1.getConfig)();
            agentController = createAgent(newConfig);
            outputChannel.appendLine(`Configuration updated - provider: ${newConfig.provider}/${newConfig.model}`);
            vscode.window.showInformationMessage('AgentDev: Configuration updated');
        }
    }));
}
const STATE_ICONS = {
    running: new vscode.ThemeIcon('sync~spin'),
    executing: new vscode.ThemeIcon('sync~spin'),
    planning: new vscode.ThemeIcon('list-unordered'),
    verifying: new vscode.ThemeIcon('beaker'),
    completed: new vscode.ThemeIcon('check'),
    failed: new vscode.ThemeIcon('error'),
    pending: new vscode.ThemeIcon('circle-large-outline'),
    idle: new vscode.ThemeIcon('circle-large-outline'),
};
class AgentTasksProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(_element) {
        if (!agentController) {
            return [new TaskTreeItem('No agent initialized', vscode.TreeItemCollapsibleState.None)];
        }
        const items = [];
        const isRunning = agentController.getIsRunning();
        if (isRunning) {
            items.push(new TaskTreeItem('Agent is running...', vscode.TreeItemCollapsibleState.None, 'running'));
        }
        else {
            items.push(new TaskTreeItem('Agent is idle', vscode.TreeItemCollapsibleState.None, 'idle'));
        }
        const plan = agentController.getPlan();
        if (plan) {
            items.push(new TaskTreeItem(`Task: ${plan.task.substring(0, 60)}`, vscode.TreeItemCollapsibleState.Collapsed, plan.status));
            for (const step of plan.steps) {
                const statusIcon = step.status === 'completed' ? '\u2713' : step.status === 'failed' ? '\u2717' : step.status === 'running' ? '\u25B6' : '\u25CB';
                items.push(new TaskTreeItem(`${statusIcon} ${step.description.substring(0, 50)}`, vscode.TreeItemCollapsibleState.None, step.status));
            }
        }
        else {
            items.push(new TaskTreeItem('No active plan', vscode.TreeItemCollapsibleState.None));
        }
        return items;
    }
}
class AgentHistoryProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.history = [];
    }
    refresh() {
        if (agentController) {
            const plan = agentController.getPlan();
            if (plan && (plan.status === 'completed' || plan.status === 'failed')) {
                const exists = this.history.find(h => h.task === plan.task);
                if (!exists) {
                    this.history.unshift({
                        task: plan.task,
                        status: plan.status,
                        timestamp: Date.now(),
                    });
                    if (this.history.length > 50) {
                        this.history = this.history.slice(0, 50);
                    }
                }
            }
        }
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(_element) {
        if (this.history.length === 0) {
            return [new TaskTreeItem('No task history yet', vscode.TreeItemCollapsibleState.None)];
        }
        return this.history.map(h => {
            const time = new Date(h.timestamp).toLocaleTimeString();
            const icon = h.status === 'completed' ? '\u2713' : '\u2717';
            return new TaskTreeItem(`${icon} ${h.task.substring(0, 50)} (${time})`, vscode.TreeItemCollapsibleState.None, h.status);
        });
    }
}
class TaskTreeItem extends vscode.TreeItem {
    constructor(label, collapsibleState, state) {
        super(label, collapsibleState);
        if (state && STATE_ICONS[state]) {
            this.iconPath = STATE_ICONS[state];
            this.tooltip = state;
        }
        else {
            this.iconPath = new vscode.ThemeIcon('circle-large-outline');
            this.tooltip = 'Idle';
        }
    }
}
//# sourceMappingURL=extension.js.map