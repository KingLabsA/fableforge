'use client';

import React, { useMemo } from 'react';
import { TraceStep } from '@/lib/trace_parser';

interface DiffViewerProps {
  step: TraceStep;
}

interface DiffLine {
  type: 'context' | 'added' | 'removed' | 'header';
  content: string;
  lineNumber: number;
}

function simpleDiff(before: string, after: string): DiffLine[] {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const lines: DiffLine[] = [];

  const maxLen = Math.max(beforeLines.length, afterLines.length);
  let lineNum = 1;
  
  let i = 0;
  let j = 0;
  
  while (i < beforeLines.length || j < afterLines.length) {
    if (i >= beforeLines.length) {
      lines.push({ type: 'added', content: afterLines[j], lineNumber: lineNum++ });
      j++;
    } else if (j >= afterLines.length) {
      lines.push({ type: 'removed', content: beforeLines[i], lineNumber: lineNum++ });
      i++;
    } else if (beforeLines[i] === afterLines[j]) {
      lines.push({ type: 'context', content: beforeLines[i], lineNumber: lineNum++ });
      i++;
      j++;
    } else {
      const afterIdx = beforeLines.slice(i + 1).indexOf(afterLines[j]);
      const beforeIdx = afterLines.slice(j + 1).indexOf(beforeLines[i]);
      
      if (afterIdx !== -1 && (beforeIdx === -1 || afterIdx <= beforeIdx)) {
        lines.push({ type: 'removed', content: beforeLines[i], lineNumber: lineNum });
        i++;
      } else if (beforeIdx !== -1) {
        lines.push({ type: 'added', content: afterLines[j], lineNumber: lineNum });
        j++;
      } else {
        lines.push({ type: 'removed', content: beforeLines[i], lineNumber: lineNum });
        lines.push({ type: 'added', content: afterLines[j], lineNumber: lineNum });
        lineNum++;
        i++;
        j++;
      }
    }
  }

  return lines;
}

function extractEditContent(step: TraceStep): { before: string; after: string } | null {
  if (step.toolName !== 'Edit' && step.toolName !== 'Write') return null;

  const input = step.toolInput;
  if (!input) return null;

  if (step.toolName === 'Edit') {
    const oldStr = (input.old_string as string) ?? (input.oldString as string) ?? '';
    const newStr = (input.new_string as string) ?? (input.newString as string) ?? '';
    if (oldStr || newStr) {
      return { before: oldStr, after: newStr };
    }
  }

  if (step.toolName === 'Write') {
    const content = (input.content as string) ?? '';
    const existing = (input.existing as string) ?? (input.before as string) ?? '';
    return { before: existing, after: content };
  }

  return null;
}

export default function DiffViewer({ step }: DiffViewerProps) {
  const content = useMemo(() => extractEditContent(step), [step]);

  if (!content) {
    return null;
  }

  const diffLines = useMemo(() => simpleDiff(content.before, content.after), [content]);

  const filePath = (step.toolInput?.file_path as string) ?? (step.toolInput?.filePath as string) ?? '';
  const addedCount = diffLines.filter((l) => l.type === 'added').length;
  const removedCount = diffLines.filter((l) => l.type === 'removed').length;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-bg-secondary border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-step-tool">
            {step.toolName === 'Edit' ? 'Diff' : 'New File'}
          </span>
          {filePath && (
            <span className="text-xs text-text-muted font-mono">{filePath}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-green-400">+{addedCount}</span>
          <span className="text-[10px] text-red-400">-{removedCount}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="font-mono text-xs">
          {content.before ? (
            <div className="flex">
              <div className="flex-shrink-0 w-1/2 border-r border-border">
                <div className="px-2 py-1 text-[10px] text-text-muted bg-bg-tertiary border-b border-border text-center">
                  Before
                </div>
                {content.before.split('\n').map((line, i) => (
                  <div key={i} className="px-2 py-0.5 border-b border-border/30 hover:bg-bg-hover">
                    <span className="text-text-muted mr-2 select-none text-[10px]">{i + 1}</span>
                    <span className="text-text-secondary">{line}</span>
                  </div>
                ))}
              </div>
              <div className="flex-shrink-0 w-1/2">
                <div className="px-2 py-1 text-[10px] text-text-muted bg-bg-tertiary border-b border-border text-center">
                  After
                </div>
                {content.after.split('\n').map((line, i) => {
                  const beforeLine = i < content.before.split('\n').length ? content.before.split('\n')[i] : null;
                  const isAdded = beforeLine === null || line !== beforeLine;
                  const isChanged = isAdded;
                  return (
                    <div
                      key={i}
                      className={`px-2 py-0.5 border-b border-border/30 ${
                        isChanged ? 'bg-green-500/10' : ''
                      } hover:bg-bg-hover`}
                    >
                      <span className="text-text-muted mr-2 select-none text-[10px]">{i + 1}</span>
                      <span className={isChanged ? 'text-green-300' : 'text-text-secondary'}>
                        {line}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              {content.after.split('\n').map((line, i) => (
                <div key={i} className="px-2 py-0.5 bg-green-500/5 hover:bg-bg-hover">
                  <span className="text-text-muted mr-2 select-none text-[10px]">{i + 1}</span>
                  <span className="text-green-300">{line}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
