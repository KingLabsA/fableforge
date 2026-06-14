'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  ChevronLeft,
  RotateCcw,
  Gauge,
  GitBranch,
  BarChart3,
  MessageSquare,
  Home,
  Columns,
} from 'lucide-react';
import { Trace, TraceStep, computeTransitions } from '@/lib/trace_parser';
import { PlaybackController, PlaybackSpeed } from '@/lib/playback';
import { sampleTraces } from '@/data/sample_traces';
import TraceTimeline from '@/components/TraceTimeline';
import ReasoningView from '@/components/ReasoningView';
import TransitionGraph from '@/components/TransitionGraph';
import DiffViewer from '@/components/DiffViewer';
import TokenCounter from '@/components/TokenCounter';

export default function TraceViewerPage() {
  const params = useParams();
  const router = useRouter();
  const traceId = params.id as string;

  const [trace, setTrace] = useState<Trace | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [showTransitionGraph, setShowTransitionGraph] = useState(false);
  const [showTokenCounter, setShowTokenCounter] = useState(false);
  const [sidePanelTab, setSidePanelTab] = useState<'info' | 'tools' | 'transitions'>('info');
  const playbackRef = useRef<PlaybackController | null>(null);

  useEffect(() => {
    let found: Trace | null = null;
    const demo = sampleTraces.find((t) => t.id === traceId);
    if (demo) {
      found = demo;
    } else {
      try {
        const stored = JSON.parse(localStorage.getItem('traceViz_traces') || '{}');
        found = stored[traceId] ?? null;
      } catch {}
    }
    if (found) {
      setTrace(found);
    }
  }, [traceId]);

  useEffect(() => {
    if (!trace) return;
    const controller = new PlaybackController(trace.steps.length);
    controller.subscribe((c) => {
      setCurrentStep(c.currentIndex);
      setIsPlaying(c.state === 'playing');
    });
    playbackRef.current = controller;
    return () => controller.destroy();
  }, [trace]);

  useEffect(() => {
    if (playbackRef.current) {
      playbackRef.current.setSpeed(speed);
    }
  }, [speed]);

  if (!trace) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-text-muted">Loading trace...</div>
      </div>
    );
  }

  const step = trace.steps[currentStep];
  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleTimeString();
  };

  const transitions = computeTransitions(trace);

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col h-screen">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-border bg-bg-secondary px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="p-1.5 hover:bg-bg-hover rounded transition-colors"
          >
            <Home className="w-4 h-4 text-text-secondary" />
          </button>
          <button
            onClick={() => router.push('/compare')}
            className="p-1.5 hover:bg-bg-hover rounded transition-colors"
          >
            <Columns className="w-4 h-4 text-text-secondary" />
          </button>
          <div className="w-px h-5 bg-border" />
          <h1 className="text-sm font-semibold text-text-primary">{trace.title}</h1>
          <span className="text-[10px] text-text-muted px-1.5 py-0.5 bg-bg-tertiary rounded border border-border">
            {trace.source}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTransitionGraph(!showTransitionGraph)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
              showTransitionGraph
                ? 'bg-accent text-white'
                : 'text-text-secondary hover:bg-bg-hover border border-border'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            Graph
          </button>
          <button
            onClick={() => setShowTokenCounter(!showTokenCounter)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
              showTokenCounter
                ? 'bg-accent text-white'
                : 'text-text-secondary hover:bg-bg-hover border border-border'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Tokens
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar: Step list */}
        <aside className="w-56 flex-shrink-0 border-r border-border bg-bg-secondary overflow-y-auto">
          <div className="p-2">
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2 px-1">
              Steps ({trace.steps.length})
            </div>
            <div className="space-y-0.5">
              {trace.steps.map((s, i) => {
                const isActive = i === currentStep;
                const roleColor: Record<string, string> = {
                  user: 'bg-step-user',
                  assistant: 'bg-step-assistant',
                  tool: 'bg-step-tool',
                  error: 'bg-step-error',
                  system: 'bg-step-system',
                };
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setCurrentStep(i);
                      playbackRef.current?.seekTo(i);
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition-all flex items-center gap-2 ${
                      isActive
                        ? 'bg-accent/10 text-accent border border-accent/30'
                        : 'hover:bg-bg-hover text-text-secondary border border-transparent'
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-sm flex-shrink-0 ${roleColor[s.role]}`} />
                    <div className="truncate flex-1">
                      {s.toolName
                        ? s.toolName
                        : s.content.substring(0, 30)}
                    </div>
                    {s.duration_ms > 0 && (
                      <span className="text-[9px] text-text-muted flex-shrink-0">
                        {formatTime(s.duration_ms)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Center: Step detail */}
        <main className="flex-1 overflow-y-auto p-4">
          {/* Timeline */}
          <div className="mb-4">
            <TraceTimeline
              steps={trace.steps}
              currentIndex={currentStep}
              onSeek={(i) => {
                setCurrentStep(i);
                playbackRef.current?.seekTo(i);
              }}
            />
          </div>

          {/* Step content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              <ReasoningView step={step} />

              {/* Show diff for Edit/Write operations */}
              {(step.toolName === 'Edit' || step.toolName === 'Write') && step.toolInput && (
                <div className="mt-4">
                  <DiffViewer step={step} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Transition graph (expandable) */}
          <AnimatePresence>
            {showTransitionGraph && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-4 overflow-hidden"
              >
                <TransitionGraph trace={trace} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Right sidebar: Metadata */}
        <aside className="w-64 flex-shrink-0 border-l border-border bg-bg-secondary overflow-y-auto">
          <div className="p-3 space-y-4">
            {/* Tab switcher */}
            <div className="flex bg-bg-tertiary rounded-lg p-0.5">
              {(['info', 'tools', 'transitions'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSidePanelTab(tab)}
                  className={`flex-1 px-2 py-1 text-[10px] uppercase tracking-wider rounded transition-colors ${
                    sidePanelTab === tab
                      ? 'bg-accent text-white'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {sidePanelTab === 'info' && (
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
                    Current Step
                  </div>
                  <div className="bg-bg-tertiary rounded-lg p-2 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-muted">Role</span>
                      <span className="text-text-primary capitalize">{step.role}</span>
                    </div>
                    {step.toolName && (
                      <div className="flex justify-between text-xs">
                        <span className="text-text-muted">Tool</span>
                        <span className="text-step-tool">{step.toolName}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-text-muted">Duration</span>
                      <span className="text-text-primary font-mono">
                        {formatTime(step.duration_ms)}
                      </span>
                    </div>
                    {step.tokens && (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-text-muted">Input tokens</span>
                          <span className="text-cyan-400 font-mono">
                            {step.tokens.input.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-text-muted">Output tokens</span>
                          <span className="text-purple-400 font-mono">
                            {step.tokens.output.toLocaleString()}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-text-muted">Time</span>
                      <span className="text-text-primary font-mono">
                        {formatTimestamp(step.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
                    Trace Overview
                  </div>
                  <div className="bg-bg-tertiary rounded-lg p-2 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-muted">Total steps</span>
                      <span className="text-text-primary font-mono">{trace.steps.length}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-muted">Total tokens</span>
                      <span className="text-text-primary font-mono">
                        {(trace.totalTokens.input + trace.totalTokens.output).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-muted">Tools used</span>
                      <span className="text-text-primary font-mono">{trace.toolsUsed.length}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-muted">Source</span>
                      <span className="text-text-primary">{trace.source}</span>
                    </div>
                  </div>
                </div>

                {step.tokens && (
                  <TokenCounter trace={trace} currentStep={currentStep} />
                )}
              </div>
            )}

            {sidePanelTab === 'tools' && (
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
                  Tools Used
                </div>
                {trace.toolsUsed.map((tool) => {
                  const count = trace.steps.filter(
                    (s) => s.toolName === tool
                  ).length;
                  const totalDuration = trace.steps
                    .filter((s) => s.toolName === tool)
                    .reduce((sum, s) => sum + s.duration_ms, 0);
                  return (
                    <div
                      key={tool}
                      className="bg-bg-tertiary rounded-lg p-2 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-sm"
                          style={{ backgroundColor: `var(--color-step-tool)` }}
                        />
                        <span className="text-xs text-text-primary">{tool}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-text-muted">
                          {count}×
                        </span>
                        <span className="text-[10px] text-text-muted font-mono">
                          {formatTime(totalDuration)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {sidePanelTab === 'transitions' && (
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
                  Transitions
                </div>
                {Object.entries(transitions).map(([from, targets]) => (
                  <div key={from} className="mb-2">
                    <div className="text-[10px] font-semibold text-text-primary mb-1">{from}</div>
                    {Object.entries(targets).map(([to, count]) => (
                      <div key={to} className="flex items-center gap-2 pl-2">
                        <span className="text-[10px] text-text-muted">→</span>
                        <span className="text-[10px] text-text-secondary">{to}</span>
                        <span className="text-[10px] text-text-muted ml-auto">
                          {count}×
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Playback controls */}
      <footer className="flex-shrink-0 border-t border-border bg-bg-secondary px-4 py-2 flex items-center justify-center gap-3">
        <button
          onClick={() => playbackRef.current?.seekTo(0)}
          className="p-1.5 hover:bg-bg-hover rounded transition-colors"
          title="Reset"
        >
          <RotateCcw className="w-4 h-4 text-text-secondary" />
        </button>
        <button
          onClick={() => playbackRef.current?.stepBack()}
          className="p-1.5 hover:bg-bg-hover rounded transition-colors"
          title="Step back"
        >
          <SkipBack className="w-4 h-4 text-text-secondary" />
        </button>
        <button
          onClick={() => {
            if (isPlaying) {
              playbackRef.current?.pause();
            } else {
              playbackRef.current?.play();
            }
          }}
          className="p-2 bg-accent hover:bg-accent-hover rounded-full transition-colors"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 text-white" />
          ) : (
            <Play className="w-5 h-5 text-white" />
          )}
        </button>
        <button
          onClick={() => playbackRef.current?.stepForward()}
          className="p-1.5 hover:bg-bg-hover rounded transition-colors"
          title="Step forward"
        >
          <SkipForward className="w-4 h-4 text-text-secondary" />
        </button>
        <div className="w-px h-5 bg-border mx-1" />
        <button
          onClick={() => {
            const speeds: PlaybackSpeed[] = [0.5, 1, 2, 4];
            const idx = speeds.indexOf(speed);
            setSpeed(speeds[(idx + 1) % speeds.length]);
          }}
          className="flex items-center gap-1 px-2.5 py-1 hover:bg-bg-hover rounded transition-colors text-xs text-text-secondary border border-border"
          title="Playback speed"
        >
          <Gauge className="w-3.5 h-3.5" />
          {speed}×
        </button>
        <div className="text-[10px] text-text-muted font-mono">
          {currentStep + 1} / {trace.steps.length}
        </div>
      </footer>
    </div>
  );
}
