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
exports.APIProvider = void 0;
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const url_1 = require("url");
const types_1 = require("../types");
class APIProvider {
    constructor(providerType, apiKey, model) {
        if (!apiKey) {
            throw new types_1.AgentError('API key is required for API providers', 'NO_API_KEY', false);
        }
        this.providerType = providerType;
        this.apiKey = apiKey;
        this.model = model;
    }
    get name() {
        return `${this.providerType}/${this.model}`;
    }
    async chat(messages, options) {
        if (this.providerType === 'openai') {
            return this.chatOpenAI(messages, options);
        }
        else {
            return this.chatAnthropic(messages, options);
        }
    }
    async chatOpenAI(messages, options) {
        const url = 'https://api.openai.com/v1/chat/completions';
        const body = JSON.stringify({
            model: this.model,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            temperature: options?.temperature ?? 0.2,
            max_tokens: options?.maxTokens ?? 4096,
            stop: options?.stop,
        });
        const response = await this.makeRequest(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body,
        });
        const data = JSON.parse(response);
        if (!data.choices || data.choices.length === 0) {
            throw new types_1.AgentError('No response from OpenAI', 'EMPTY_RESPONSE', true);
        }
        return {
            content: data.choices[0].message.content,
            model: data.model,
            usage: {
                promptTokens: data.usage?.prompt_tokens ?? 0,
                completionTokens: data.usage?.completion_tokens ?? 0,
            },
        };
    }
    async chatAnthropic(messages, options) {
        const url = 'https://api.anthropic.com/v1/messages';
        const systemMessage = messages.find(m => m.role === 'system');
        const nonSystemMessages = messages.filter(m => m.role !== 'system');
        const requestBody = {
            model: this.model,
            max_tokens: options?.maxTokens ?? 4096,
            messages: nonSystemMessages.map(m => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content,
            })),
            temperature: options?.temperature ?? 0.2,
        };
        if (systemMessage) {
            requestBody.system = systemMessage.content;
        }
        if (options?.stop) {
            requestBody.stop_sequences = options.stop;
        }
        const body = JSON.stringify(requestBody);
        const response = await this.makeRequest(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body,
        });
        const data = JSON.parse(response);
        if (!data.content || data.content.length === 0) {
            throw new types_1.AgentError('No response from Anthropic', 'EMPTY_RESPONSE', true);
        }
        const textContent = data.content
            .filter((block) => block.type === 'text')
            .map((block) => block.text)
            .join('\n');
        return {
            content: textContent,
            model: data.model,
            usage: {
                promptTokens: data.usage?.input_tokens ?? 0,
                completionTokens: data.usage?.output_tokens ?? 0,
            },
        };
    }
    makeRequest(urlStr, opts) {
        return new Promise((resolve, reject) => {
            const url = new url_1.URL(urlStr);
            const transport = url.protocol === 'https:' ? https : http;
            const reqOptions = {
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname + url.search,
                method: opts.method,
                headers: {
                    ...opts.headers,
                    'Content-Length': Buffer.byteLength(opts.body).toString(),
                },
            };
            const req = transport.request(reqOptions, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk.toString();
                });
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data);
                    }
                    else {
                        const errorMsg = data.substring(0, 500);
                        reject(new types_1.AgentError(`API request failed (${res.statusCode}): ${errorMsg}`, 'API_ERROR', res.statusCode ? res.statusCode >= 500 : true));
                    }
                });
            });
            req.on('error', (err) => {
                reject(new types_1.AgentError(`Network error: ${err.message}`, 'NETWORK_ERROR', true));
            });
            req.write(opts.body);
            req.end();
        });
    }
}
exports.APIProvider = APIProvider;
//# sourceMappingURL=api_provider.js.map