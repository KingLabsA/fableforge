export type StepRole = 'user' | 'assistant' | 'tool' | 'system' | 'error';

export interface TraceStep {
  id: string;
  index: number;
  role: StepRole;
  content: string;
  timestamp: number;
  duration_ms: number;
  tokens?: {
    input: number;
    output: number;
  };
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: string;
  reasoning?: string;
  metadata?: Record<string, unknown>;
}

export interface Trace {
  id: string;
  title: string;
  source: string;
  steps: TraceStep[];
  startTime: number;
  endTime: number;
  totalTokens: { input: number; output: number };
  toolsUsed: string[];
  metadata?: Record<string, unknown>;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function numField(obj: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number') return v;
    if (typeof v === 'object' && v !== null) {
      const inner = v as Record<string, unknown>;
      for (const ik of keys.slice(keys.indexOf(k) + 1)) {
        if (typeof inner[ik] === 'number') return inner[ik] as number;
      }
    }
  }
  return 0;
}

function strField(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    if (typeof obj[k] === 'string') return obj[k] as string;
  }
  return '';
}

function objField(obj: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const v = obj[key];
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) return v as Record<string, unknown>;
  return undefined;
}

export function parseGlintTrace(jsonl: string): Trace {
  const lines = jsonl.trim().split('\n').filter(Boolean);
  const steps: TraceStep[] = [];
  let title = 'Glint Trace';
  let startTime = Infinity;
  let endTime = 0;
  let totalInput = 0;
  let totalOutput = 0;
  const toolsSet = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    let raw: Record<string, unknown>;
    try { raw = JSON.parse(lines[i]); } catch { continue; }

    const type = raw.type as string;
    const ts = (raw.timestamp as number) ?? Date.now();
    if (ts < startTime) startTime = ts;
    if (ts > endTime) endTime = ts;

    if (type === 'session_start') { title = strField(raw, 'title') || title; continue; }

    let role: StepRole = 'system';
    let content = '';
    let toolName: string | undefined;
    let toolInput: Record<string, unknown> | undefined;
    let toolOutput: string | undefined;
    let reasoning: string | undefined;
    let tokens: { input: number; output: number } | undefined;
    const duration = (raw.duration_ms as number) ?? 0;

    if (type === 'user_message') {
      role = 'user';
      content = strField(raw, 'content');
    } else if (type === 'assistant_message') {
      role = 'assistant';
      content = strField(raw, 'content');
      reasoning = strField(raw, 'reasoning') || undefined;
      const ti = numField(raw, 'input_tokens') || numField(objField(raw, 'usage') || {}, 'input_tokens');
      const to = numField(raw, 'output_tokens') || numField(objField(raw, 'usage') || {}, 'output_tokens');
      if (ti || to) { tokens = { input: ti, output: to }; totalInput += ti; totalOutput += to; }
    } else if (type === 'tool_call') {
      role = 'tool';
      toolName = strField(raw, 'name') || 'unknown';
      content = `Tool: ${toolName}`;
      toolInput = objField(raw, 'input') || {};
      toolsSet.add(toolName);
    } else if (type === 'tool_result') {
      role = 'tool';
      toolName = strField(raw, 'tool_name') || 'unknown';
      toolOutput = strField(raw, 'output');
      content = `Result: ${toolOutput.substring(0, 100)}`;
      toolsSet.add(toolName);
    } else if (type === 'error') {
      role = 'error';
      content = strField(raw, 'message') || 'Unknown error';
    } else {
      content = JSON.stringify(raw);
    }

    steps.push({ id: generateId(), index: steps.length, role, content, timestamp: ts, duration_ms: duration, tokens, toolName, toolInput, toolOutput, reasoning, metadata: raw });
  }

  if (startTime === Infinity) startTime = Date.now();
  if (endTime === 0) endTime = startTime;

  return { id: generateId(), title, source: 'glint', steps, startTime, endTime, totalTokens: { input: totalInput, output: totalOutput }, toolsUsed: Array.from(toolsSet) };
}

export function parseArmand0eTrace(jsonl: string): Trace {
  const lines = jsonl.trim().split('\n').filter(Boolean);
  const steps: TraceStep[] = [];
  let title = 'Armand0e Trace';
  let startTime = Infinity;
  let endTime = 0;
  let totalInput = 0;
  let totalOutput = 0;
  const toolsSet = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    let raw: Record<string, unknown>;
    try { raw = JSON.parse(lines[i]); } catch { continue; }

    const eventType = strField(raw, 'event', 'type');
    const ts = (raw.ts as number) ?? (raw.timestamp as number) ?? Date.now();
    if (ts < startTime) startTime = ts;
    if (ts > endTime) endTime = ts;

    let role: StepRole = 'system';
    let content = '';
    let toolName: string | undefined;
    let toolInput: Record<string, unknown> | undefined;
    let toolOutput: string | undefined;
    let reasoning: string | undefined;
    let tokens: { input: number; output: number } | undefined;
    const duration = (raw.duration_ms as number) ?? (raw.elapsed_ms as number) ?? 0;

    if (eventType === 'message' || eventType === 'chat') {
      const sender = strField(raw, 'sender', 'role');
      if (sender === 'user' || sender === 'human') {
        role = 'user'; content = strField(raw, 'text', 'content');
      } else if (sender === 'assistant' || sender === 'ai' || sender === 'model') {
        role = 'assistant'; content = strField(raw, 'text', 'content');
        reasoning = strField(raw, 'thinking', 'reasoning') || undefined;
        const ti = numField(raw, 'input_tokens');
        const to = numField(raw, 'output_tokens');
        const usageObj = objField(raw, 'usage');
        const tiFinal = ti || (usageObj ? numField(usageObj, 'input_tokens') : 0);
        const toFinal = to || (usageObj ? numField(usageObj, 'output_tokens') : 0);
        if (tiFinal || toFinal) { tokens = { input: tiFinal, output: toFinal }; totalInput += tiFinal; totalOutput += toFinal; }
      }
    } else if (eventType === 'tool_use' || eventType === 'action' || eventType === 'function_call') {
      role = 'tool';
      toolName = strField(raw, 'tool', 'name', 'function') || 'unknown';
      content = `Tool: ${toolName}`;
      toolInput = objField(raw, 'args') || objField(raw, 'input') || objField(raw, 'params') || {};
      toolsSet.add(toolName);
    } else if (eventType === 'tool_result' || eventType === 'observation' || eventType === 'function_result') {
      role = 'tool';
      toolName = strField(raw, 'tool_name', 'tool') || 'unknown';
      toolOutput = strField(raw, 'result', 'output');
      content = `Result: ${toolOutput.substring(0, 100)}`;
      toolsSet.add(toolName);
    } else if (eventType === 'error' || eventType === 'exception') {
      role = 'error'; content = strField(raw, 'message', 'error') || 'Unknown error';
    } else if (eventType === 'metadata' || eventType === 'config') {
      title = strField(raw, 'session_name', 'title') || title; continue;
    } else { content = JSON.stringify(raw); }

    steps.push({ id: generateId(), index: steps.length, role, content, timestamp: ts, duration_ms: duration, tokens, toolName, toolInput, toolOutput, reasoning, metadata: raw });
  }

  if (startTime === Infinity) startTime = Date.now();
  if (endTime === 0) endTime = startTime;

  return { id: generateId(), title, source: 'armand0e', steps, startTime, endTime, totalTokens: { input: totalInput, output: totalOutput }, toolsUsed: Array.from(toolsSet) };
}

export function parseVFableTrace(jsonl: string): Trace {
  const lines = jsonl.trim().split('\n').filter(Boolean);
  const steps: TraceStep[] = [];
  let title = 'V-Fable Trace';
  let startTime = Infinity;
  let endTime = 0;
  let totalInput = 0;
  let totalOutput = 0;
  const toolsSet = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    let raw: Record<string, unknown>;
    try { raw = JSON.parse(lines[i]); } catch { continue; }

    const kind = strField(raw, 'kind', 'type');
    const ts = (raw.timestamp as number) ?? (raw.t as number) ?? Date.now();
    if (ts < startTime) startTime = ts;
    if (ts > endTime) endTime = ts;

    let role: StepRole = 'system';
    let content = '';
    let toolName: string | undefined;
    let toolInput: Record<string, unknown> | undefined;
    let toolOutput: string | undefined;
    let reasoning: string | undefined;
    let tokens: { input: number; output: number } | undefined;
    const duration = (raw.duration_ms as number) ?? (raw.ms as number) ?? 0;

    if (kind === 'prompt' || kind === 'input') {
      role = 'user'; content = strField(raw, 'text', 'content');
    } else if (kind === 'response' || kind === 'output' || kind === 'completion') {
      role = 'assistant'; content = strField(raw, 'text', 'content');
      reasoning = strField(raw, 'chain_of_thought', 'reasoning', 'thinking') || undefined;
      const ti = numField(raw, 'tokens_in', 'input_tokens');
      const to = numField(raw, 'tokens_out', 'output_tokens');
      if (ti || to) { tokens = { input: ti, output: to }; totalInput += ti; totalOutput += to; }
    } else if (kind === 'tool_invoke' || kind === 'call') {
      role = 'tool';
      toolName = strField(raw, 'tool', 'name') || 'unknown';
      content = `Tool: ${toolName}`;
      toolInput = objField(raw, 'args') || objField(raw, 'parameters') || {};
      toolsSet.add(toolName);
    } else if (kind === 'tool_return' || kind === 'result') {
      role = 'tool';
      toolName = strField(raw, 'tool', 'tool_name') || 'unknown';
      toolOutput = strField(raw, 'value', 'output');
      content = `Result: ${toolOutput.substring(0, 100)}`;
      toolsSet.add(toolName);
    } else if (kind === 'error') {
      role = 'error'; content = strField(raw, 'message', 'msg') || 'Unknown error';
    } else if (kind === 'session') {
      title = strField(raw, 'title') || title; continue;
    } else { content = JSON.stringify(raw); }

    steps.push({ id: generateId(), index: steps.length, role, content, timestamp: ts, duration_ms: duration, tokens, toolName, toolInput, toolOutput, reasoning, metadata: raw });
  }

  if (startTime === Infinity) startTime = Date.now();
  if (endTime === 0) endTime = startTime;

  return { id: generateId(), title, source: 'v-fable', steps, startTime, endTime, totalTokens: { input: totalInput, output: totalOutput }, toolsUsed: Array.from(toolsSet) };
}

export function detectFormat(jsonl: string): 'glint' | 'armand0e' | 'v-fable' | 'unknown' {
  const firstLines = jsonl.trim().split('\n').slice(0, 5);
  const glintTypes = ['session_start', 'user_message', 'assistant_message', 'tool_call', 'tool_result'];
  const armand0eEvents = ['message', 'chat', 'tool_use', 'action', 'function_call', 'tool_result', 'observation'];
  const vfableKinds = ['prompt', 'response', 'output', 'completion', 'tool_invoke', 'call', 'tool_return', 'result'];

  for (const line of firstLines) {
    try {
      const obj = JSON.parse(line);
      if (glintTypes.includes(obj.type as string)) return 'glint';
      if (armand0eEvents.includes(obj.event as string)) return 'armand0e';
      if (vfableKinds.includes(obj.kind as string)) return 'v-fable';
    } catch { continue; }
  }
  const lower = jsonl.substring(0, 500).toLowerCase();
  if (lower.includes('"kind"')) return 'v-fable';
  if (lower.includes('"event"')) return 'armand0e';
  if (lower.includes('"type"')) return 'glint';
  return 'unknown';
}

export function parseTrace(jsonl: string): Trace {
  const format = detectFormat(jsonl);
  switch (format) {
    case 'glint': return parseGlintTrace(jsonl);
    case 'armand0e': return parseArmand0eTrace(jsonl);
    case 'v-fable': return parseVFableTrace(jsonl);
    default: return parseGlintTrace(jsonl);
  }
}

export function computeTransitions(trace: Trace): Record<string, Record<string, number>> {
  const transitions: Record<string, Record<string, number>> = {};
  for (let i = 1; i < trace.steps.length; i++) {
    const from = trace.steps[i - 1].toolName ?? trace.steps[i - 1].role;
    const to = trace.steps[i].toolName ?? trace.steps[i].role;
    if (!transitions[from]) transitions[from] = {};
    transitions[from][to] = (transitions[from][to] ?? 0) + 1;
  }
  return transitions;
}
