import { ILLMProvider, LLMMessage, LLMResponse, LLMChatOptions } from '../types';
export declare class APIProvider implements ILLMProvider {
    private apiKey;
    private model;
    private providerType;
    constructor(providerType: 'openai' | 'anthropic', apiKey: string, model: string);
    get name(): string;
    chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMResponse>;
    private chatOpenAI;
    private chatAnthropic;
    private makeRequest;
}
//# sourceMappingURL=api_provider.d.ts.map