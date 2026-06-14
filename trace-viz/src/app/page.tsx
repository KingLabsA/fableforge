'use client';

import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Upload,
  Play,
  Zap,
  GitBranch,
  BarChart3,
  Eye,
  Code2,
  Layers,
} from 'lucide-react';
import { parseTrace, Trace } from '@/lib/trace_parser';
import { sampleTraces } from '@/data/sample_traces';

const features = [
  {
    icon: Play,
    title: 'Step-by-Step Replay',
    description: 'Walk through agent traces like a video. Play, pause, step forward and backward through every tool call and reasoning step.',
  },
  {
    icon: GitBranch,
    title: 'Transition Graphs',
    description: 'Visualize Markov-style transition graphs showing how tools chain together. See probability-weighted edges between Bash, Edit, Read, and more.',
  },
  {
    icon: Eye,
    title: 'Reasoning Visibility',
    description: 'See the thinking behind every action. Collapsible reasoning sections reveal planning, execution, and verification phases.',
  },
  {
    icon: Code2,
    title: 'Diff Viewer',
    description: 'Side-by-side diffs for Edit operations. See exactly what changed in every file modification with syntax highlighting.',
  },
  {
    icon: BarChart3,
    title: 'Token Analytics',
    description: 'Per-step token usage charts, cumulative consumption lines, and cost estimation. Understand exactly where tokens are spent.',
  },
  {
    icon: Layers,
    title: 'Multi-Format Support',
    description: 'Parse traces from Glint, Armand0e, and V-Fable formats. Auto-detect format or explicitly specify. Drag and drop any JSONL trace.',
  },
];

export default function HomePage() {
  const router = useRouter();
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = useCallback(
    (file: File) => {
      setError(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const trace = parseTrace(text);
          const stored = JSON.parse(localStorage.getItem('traceViz_traces') || '{}');
          stored[trace.id] = trace;
          localStorage.setItem('traceViz_traces', JSON.stringify(stored));
          router.push(`/trace/${trace.id}`);
        } catch (err) {
          setError('Failed to parse trace file. Make sure it\'s valid JSONL.');
        }
      };
      reader.readAsText(file);
    },
    [router]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload]
  );

  const loadDemo = useCallback(
    (trace: Trace) => {
      const stored = JSON.parse(localStorage.getItem('traceViz_traces') || '{}');
      stored[trace.id] = trace;
      localStorage.setItem('traceViz_traces', JSON.stringify(stored));
      router.push(`/trace/${trace.id}`);
    },
    [router]
  );

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-cyan-400 via-accent to-purple-400 bg-clip-text text-transparent">
            TraceViz
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Replay agent traces like a video. Step through tool calls, see reasoning,
            and visualize transition patterns.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <div
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              dragOver
                ? 'border-accent bg-accent/5'
                : 'border-border hover:border-accent/50'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <Upload className="w-10 h-10 mx-auto mb-3 text-text-muted" />
            <p className="text-text-secondary mb-2">
              Drop a JSONL trace file here, or click to browse
            </p>
            <p className="text-xs text-text-muted mb-4">
              Supports Glint, Armand0e, and V-Fable formats
            </p>
            <label className="inline-block px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg cursor-pointer transition-colors text-sm font-medium">
              Choose File
              <input
                type="file"
                accept=".jsonl,.json,.txt"
                onChange={handleFileInput}
                className="hidden"
              />
            </label>
            {error && (
              <p className="mt-3 text-sm text-red-400">{error}</p>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-16"
        >
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4 text-center">
            Demo Traces
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sampleTraces.map((trace) => (
              <button
                key={trace.id}
                onClick={() => loadDemo(trace)}
                className="group p-4 bg-bg-secondary rounded-lg border border-border hover:border-accent/50 hover:bg-bg-hover transition-all text-left"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-accent" />
                  <span className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
                    {trace.title}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-text-muted">
                  <span>{trace.steps.length} steps</span>
                  <span>{trace.totalTokens.input + trace.totalTokens.output} tokens</span>
                  <span>{trace.toolsUsed.length} tools</span>
                </div>
                <div className="flex gap-1 mt-2">
                  {trace.toolsUsed.slice(0, 4).map((tool) => (
                    <span
                      key={tool}
                      className="text-[9px] px-1.5 py-0.5 bg-bg-tertiary rounded border border-border text-text-muted"
                    >
                      {tool}
                    </span>
                  ))}
                  {trace.toolsUsed.length > 4 && (
                    <span className="text-[9px] text-text-muted">
                      +{trace.toolsUsed.length - 4}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-6 text-center">
            Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature, i) => (
              <div
                key={i}
                className="p-4 bg-bg-secondary rounded-lg border border-border hover:border-accent/30 transition-colors"
              >
                <feature.icon className="w-5 h-5 text-accent mb-2" />
                <h3 className="text-sm font-semibold text-text-primary mb-1">
                  {feature.title}
                </h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-16 text-center"
        >
          <button
            onClick={() => router.push('/compare')}
            className="px-4 py-2 text-sm text-accent hover:text-accent-hover border border-accent/30 hover:border-accent rounded-lg transition-colors"
          >
            Compare Traces →
          </button>
        </motion.div>
      </div>
    </div>
  );
}
