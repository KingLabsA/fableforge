import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { ILLMProvider, LLMMessage, LLMResponse, LLMChatOptions, AgentError } from '../types';

export class APIProvider implements ILLMProvider {
  private apiKey: string;
  private model: string;
  private providerType: 'openai' | 'anthropic';

  constructor(providerType: 'openai' | 'anthropic', apiKey: string, model: string) {
    if (!apiKey) {
      throw new AgentError('API key is required for API providers', 'NO_API_KEY', false);
    }
    this.providerType = providerType;
    this.apiKey = apiKey;
    this.model = model;
  }

  get name(): string {
    return `${this.providerType}/${this.model}`;
  }

  async chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMResponse> {
    if (this.providerType === 'openai') {
      return this.chatOpenAI(messages, options);
    } else {
      return this.chatAnthropic(messages, options);
    }
  }

  private async chatOpenAI(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMResponse> {
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

    const data = JSON.parse(response) as {
      choices: Array<{ message: { content: string } }>;
      model: string;
      usage: { prompt_tokens: number; completion_tokens: number };
    };

    if (!data.choices || data.choices.length === 0) {
      throw new AgentError('No response from OpenAI', 'EMPTY_RESPONSE', true);
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

  private async chatAnthropic(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMResponse> {
    const url = 'https://api.anthropic.com/v1/messages';

    const systemMessage = messages.find(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    const requestBody: Record<string, unknown> = {
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

    const data = JSON.parse(response) as {
      content: Array<{ type: string; text: string }>;
      model: string;
      usage: { input_tokens: number; output_tokens: number };
    };

    if (!data.content || data.content.length === 0) {
      throw new AgentError('No response from Anthropic', 'EMPTY_RESPONSE', true);
    }

    const textContent = data.content
      .filter((block: { type: string }) => block.type === 'text')
      .map((block: { type: string; text: string }) => block.text)
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

  private makeRequest(urlStr: string, opts: { method: string; headers: Record<string, string>; body: string }): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL(urlStr);
      const transport = url.protocol === 'https:' ? https : http;

      const reqOptions: https.RequestOptions = {
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
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            const errorMsg = data.substring(0, 500);
            reject(new AgentError(
              `API request failed (${res.statusCode}): ${errorMsg}`,
              'API_ERROR',
              res.statusCode ? res.statusCode >= 500 : true
            ));
          }
        });
      });

      req.on('error', (err: Error) => {
        reject(new AgentError(`Network error: ${err.message}`, 'NETWORK_ERROR', true));
      });

      req.write(opts.body);
      req.end();
    });
  }
}
