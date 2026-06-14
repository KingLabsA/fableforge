'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Trace, computeTransitions } from '@/lib/trace_parser';

interface TransitionGraphProps {
  trace: Trace;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  count: number;
  color: string;
  hidden: boolean;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  count: number;
  probability: number;
}

const NODE_COLORS: Record<string, string> = {
  user: '#22d3ee',
  assistant: '#a78bfa',
  Read: '#34d399',
  Edit: '#f59e0b',
  Write: '#f472b6',
  Bash: '#fb923c',
  Grep: '#60a5fa',
  default: '#6366f1',
  error: '#ef4444',
};

function getNodeColor(id: string): string {
  return NODE_COLORS[id] || NODE_COLORS.default;
}

export default function TransitionGraph({ trace }: TransitionGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hiddenNodes, setHiddenNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const width = containerRect.width || 600;
    const height = 400;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    const transitions = computeTransitions(trace);
    const nodesMap = new Map<string, number>();

    for (const [from, targets] of Object.entries(transitions)) {
      if (!nodesMap.has(from)) nodesMap.set(from, 0);
      nodesMap.set(from, (nodesMap.get(from) ?? 0) + 1);
      for (const [to, count] of Object.entries(targets)) {
        if (!nodesMap.has(to)) nodesMap.set(to, 0);
        nodesMap.set(to, (nodesMap.get(to) ?? 0) + (count as number));
      }
    }

    const nodes: GraphNode[] = Array.from(nodesMap.entries()).map(([id, count]) => ({
      id,
      label: id,
      count,
      color: getNodeColor(id),
      hidden: hiddenNodes.has(id),
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height / 2 + (Math.random() - 0.5) * 200,
    }));

    const links: GraphLink[] = [];
    for (const [from, targets] of Object.entries(transitions)) {
      const totalFrom = Object.values(targets).reduce((a, b) => a + b, 0);
      for (const [to, count] of Object.entries(targets)) {
        if (hiddenNodes.has(from) || hiddenNodes.has(to)) continue;
        links.push({
          source: nodes.find((n) => n.id === from)!,
          target: nodes.find((n) => n.id === to)!,
          count: count as number,
          probability: (count as number) / totalFrom,
        });
      }
    }

    const visibleNodes = nodes.filter((n) => !n.hidden);

    const simulation = d3
      .forceSimulation<GraphNode>(visibleNodes)
      .force(
        'link',
        d3.forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance(120)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(40));

    const linkGroup = svg.append('g').attr('class', 'links');
    const nodeGroup = svg.append('g').attr('class', 'nodes');

    const linkElements = linkGroup
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#3a3a4a')
      .attr('stroke-width', (d) => Math.max(1, d.count * 1.5))
      .attr('stroke-opacity', (d) => Math.min(0.8, d.probability + 0.2));

    const linkLabels = linkGroup
      .selectAll('text')
      .data(links)
      .join('text')
      .attr('fill', '#9898b0')
      .attr('font-size', '9px')
      .attr('text-anchor', 'middle')
      .text((d) => `${(d.probability * 100).toFixed(0)}%`);

    const nodeElements = nodeGroup
      .selectAll('g')
      .data(visibleNodes)
      .join('g')
      .style('cursor', 'grab');

    const dragging = d3.drag<SVGGElement, GraphNode>()
      .on('start', function(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = event.x;
        d.fy = event.y;
        d3.select(this).style('cursor', 'grabbing');
      })
      .on('drag', function(event, d) {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', function(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
        d3.select(this).style('cursor', 'grab');
      });

    nodeElements.call(dragging as any);

    nodeElements
      .append('circle')
      .attr('r', (d) => Math.min(30, Math.max(15, d.count * 3)))
      .attr('fill', (d) => d.color)
      .attr('fill-opacity', 0.2)
      .attr('stroke', (d) => d.color)
      .attr('stroke-width', 2);

    nodeElements
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', '#e4e4ef')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .text((d) => d.label);

    nodeElements
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-1.8em')
      .attr('fill', '#9898b0')
      .attr('font-size', '9px')
      .text((d) => `x${d.count}`);

    nodeElements.on('mouseenter', (event, d) => {
      linkElements.attr('stroke-opacity', (l) => {
        const s = l.source as GraphNode;
        const t = l.target as GraphNode;
        return s.id === d.id || t.id === d.id ? 0.9 : 0.1;
      });
      linkLabels.attr('opacity', (l) => {
        const s = l.source as GraphNode;
        const t = l.target as GraphNode;
        return s.id === d.id || t.id === d.id ? 1 : 0.1;
      });
    });

    nodeElements.on('mouseleave', () => {
      linkElements.attr('stroke-opacity', (d) => Math.min(0.8, d.probability + 0.2));
      linkLabels.attr('opacity', 1);
    });

    simulation.on('tick', () => {
      linkElements
        .attr('x1', (d) => (d.source as GraphNode).x ?? 0)
        .attr('y1', (d) => (d.source as GraphNode).y ?? 0)
        .attr('x2', (d) => (d.target as GraphNode).x ?? 0)
        .attr('y2', (d) => (d.target as GraphNode).y ?? 0);

      linkLabels
        .attr('x', (d) => ((d.source as GraphNode).x! + (d.target as GraphNode).x!) / 2)
        .attr('y', (d) => ((d.source as GraphNode).y! + (d.target as GraphNode).y!) / 2 - 8);

      nodeElements.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [trace, hiddenNodes]);

  const toggleNode = (nodeId: string) => {
    setHiddenNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const allTools = Array.from(new Set(trace.steps.map((s) => s.toolName ?? s.role)));

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-bg-secondary border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          Markov Transition Graph
        </span>
        <div className="flex gap-1 flex-wrap">
          {allTools.map((tool) => (
            <button
              key={tool}
              onClick={() => toggleNode(tool)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border transition-colors ${
                hiddenNodes.has(tool)
                  ? 'opacity-30 line-through bg-bg-tertiary border-border'
                  : 'bg-bg-tertiary border-border hover:bg-bg-hover'
              }`}
            >
              <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: getNodeColor(tool) }} />
              {tool}
            </button>
          ))}
        </div>
      </div>
      <div ref={containerRef} className="w-full bg-bg-primary">
        <svg ref={svgRef} className="w-full" />
      </div>
    </div>
  );
}
