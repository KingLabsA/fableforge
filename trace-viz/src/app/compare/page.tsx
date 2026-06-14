'use client';

import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronsLeftRight, ArrowLeftRight } from 'lucide-react';
import { Trace } from '@/lib/trace_parser';
import { sampleTraces } from '@/data/sample_traces';
import ReasoningView from '@/components/ReasoningView';
import TraceTimeline from '@/components/TraceTimeline';
import TokenCounter from '@/components/TokenCounter';

export default function ComparePage() {
  const router = useRouter();
  const [leftTrace, setLeftTrace] = useState<Trace | null>(null);
  const [rightTrace, setRightTrace] = useState<Trace | null>(null);
  const [leftStep, setLeftStep] = useState(0);
  const [rightStep, setRightStep] = useState(0);
  const [syncScroll, setSyncScroll] = useState(true);

  const allTraces = [...sampleTraces];
  try {
    const stored = JSON.parse(localStorage.getItem('traceViz_traces') || '{}');
    Object.values(stored).forEach((t) => {
      if ((t as Trace).id && !allTraces.find((x) => x.id === (t as Trace).id)) {
        allTraces.push(t as Trace);
      }
    });
  } catch {}

  const handleSelect = useCallback(
    (side: 'left' | 'right', trace: Trace) => {
      if (side === 'left') {
        setLeftTrace(trace);
        setLeftStep(0);
      } else {
        setRightTrace(trace);
        setRightStep(0);
      }
    },
    []
  );

  const TracePanel = ({
    trace,
    stepIndex,
    onStepChange,
    label,
    traces,
    onSelect,
  }: {
    trace: Trace | null;
    stepIndex: number;
    onStepChange: (i: number) => void;
    label: string;
    traces: Trace[];
    onSelect: (t: Trace) => void;
  }) => (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="px-3 py-2 bg-bg-secondary border-b border-border flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
        {trace && (
          <span className="text-xs text-text-primary font-medium">{trace.title}</span>
        )}
        <select
          value={trace?.id ?? ''}
          onChange={(e) => {
            const found = traces.find((t) => t.id === e.target.value);
            if (found) onSelect(found);
          }}
          className="ml-auto text-xs bg-bg-tertiary border border-border rounded px-2 py-1 text-text-primary"
        >
          <option value="">Select trace...</option>
          {traces.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>

      {trace && (
        <>
          <TraceTimeline
            steps={trace.steps}
            currentIndex={stepIndex}
            onSeek={onStepChange}
          />
          <div className="flex-1 overflow-y-auto p-3">
            <ReasoningView step={trace.steps[stepIndex]} />
          </div>
          <div className="border-t border-border p-2">
            <TokenCounter trace={trace} currentStep={stepIndex} />
          </div>
        </>
      )}

      {!trace && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-text-muted">
            <ArrowLeftRight className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Select a trace to compare</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col h-screen">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-border bg-bg-secondary px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="p-1.5 hover:bg-bg-hover rounded transition-colors"
          >
            <ChevronsLeftRight className="w-4 h-4 text-text-secondary" />
          </button>
          <h1 className="text-sm font-semibold text-text-primary">Compare Traces</h1>
        </div>
        <button
          onClick={() => setSyncScroll(!syncScroll)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
            syncScroll
              ? 'bg-accent text-white'
              : 'text-text-secondary hover:bg-bg-hover border border-border'
          }`}
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          {syncScroll ? 'Sync ON' : 'Sync OFF'}
        </button>
      </header>

      {/* Side-by-side panels */}
      <div className="flex-1 flex overflow-hidden">
        <TracePanel
          trace={leftTrace}
          stepIndex={leftStep}
          onStepChange={(i) => {
            setLeftStep(i);
            if (syncScroll && rightTrace) {
              const ratio = leftTrace
                ? i / Math.max(leftTrace.steps.length - 1, 1)
                : 0;
              setRightStep(
                Math.round(ratio * Math.max(rightTrace!.steps.length - 1, 0))
              );
            }
          }}
          label="Trace A"
          traces={allTraces}
          onSelect={(t) => handleSelect('left', t)}
        />

        <div className="w-px bg-border flex-shrink-0" />

        <TracePanel
          trace={rightTrace}
          stepIndex={rightStep}
          onStepChange={(i) => {
            setRightStep(i);
            if (syncScroll && leftTrace) {
              const ratio = rightTrace
                ? i / Math.max(rightTrace.steps.length - 1, 1)
                : 0;
              setLeftStep(
                Math.round(ratio * Math.max(leftTrace!.steps.length - 1, 0))
              );
            }
          }}
          label="Trace B"
          traces={allTraces}
          onSelect={(t) => handleSelect('right', t)}
        />
      </div>
    </div>
  );
}
