'use client';

import React, { useMemo } from 'react';
import { Trace, TraceStep } from '@/lib/trace_parser';

interface TokenCounterProps {
  trace: Trace;
  currentStep: number;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

const COST_PER_TOKEN = {
  input: 0.000003,
  output: 0.000015,
};

export default function TokenCounter({ trace, currentStep }: TokenCounterProps) {
  const stats = useMemo(() => {
    const steps = trace.steps.slice(0, currentStep + 1);
    const cumulativeInput: number[] = [];
    const cumulativeOutput: number[] = [];
    let totalIn = 0;
    let totalOut = 0;

    for (const step of steps) {
      const inT = step.tokens?.input ?? 0;
      const outT = step.tokens?.output ?? 0;
      totalIn += inT;
      totalOut += outT;
      cumulativeInput.push(totalIn);
      cumulativeOutput.push(totalOut);
    }

    const maxTokens = Math.max(...cumulativeInput, ...cumulativeOutput, 1);

    const estimatedCost = totalIn * COST_PER_TOKEN.input + totalOut * COST_PER_TOKEN.output;

    return {
      totalInput: totalIn,
      totalOutput: totalOut,
      total: totalIn + totalOut,
      perStep: steps.map((s) => ({
        input: s.tokens?.input ?? 0,
        output: s.tokens?.output ?? 0,
      })),
      cumulativeInput,
      cumulativeOutput,
      maxTokens,
      estimatedCost,
    };
  }, [trace, currentStep]);

  const maxBarHeight = 60;
  const maxStepTokens = stats.perStep.length > 0
    ? Math.max(...stats.perStep.map((s) => s.input + s.output), 1)
    : 1;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-bg-secondary border-b border-border">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          Token Usage
        </span>
      </div>

      <div className="p-3 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-bg-tertiary rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-cyan-400 font-mono">
              {formatNumber(stats.totalInput)}
            </div>
            <div className="text-[10px] text-text-muted uppercase">Input</div>
          </div>
          <div className="bg-bg-tertiary rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-purple-400 font-mono">
              {formatNumber(stats.totalOutput)}
            </div>
            <div className="text-[10px] text-text-muted uppercase">Output</div>
          </div>
          <div className="bg-bg-tertiary rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-text-primary font-mono">
              {formatNumber(stats.total)}
            </div>
            <div className="text-[10px] text-text-muted uppercase">Total</div>
          </div>
        </div>

        <div>
          <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
            Per-Step Tokens
          </div>
          <div className="flex items-end gap-px h-16 overflow-x-auto">
            {stats.perStep.map((s, i) => {
              const inH = (s.input / maxStepTokens) * maxBarHeight;
              const outH = (s.output / maxStepTokens) * maxBarHeight;
              return (
                <div
                  key={i}
                  className="flex flex-col items-center flex-shrink-0"
                  style={{ width: `${Math.max(100 / stats.perStep.length, 3)}px` }}
                >
                  <div className="relative flex flex-col items-center justify-end" style={{ height: `${maxBarHeight}px` }}>
                    {s.input > 0 && (
                      <div
                        className="w-full bg-cyan-500/60 rounded-t-sm min-h-[1px]"
                        style={{ height: `${Math.max(inH, 1)}px` }}
                      />
                    )}
                    {s.output > 0 && (
                      <div
                        className="w-full bg-purple-500/60 rounded-b-sm min-h-[1px]"
                        style={{ height: `${Math.max(outH, 1)}px` }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-text-muted">0</span>
            <span className="text-[9px] text-text-muted">{stats.perStep.length} steps</span>
          </div>
        </div>

        {stats.cumulativeInput.length > 1 && (
          <div>
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
              Cumulative Usage
            </div>
            <div className="relative h-16 overflow-hidden rounded border border-border/50">
              <svg className="w-full h-full" viewBox={`0 0 ${stats.cumulativeInput.length * 4} 64`} preserveAspectRatio="none">
                <polyline
                  points={stats.cumulativeInput
                    .map((v, i) => `${i * 4}, ${64 - (v / stats.maxTokens) * 60}`)
                    .join(' ')}
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="1.5"
                />
                <polyline
                  points={stats.cumulativeOutput
                    .map((v, i) => `${i * 4}, ${64 - (v / stats.maxTokens) * 60}`)
                    .join(' ')}
                  fill="none"
                  stroke="#a78bfa"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
            <div className="flex gap-4 mt-1">
              <div className="flex items-center gap-1">
                <div className="w-2 h-0.5 bg-cyan-400" />
                <span className="text-[9px] text-text-muted">Input</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-0.5 bg-purple-400" />
                <span className="text-[9px] text-text-muted">Output</span>
              </div>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-border/50">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-text-muted">Est. Cost</span>
            <span className="text-xs font-mono text-text-primary">
              ${stats.estimatedCost.toFixed(4)}
            </span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-[10px] text-text-muted">Tools Used</span>
            <div className="flex gap-1">
              {trace.toolsUsed.map((tool) => (
                <span
                  key={tool}
                  className="text-[10px] px-1.5 py-0.5 bg-bg-tertiary rounded border border-border text-text-secondary"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
