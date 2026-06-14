import { ILLMProvider, LLMMessage, LLMResponse, LLMChatOptions } from '../types';
export declare class LocalProvider implements ILLMProvider {
    private endpoint;
    private modelName;
    private providerKind;
    constructor(endpoint: string, model: string);
    get name(): string;
    chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMResponse>;
    private chatOllama;
    private chatLlamaCpp;
    private makeRequest;
}
//# sourceMappingURL=local_provider.d.ts.map