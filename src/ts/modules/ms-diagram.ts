import * as d3 from 'd3';

// ── Types ─────────────────────────────────────────────────────────────

interface RawNode {
  id: string;
  label: string;
  type: 'person' | 'institution' | 'location' | 'program';
  metadata: {
    affiliations?: string[];
    dates?: Record<string, string>;
    status?: string;
    case_slug?: string;
    description?: string;
  };
}

interface RawEdge {
  source: string;
  target: string;
  edge_type: string;
  layer: 'tight' | 'medium' | 'corkboard';
  confidence: string;
  evidence_pointer: string;
  label: string;
}

interface DiagramData {
  nodes: RawNode[];
  edges: RawEdge[];
  layers: Record<string, { description: string; rendering_notes: string }>;
}

type SimNode = RawNode & d3.SimulationNodeDatum;
interface SimEdge extends d3.SimulationLinkDatum<SimNode> {
  edge_type: string;
  layer: 'tight' | 'medium' | 'corkboard';
  confidence: string;
  evidence_pointer: string;
  label: string;
}

// ── Constants ─────────────────────────────────────────────────────────

// Base path for case links. Set from the mount element's data-base attribute
// (the dossier the diagram belongs to), so case links resolve under the
// dossier's namespace rather than the site root. One diagram per page.
let base = '';

// Node colors live in tokens.css (--ms-node-*), which the key's swatches read
// too — one declaration per node type, so the circles and the key cannot
// disagree. They previously held literal oklch() values here and drifted from
// the key: `person` painted the upstream site's blue while the key showed
// accent-green. var() resolves in an SVG presentation attribute, so these can
// be handed straight to .attr('fill', …), and the theme toggle repaints the
// diagram for free.
const NODE_COLORS: Record<string, string> = {
  person:      'var(--ms-node-person)',
  institution: 'var(--ms-node-institution)',
  location:    'var(--ms-node-location)',
  program:     'var(--ms-node-program)',
};

const NODE_COLORS_BRIGHT: Record<string, string> = {
  person:      'var(--ms-node-person-bright)',
  institution: 'var(--ms-node-institution-bright)',
  location:    'var(--ms-node-location-bright)',
  program:     'var(--ms-node-program-bright)',
};

const NODE_RADIUS: Record<string, number> = {
  person: 18,
  institution: 12,
  location: 9,
  program: 9,
};

const CONFIDENCE_WIDTH: Record<string, number> = {
  confirmed:  2.5,
  reported:   2,
  alleged:    1.5,
  speculated: 1,
};

const LAYER_STYLE: Record<string, { dash: string; opacity: number }> = {
  tight:     { dash: '',        opacity: 0.8 },
  medium:    { dash: '8,5',     opacity: 0.5 },
  corkboard: { dash: '3,5',     opacity: 0.3 },
};

// ── Mount ─────────────────────────────────────────────────────────────

export function mount(el: HTMLElement): void {
  const canvas = el.querySelector<HTMLElement>('.ms-interactive__canvas');
  const tooltip = el.querySelector<HTMLElement>('.ms-tooltip');
  const controls = el.querySelector<HTMLElement>('.ms-controls');
  if (!canvas) return;

  base = el.dataset['base'] ?? '';

  const src = el.dataset['src'];
  if (!src) return;

  fetch(src)
    .then(r => r.json())
    .then((data: DiagramData) => render(canvas, tooltip, controls, data))
    .catch(err => {
      canvas.innerHTML = '<p style="padding:2rem;text-align:center">Failed to load diagram data.</p>';
      console.error('[ms-diagram]', err);
    });
}

// ── Render ────────────────────────────────────────────────────────────

function render(
  canvas: HTMLElement,
  tooltip: HTMLElement | null,
  controls: HTMLElement | null,
  data: DiagramData,
): void {
  const width = canvas.clientWidth || 900;
  const height = Math.max(600, Math.min(window.innerHeight - 200, 800));

  const activeLayers = new Set<string>(['tight']);

  // SVG
  const svg = d3.select(canvas)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  // Defs — filters for node glow + shadow + hover glow
  const defs = svg.append('defs');

  const glowFilter = defs.append('filter')
    .attr('id', 'node-glow')
    .attr('x', '-50%').attr('y', '-50%')
    .attr('width', '200%').attr('height', '200%');
  glowFilter.append('feGaussianBlur')
    .attr('in', 'SourceGraphic')
    .attr('stdDeviation', 3)
    .attr('result', 'blur');
  glowFilter.append('feComposite')
    .attr('in', 'SourceGraphic')
    .attr('in2', 'blur')
    .attr('operator', 'over');

  const shadowFilter = defs.append('filter')
    .attr('id', 'node-shadow')
    .attr('x', '-30%').attr('y', '-30%')
    .attr('width', '160%').attr('height', '160%');
  shadowFilter.append('feDropShadow')
    .attr('dx', 0).attr('dy', 1)
    .attr('stdDeviation', 2)
    .attr('flood-opacity', 0.15);

  // Hover glow filter — brighter, wider spread
  const hoverGlow = defs.append('filter')
    .attr('id', 'node-hover-glow')
    .attr('x', '-80%').attr('y', '-80%')
    .attr('width', '260%').attr('height', '260%');
  hoverGlow.append('feGaussianBlur')
    .attr('in', 'SourceGraphic')
    .attr('stdDeviation', 6)
    .attr('result', 'blur');
  hoverGlow.append('feComposite')
    .attr('in', 'SourceGraphic')
    .attr('in2', 'blur')
    .attr('operator', 'over');

  // Highlight glow for focus state
  const focusGlow = defs.append('filter')
    .attr('id', 'node-focus-glow')
    .attr('x', '-100%').attr('y', '-100%')
    .attr('width', '300%').attr('height', '300%');
  focusGlow.append('feGaussianBlur')
    .attr('in', 'SourceGraphic')
    .attr('stdDeviation', 8)
    .attr('result', 'blur');
  focusGlow.append('feComposite')
    .attr('in', 'SourceGraphic')
    .attr('in2', 'blur')
    .attr('operator', 'over');

  // Track focused (clicked) node for highlight mode
  let focusedNodeId: string | null = null;

  const g = svg.append('g');

  // Zoom
  const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.3, 4])
    .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
      g.attr('transform', event.transform.toString());
    });

  svg.call(zoomBehavior);

  // Prepare data
  const nodes: SimNode[] = data.nodes.map(n => ({ ...n }));
  const edges: SimEdge[] = data.edges.map(e => ({
    source: e.source,
    target: e.target,
    edge_type: e.edge_type,
    layer: e.layer,
    confidence: e.confidence,
    evidence_pointer: e.evidence_pointer,
    label: e.label,
  }));

  // Force simulation — tuned for better spacing
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink<SimNode, SimEdge>(edges)
      .id(d => d.id)
      .distance(d => {
        // Longer links for looser layers
        const base = 120;
        const e = d as unknown as SimEdge;
        if (e.layer === 'medium') return base * 1.3;
        if (e.layer === 'corkboard') return base * 1.6;
        return base;
      })
      .strength(0.4))
    .force('charge', d3.forceManyBody()
      .strength(d => {
        const n = d as SimNode;
        return n.type === 'person' ? -400 : -200;
      }))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide<SimNode>()
      .radius(d => (NODE_RADIUS[d.type] ?? 10) + 15)
      .strength(0.8))
    .force('x', d3.forceX(width / 2).strength(0.03))
    .force('y', d3.forceY(height / 2).strength(0.03));

  // Draw edges — curved paths with animated entry
  const edgeGroup = g.append('g').attr('class', 'edges');
  const edgeElements = edgeGroup.selectAll('path')
    .data(edges)
    .join('path')
    .attr('fill', 'none')
    .attr('stroke', d => {
      const layer = d.layer;
      if (layer === 'tight') return 'var(--color-text-muted)';
      if (layer === 'medium') return 'var(--color-text-muted)';
      return 'var(--color-text-muted)';
    })
    .attr('stroke-width', d => CONFIDENCE_WIDTH[d.confidence] ?? 1.5)
    .attr('stroke-dasharray', d => LAYER_STYLE[d.layer]?.dash ?? '')
    .attr('stroke-opacity', 0) // start invisible for entrance animation
    .style('display', d => activeLayers.has(d.layer) ? null : 'none')
    .style('cursor', 'help')
    .style('transition', 'stroke-opacity 0.3s ease, stroke 0.3s ease, stroke-width 0.3s ease')
    .on('mouseenter', function(event: MouseEvent, d: SimEdge) {
      // Edge hover: thicken and brighten
      d3.select(this)
        .attr('stroke-width', (CONFIDENCE_WIDTH[d.confidence] ?? 1.5) + 1.5)
        .attr('stroke', 'var(--color-accent)');
      showTooltip(tooltip, event, edgeTooltipHtml(d));
    })
    .on('mouseleave', function(_event: MouseEvent, d: SimEdge) {
      const isFocusedEdge = focusedNodeId && isConnectedEdge(d, focusedNodeId);
      d3.select(this)
        .attr('stroke-width', CONFIDENCE_WIDTH[d.confidence] ?? 1.5)
        .attr('stroke', isFocusedEdge ? 'var(--color-accent)' : 'var(--color-text-muted)');
      hideTooltip(tooltip);
    });

  // Entrance animation: fade in edges after a short delay
  edgeElements.transition()
    .delay((_d, i) => 400 + i * 30)
    .duration(600)
    .attr('stroke-opacity', d => LAYER_STYLE[d.layer]?.opacity ?? 1);

  // ── Helper: check if an edge connects to a given node ──
  function isConnectedEdge(d: SimEdge, nodeId: string): boolean {
    const srcId = typeof d.source === 'object' ? (d.source as SimNode).id : d.source;
    const tgtId = typeof d.target === 'object' ? (d.target as SimNode).id : d.target;
    return srcId === nodeId || tgtId === nodeId;
  }

  function getConnectedNodeIds(nodeId: string): Set<string> {
    const ids = new Set<string>([nodeId]);
    for (const e of edges) {
      const srcId = typeof e.source === 'object' ? (e.source as SimNode).id : String(e.source);
      const tgtId = typeof e.target === 'object' ? (e.target as SimNode).id : String(e.target);
      if (srcId === nodeId) ids.add(tgtId);
      if (tgtId === nodeId) ids.add(srcId);
    }
    return ids;
  }

  // ── Apply or clear focus highlight ──
  function applyFocus(nodeId: string | null): void {
    focusedNodeId = nodeId;

    if (!nodeId) {
      // Clear: restore all nodes and edges to normal
      nodeElements.select('.node-main')
        .transition().duration(300)
        .attr('fill', (d: SimNode) => NODE_COLORS[d.type] ?? 'var(--color-text-muted)')
        .attr('filter', (d: SimNode) => d.type === 'person' ? 'url(#node-shadow)' : null);
      nodeElements
        .transition().duration(300)
        .style('opacity', 1);
      edgeElements
        .transition().duration(300)
        .attr('stroke', 'var(--color-text-muted)')
        .attr('stroke-opacity', (d: SimEdge) => activeLayers.has(d.layer) ? (LAYER_STYLE[d.layer]?.opacity ?? 1) : 0);
      return;
    }

    const connected = getConnectedNodeIds(nodeId);

    // Dim unconnected nodes, brighten connected
    nodeElements
      .transition().duration(300)
      .style('opacity', (d: SimNode) => connected.has(d.id) ? 1 : 0.15);

    // Focused node gets glow
    nodeElements.filter((d: SimNode) => d.id === nodeId)
      .select('.node-main')
      .transition().duration(300)
      .attr('filter', 'url(#node-focus-glow)')
      .attr('fill', (d: SimNode) => NODE_COLORS_BRIGHT[d.type] ?? 'var(--color-accent)');

    // Highlight connected edges, dim others
    edgeElements
      .transition().duration(300)
      .attr('stroke', (d: SimEdge) => isConnectedEdge(d, nodeId) ? 'var(--color-accent)' : 'var(--color-text-muted)')
      .attr('stroke-opacity', (d: SimEdge) => {
        if (!activeLayers.has(d.layer)) return 0;
        return isConnectedEdge(d, nodeId) ? 1 : 0.06;
      });
  }

  // Draw nodes
  const nodeGroup = g.append('g').attr('class', 'nodes');
  const nodeElements = nodeGroup.selectAll('g')
    .data(nodes)
    .join('g')
    .style('cursor', 'pointer')
    .style('opacity', 0) // start invisible for entrance animation
    .on('click', (event: MouseEvent, d: SimNode) => {
      event.stopPropagation();
      if (d.metadata.case_slug) {
        // Person nodes: navigate to case page
        window.location.href = `${base}/cases/${d.metadata.case_slug}/`;
      } else {
        // Non-person nodes: toggle focus highlight
        applyFocus(focusedNodeId === d.id ? null : d.id);
      }
    })
    .on('mouseenter', function(event: MouseEvent, d: SimNode) {
      // Hover scale-up effect on the main (filled) circle
      d3.select(this).select<SVGCircleElement>('.node-main')
        .transition().duration(150)
        .attr('r', (NODE_RADIUS[d.type] ?? 10) * 1.2)
        .attr('fill', NODE_COLORS_BRIGHT[d.type] ?? 'var(--color-accent)')
        .attr('filter', 'url(#node-hover-glow)');
      // Scale outer glow ring too (person nodes only)
      d3.select(this).select<SVGCircleElement>('.node-ring')
        .transition().duration(150)
        .attr('r', (NODE_RADIUS[d.type] ?? 10) * 1.2 + 4)
        .attr('stroke-opacity', 0.5);
      showTooltip(tooltip, event, nodeTooltipHtml(d));
    })
    .on('mouseleave', function(_event: MouseEvent, d: SimNode) {
      const isFocused = focusedNodeId === d.id;
      d3.select(this).select<SVGCircleElement>('.node-main')
        .transition().duration(200)
        .attr('r', NODE_RADIUS[d.type] ?? 10)
        .attr('fill', isFocused ? (NODE_COLORS_BRIGHT[d.type] ?? 'var(--color-accent)') : (NODE_COLORS[d.type] ?? 'var(--color-text-muted)'))
        .attr('filter', isFocused ? 'url(#node-focus-glow)' : (d.type === 'person' ? 'url(#node-shadow)' : null));
      d3.select(this).select<SVGCircleElement>('.node-ring')
        .transition().duration(200)
        .attr('r', (NODE_RADIUS[d.type] ?? 10) + 4)
        .attr('stroke-opacity', 0.25);
      hideTooltip(tooltip);
    })
    .each(function() {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const el = this as SVGGElement;
      d3.select<SVGGElement, SimNode>(el).call(
        d3.drag<SVGGElement, SimNode>()
          .on('start', (event) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
          })
          .on('drag', (event) => {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
          })
          .on('end', (event) => {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
          }),
      );
    });

  // Outer glow ring for person nodes
  nodeElements.filter(d => d.type === 'person')
    .append('circle')
    .attr('class', 'node-ring')
    .attr('r', d => (NODE_RADIUS[d.type] ?? 10) + 4)
    .attr('fill', 'none')
    .attr('stroke', d => NODE_COLORS[d.type] ?? 'var(--color-text-muted)')
    .attr('stroke-width', 1)
    .attr('stroke-opacity', 0.25)
    .attr('pointer-events', 'none');

  // Node circles
  nodeElements.append('circle')
    .attr('class', 'node-main')
    .attr('r', d => NODE_RADIUS[d.type] ?? 10)
    .attr('fill', d => NODE_COLORS[d.type] ?? 'var(--color-text-muted)')
    .attr('stroke', 'var(--color-surface)')
    .attr('stroke-width', 2)
    .attr('filter', d => d.type === 'person' ? 'url(#node-shadow)' : null);

  // Inner icon/letter for person nodes
  nodeElements.filter(d => d.type === 'person')
    .append('text')
    .text(d => d.label.charAt(0).toUpperCase())
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('font-size', '11px')
    .attr('font-weight', '700')
    .attr('fill', 'white')
    .attr('pointer-events', 'none');

  // Node labels — smarter truncation
  nodeElements.append('text')
    .text(d => smartTruncate(d.label, d.type === 'person' ? 28 : 22))
    .attr('dy', d => (NODE_RADIUS[d.type] ?? 10) + 16)
    .attr('text-anchor', 'middle')
    .attr('font-size', d => d.type === 'person' ? '11px' : '10px')
    .attr('font-weight', d => d.type === 'person' ? '600' : '400')
    .attr('font-family', 'var(--font-body)')
    .attr('fill', 'var(--color-text)')
    .attr('pointer-events', 'none');

  // Status label for person nodes (e.g. "missing", "deceased")
  nodeElements.filter(d => d.type === 'person' && !!d.metadata.status)
    .append('text')
    .text(d => d.metadata.status ?? '')
    .attr('dy', d => (NODE_RADIUS[d.type] ?? 10) + 28)
    .attr('text-anchor', 'middle')
    .attr('font-size', '9px')
    .attr('font-family', 'var(--font-mono)')
    .attr('fill', d => {
      const s = d.metadata.status;
      if (s === 'missing') return 'oklch(55% 0.15 30)';
      if (s === 'deceased') return 'oklch(45% 0.1 0)';
      return 'var(--color-text-muted)';
    })
    .attr('pointer-events', 'none');

  // Entrance animation: stagger nodes fading in
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) {
    nodeElements.style('opacity', 1);
  } else {
    nodeElements.transition()
      .delay((_d, i) => 100 + i * 60)
      .duration(500)
      .ease(d3.easeBackOut.overshoot(1.2))
      .style('opacity', 1);
  }

  // Click on SVG background clears focus
  svg.on('click', () => {
    if (focusedNodeId) applyFocus(null);
  });

  // Tick update — curved edges
  simulation.on('tick', () => {
    edgeElements.attr('d', d => {
      const s = d.source as SimNode;
      const t = d.target as SimNode;
      const sx = s.x ?? 0;
      const sy = s.y ?? 0;
      const tx = t.x ?? 0;
      const ty = t.y ?? 0;
      // Slight curve: offset the midpoint perpendicular to the line
      const dx = tx - sx;
      const dy = ty - sy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const curvature = dist * 0.08;
      const mx = (sx + tx) / 2 - (dy / dist) * curvature;
      const my = (sy + ty) / 2 + (dx / dist) * curvature;
      return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`;
    });

    nodeElements.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
  });

  // Layer toggle controls — animated transitions
  if (controls) {
    controls.addEventListener('change', (e: Event) => {
      const input = e.target as HTMLInputElement;
      if (input.type !== 'checkbox') return;
      const layer = input.value;
      if (input.checked) {
        activeLayers.add(layer);
      } else {
        activeLayers.delete(layer);
      }
      // Fade edges in/out instead of instant toggle
      edgeElements
        .style('display', null) // ensure visible so transition works
        .transition().duration(400)
        .attr('stroke-opacity', d => {
          if (!activeLayers.has(d.layer)) return 0;
          if (focusedNodeId) {
            return isConnectedEdge(d, focusedNodeId) ? 1 : 0.06;
          }
          return LAYER_STYLE[d.layer]?.opacity ?? 1;
        })
        .on('end', function(d) {
          // After fading out, set display:none so they don't intercept pointer events
          if (!activeLayers.has(d.layer)) {
            d3.select(this).style('display', 'none');
          }
        });
      simulation.alpha(0.3).restart();
    });
  }

  // Keyboard
  canvas.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      hideTooltip(tooltip);
      if (focusedNodeId) applyFocus(null);
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────────────

function smartTruncate(label: string, maxLen: number): string {
  if (label.length <= maxLen) return label;
  // Prefer truncating at a word boundary
  const truncated = label.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.5) {
    return truncated.slice(0, lastSpace) + '...';
  }
  return truncated.trimEnd() + '...';
}

function showTooltip(tooltip: HTMLElement | null, event: MouseEvent, html: string): void {
  if (!tooltip) return;
  tooltip.innerHTML = html;
  tooltip.hidden = false;
  const rect = tooltip.parentElement!.getBoundingClientRect();
  const x = event.clientX - rect.left + 12;
  const y = event.clientY - rect.top + 12;
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function hideTooltip(tooltip: HTMLElement | null): void {
  if (!tooltip) return;
  tooltip.hidden = true;
}

function nodeTooltipHtml(d: SimNode): string {
  const meta = d.metadata;
  let html = `<strong>${d.label}</strong>`;
  html += `<span style="font-size:0.8em;opacity:0.7;margin-left:0.5em">${d.type}</span><br>`;
  if (meta.description) html += `<p style="margin:0.25rem 0">${meta.description}</p>`;
  if (meta.affiliations?.length) {
    html += `<p style="margin:0.25rem 0;font-size:0.85em">Affiliations: ${meta.affiliations.join(', ')}</p>`;
  }
  if (meta.status) html += `<p style="margin:0.25rem 0"><em>Status: ${meta.status}</em></p>`;
  if (meta.case_slug) {
    html += `<p style="margin:0.25rem 0;color:var(--color-accent)">Click to view case file</p>`;
  } else {
    html += `<p style="margin:0.25rem 0;color:var(--color-accent)">Click to highlight connections</p>`;
  }
  return html;
}

function edgeTooltipHtml(d: SimEdge): string {
  let html = `<strong>${d.label || 'Connection'}</strong>`;
  html += `<p style="margin:0.25rem 0">Type: ${d.edge_type} · Layer: ${d.layer} · Confidence: ${d.confidence}</p>`;
  if (d.evidence_pointer) html += `<p style="margin:0.25rem 0;font-size:0.85em;opacity:0.8">Source: ${d.evidence_pointer}</p>`;
  return html;
}
