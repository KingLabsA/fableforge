'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { TraceStep } from '@/lib/trace_parser';

interface ReasoningViewProps {
  step: TraceStep;
}

function extractSections(reasoning: string): { title: string; content: string }[] {
  const sections: { title: string; content: string }[] = [];
  const lines = reasoning.split('\n');
  let currentTitle = 'Reasoning';
  let currentContent: string[] = [];
  
  for (const line of lines) {
    if (line.startsWith('## ') || line.startsWith('### ')) {
      if (currentContent.length > 0) {
        sections.push({ title: currentTitle, content: currentContent.join('\n') });
      }
      currentTitle = line.replace(/^#+\s*/, '');
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  if (currentContent.length > 0) {
    sections.push({ title: currentTitle, content: currentContent.join('\n') });
  }
  return sections;
}

function formatContent(content: string, toolName?: string, toolInput?: Record<string, unknown>): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      const lang = line.replace('```', '').trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      parts.push(
        <pre key={i} className="bg-bg-primary border border-border rounded-lg p-3 overflow-x-auto my-2">
          {lang && <div className="text-[10px] text-text-muted mb-1 uppercase">{lang}</div>}
          <code className="text-sm font-mono text-text-primary">{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      parts.push(
        <div key={i} className="flex gap-2 ml-2">
          <span className="text-accent mt-0.5">•</span>
          <span>{line.substring(2)}</span>
        </div>
      );
      continue;
    }

    if (line.trim() === '') {
      parts.push(<br key={i} />);
      continue;
    }

    parts.push(
      <span key={i} className="leading-relaxed">
        {line}
      </span>
    );
  }

  return <div className="space-y-0.5">{parts}</div>;
}

export default function ReasoningView({ step }: ReasoningViewProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const hasReasoning = !!step.reasoning;
  const sections = hasReasoning ? extractSections(step.reasoning!) : [];

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const toggleSection = (title: string) => {
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <div className="space-y-3">
      {step.role === 'user' && (
        <div className="bg-step-user/10 border border-step-user/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-step-user" />
            <span className="text-sm font-semibold text-step-user">User Input</span>
          </div>
          <p className="text-sm text-text-primary whitespace-pre-wrap">{step.content}</p>
        </div>
      )}

      {step.role === 'assistant' && (
        <div className="bg-step-assistant/10 border border-step-assistant/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-step-assistant" />
            <span className="text-sm font-semibold text-step-assistant">Assistant</span>
            {step.tokens && (
              <span className="text-[10px] text-text-muted ml-auto font-mono">
                {step.tokens.input + step.tokens.output} tokens
              </span>
            )}
          </div>
          <div className="text-sm text-text-primary markdown-content">
            {formatContent(step.content)}
          </div>
        </div>
      )}

      {step.role === 'tool' && step.toolName && (
        <div className="bg-step-tool/10 border border-step-tool/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-step-tool" />
            <span className="text-sm font-semibold text-step-tool">Tool: {step.toolName}</span>
          </div>

          {step.toolInput && Object.keys(step.toolInput).length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Input</div>
              <pre className="bg-bg-primary rounded p-3 text-xs font-mono overflow-x-auto text-text-secondary border border-border">
                {typeof step.toolInput === 'object'
                  ? Object.entries(step.toolInput)
                      .map(([k, v]) => {
                        if (typeof v === 'string' && v.length > 200) {
                          return `${k}: ${v.substring(0, 200)}...`;
                        }
                        return `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`;
                      })
                      .join('\n')
                  : JSON.stringify(step.toolInput, null, 2)}
              </pre>
            </div>
          )}

          {step.toolOutput && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Output</div>
              <pre className="bg-bg-primary rounded p-3 text-xs font-mono overflow-x-auto text-text-secondary max-h-64 overflow-y-auto border border-border">
                {step.toolOutput.length > 2000
                  ? step.toolOutput.substring(0, 2000) + '\n... (truncated)'
                  : step.toolOutput}
              </pre>
            </div>
          )}
        </div>
      )}

      {step.role === 'error' && (
        <div className="bg-step-error/10 border border-step-error/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-step-error" />
            <span className="text-sm font-semibold text-step-error">Error</span>
          </div>
          <p className="text-sm text-red-300">{step.content}</p>
        </div>
      )}

      {step.role === 'system' && (
        <div className="bg-step-system/10 border border-step-system/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-step-system" />
            <span className="text-sm font-semibold text-step-system">System</span>
          </div>
          <p className="text-sm text-text-primary">{step.content}</p>
        </div>
      )}

      {hasReasoning && sections.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Reasoning</span>
            <button
              onClick={() => {
                const allCollapsed = sections.every((s) => collapsed[s.title]);
                const newState: Record<string, boolean> = {};
                sections.forEach((s) => (newState[s.title] = !allCollapsed));
                setCollapsed(newState);
              }}
              className="text-[10px] text-accent hover:text-accent-hover"
            >
              {sections.every((s) => collapsed[s.title]) ? 'Expand all' : 'Collapse all'}
            </button>
          </div>
          {sections.map((section, idx) => (
            <div key={idx} className="border border-border/50 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection(section.title)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bg-hover transition-colors"
              >
                {collapsed[section.title] ? (
                  <ChevronRight className="w-3 h-3 text-text-muted" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-text-muted" />
                )}
                <span className="text-xs font-medium text-text-primary">{section.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(section.content, `section-${idx}`);
                  }}
                  className="ml-auto p-0.5 hover:bg-bg-tertiary rounded"
                >
                  {copied === `section-${idx}` ? (
                    <Check className="w-3 h-3 text-green-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-text-muted" />
                  )}
                </button>
              </button>
              <AnimatePresence>
                {!collapsed[section.title] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 text-sm text-text-secondary markdown-content">
                      {formatContent(section.content)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {hasReasoning && sections.length === 0 && (
        <div className="border border-border/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Reasoning
            </span>
            <button
              onClick={() => handleCopy(step.reasoning!, 'reasoning')}
              className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-primary p-1"
            >
              {copied === 'reasoning' ? (
                <Check className="w-3 h-3 text-green-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
          <p className="text-sm text-text-secondary">{step.reasoning}</p>
        </div>
      )}
    </div>
  );
}
