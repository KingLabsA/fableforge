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
exports.LocalProvider = void 0;
const http = __importStar(require("http"));
const types_1 = require("../types");
class LocalProvider {
    constructor(endpoint, model) {
        this.endpoint = endpoint.replace(/\/$/, '');
        this.modelName = model;
        if (this.endpoint.includes('11434') || this.endpoint.includes('ollama')) {
            this.providerKind = 'ollama';
        }
        else {
            this.providerKind = 'llamacpp';
        }
    }
    get name() {
        return `local/${this.providerKind}/${this.modelName}`;
    }
    async chat(messages, options) {
        if (this.providerKind === 'ollama') {
            return this.chatOllama(messages, options);
        }
        else {
            return this.chatLlamaCpp(messages, options);
        }
    }
    async chatOllama(messages, options) {
        const url = `${this.endpoint}/api/chat`;
        const body = JSON.stringify({
            model: this.modelName,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            stream: false,
            options: {
                temperature: options?.temperature ?? 0.2,
                num_predict: options?.maxTokens ?? 4096,
            },
        });
        const response = await this.makeRequest(url, body);
        const data = JSON.parse(response);
        if (!data.message || !data.message.content) {
            throw new types_1.AgentError('No response from local model', 'EMPTY_RESPONSE', true);
        }
        return {
            content: data.message.content,
            model: data.model || this.modelName,
            usage: {
                promptTokens: data.prompt_eval_count ?? 0,
                completionTokens: data.eval_count ?? 0,
            },
        };
    }
    async chatLlamaCpp(messages, options) {
        const url = `${this.endpoint}/v1/chat/completions`;
        const body = JSON.stringify({
            model: this.modelName,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            temperature: options?.temperature ?? 0.2,
            max_tokens: options?.maxTokens ?? 4096,
        });
        const response = await this.makeRequest(url, body);
        const data = JSON.parse(response);
        if (!data.choices || data.choices.length === 0) {
            throw new types_1.AgentError('No response from llama.cpp server', 'EMPTY_RESPONSE', true);
        }
        return {
            content: data.choices[0].message.content,
            model: data.model || this.modelName,
            usage: {
                promptTokens: data.usage?.prompt_tokens ?? 0,
                completionTokens: data.usage?.completion_tokens ?? 0,
            },
        };
    }
    makeRequest(urlStr, body) {
        return new Promise((resolve, reject) => {
            const url = new URL(urlStr);
            const reqOptions = {
                hostname: url.hostname,
                port: url.port || 80,
                path: url.pathname + url.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body).toString(),
                },
                timeout: 300000,
            };
            const req = http.request(reqOptions, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk.toString();
                });
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data);
                    }
                    else {
                        reject(new types_1.AgentError(`Local model request failed (${res.statusCode}): ${data.substring(0, 500)}`, 'LOCAL_MODEL_ERROR', res.statusCode ? res.statusCode >= 500 : true));
                    }
                });
            });
            req.on('error', (err) => {
                reject(new types_1.AgentError(`Local model connection error: ${err.message}. Is ${this.providerKind} running?`, 'LOCAL_CONNECTION_ERROR', true));
            });
            req.on('timeout', () => {
                req.destroy();
                reject(new types_1.AgentError(`Local model request timed out. Is ${this.providerKind} running?`, 'LOCAL_TIMEOUT', true));
            });
            req.write(body);
            req.end();
        });
    }
}
exports.LocalProvider = LocalProvider;
//# sourceMappingURL=local_provider.js.map