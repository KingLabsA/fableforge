'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { TraceStep } from '@/lib/trace_parser';

const ROLE_COLORS: Record<string, string> = {
  user: '#22d3ee',
  assistant: '#a78bfa',
  tool: '#f59e0b',
  system: '#6366f1',
  error: '#ef4444',
};

const ROLE_LABELS: Record<string, string> = {
  user: 'U',
  assistant: 'A',
  tool: 'T',
  system: 'S',
  error: '!',
};

interface TraceTimelineProps {
  steps: TraceStep[];
  currentIndex: number;
  onSeek: (index: number) => void;
}

export default function TraceTimeline({ steps, currentIndex, onSeek }: TraceTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [tooltipIndex, setTooltipIndex] = useState<number | null>(null);

  const handleSeek = useCallback(
    (index: number) => {
      onSeek(index);
    },
    [onSeek]
  );

  const maxDuration = useMemo(() => {
    return Math.max(...steps.map((s) => s.duration_ms), 1);
  }, [steps]);

  const durationToPixels = useCallback(
    (ms: number) => {
      return Math.max(8, (ms / maxDuration) * 40 * zoom + 12);
    },
    [maxDuration, zoom]
  );

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-text-secondary font-mono">
          Step {currentIndex + 1} / {steps.length}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="px-2 py-0.5 text-xs bg-bg-tertiary rounded border border-border hover:bg-bg-hover"
          >
            −
          </button>
          <span className="text-xs text-text-muted px-1">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            className="px-2 py-0.5 text-xs bg-bg-tertiary rounded border border-border hover:bg-bg-hover"
          >
            +
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex items-center gap-0.5 overflow-x-auto pb-2 px-1"
        style={{ minHeight: '48px' }}
      >
        {steps.map((s, i) => {
          const isActive = i === currentIndex;
          const isPast = i < currentIndex;
          const color = ROLE_COLORS[s.role] || '#6366f1';
          const width = durationToPixels(s.duration_ms);
          const label = s.toolName
            ? s.toolName.substring(0, 3).toUpperCase()
            : ROLE_LABELS[s.role] || '?';

          return (
            <div key={s.id} className="relative flex flex-col items-center flex-shrink-0">
              <motion.div
                onClick={() => handleSeek(i)}
                onMouseEnter={() => setTooltipIndex(i)}
                onMouseLeave={() => setTooltipIndex(null)}
                className="cursor-pointer rounded-sm flex items-center justify-center font-mono text-[9px] font-bold transition-all"
                style={{
                  width: `${width}px`,
                  minWidth: '12px',
                  height: isActive ? '32px' : '24px',
                  backgroundColor: isActive
                    ? color
                    : isPast
                      ? `${color}66`
                      : `${color}33`,
                  border: isActive ? `2px solid ${color}` : '1px solid transparent',
                  color: isActive || isPast ? '#fff' : `${color}cc`,
                }}
                whileHover={{ scale: 1.1 }}
                transition={{ duration: 0.15 }}
              >
                {label}
              </motion.div>

              {tooltipIndex === i && (
                <div className="absolute z-50 bottom-full mb-1 left-1/2 -translate-x-1/2 bg-bg-tertiary border border-border rounded px-2 py-1 shadow-xl whitespace-nowrap">
                  <div className="text-[10px] text-text-secondary">
                    Step {i} · {s.role}
                    {s.toolName ? ` · ${s.toolName}` : ''}
                  </div>
                  {s.duration_ms > 0 && (
                    <div className="text-[10px] text-text-muted">{s.duration_ms}ms</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="relative h-1 bg-bg-tertiary rounded-full overflow-hidden">
        <motion.div
          className="absolute left-0 top-0 h-full bg-accent rounded-full"
          initial={false}
          animate={{ width: `${steps.length > 1 ? (currentIndex / (steps.length - 1)) * 100 : 100}%` }}
          transition={{ duration: 0.2 }}
        />
      </div>

      <div className="flex justify-between mt-1">
        {['user', 'assistant', 'tool', 'error'].map((role) => (
          <div key={role} className="flex items-center gap-1">
            <div
              className="w-2 h-2 rounded-sm"
              style={{ backgroundColor: ROLE_COLORS[role] }}
            />
            <span className="text-[10px] text-text-muted capitalize">{role}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
