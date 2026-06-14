import * as http from 'http';
import { ILLMProvider, LLMMessage, LLMResponse, LLMChatOptions, AgentError } from '../types';

export class LocalProvider implements ILLMProvider {
  private endpoint: string;
  private modelName: string;
  private providerKind: 'ollama' | 'llamacpp';

  constructor(endpoint: string, model: string) {
    this.endpoint = endpoint.replace(/\/$/, '');
    this.modelName = model;

    if (this.endpoint.includes('11434') || this.endpoint.includes('ollama')) {
      this.providerKind = 'ollama';
    } else {
      this.providerKind = 'llamacpp';
    }
  }

  get name(): string {
    return `local/${this.providerKind}/${this.modelName}`;
  }

  async chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMResponse> {
    if (this.providerKind === 'ollama') {
      return this.chatOllama(messages, options);
    } else {
      return this.chatLlamaCpp(messages, options);
    }
  }

  private async chatOllama(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMResponse> {
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
    const data = JSON.parse(response) as {
      message: { content: string };
      model: string;
      prompt_eval_count?: number;
      eval_count?: number;
    };

    if (!data.message || !data.message.content) {
      throw new AgentError('No response from local model', 'EMPTY_RESPONSE', true);
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

  private async chatLlamaCpp(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMResponse> {
    const url = `${this.endpoint}/v1/chat/completions`;
    const body = JSON.stringify({
      model: this.modelName,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 4096,
    });

    const response = await this.makeRequest(url, body);
    const data = JSON.parse(response) as {
      choices: Array<{ message: { content: string } }>;
      model: string;
      usage: { prompt_tokens: number; completion_tokens: number };
    };

    if (!data.choices || data.choices.length === 0) {
      throw new AgentError('No response from llama.cpp server', 'EMPTY_RESPONSE', true);
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

  private makeRequest(urlStr: string, body: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL(urlStr);

      const reqOptions: http.RequestOptions = {
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
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new AgentError(
              `Local model request failed (${res.statusCode}): ${data.substring(0, 500)}`,
              'LOCAL_MODEL_ERROR',
              res.statusCode ? res.statusCode >= 500 : true
            ));
          }
        });
      });

      req.on('error', (err: Error) => {
        reject(new AgentError(
          `Local model connection error: ${err.message}. Is ${this.providerKind} running?`,
          'LOCAL_CONNECTION_ERROR',
          true
        ));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new AgentError(
          `Local model request timed out. Is ${this.providerKind} running?`,
          'LOCAL_TIMEOUT',
          true
        ));
      });

      req.write(body);
      req.end();
    });
  }
}
