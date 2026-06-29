import * as d3 from 'd3';

// ── Types ─────────────────────────────────────────────────────────────

interface TimelineEvent {
  id: string;
  date: string;
  date_precision?: string;
  type: string;
  subject?: string | null;
  description: string;
  source_pointer: string;
  confidence: string;
}

interface TimelineData {
  events: TimelineEvent[];
  context_events: TimelineEvent[];
}

type RowKind = 'case' | 'context';

interface PlottedEvent extends TimelineEvent {
  row: RowKind;
  parsedDate: Date;
}

// ── Constants ─────────────────────────────────────────────────────────

// Site is rooted at "/" — case links resolve from the root.
const BASE = '';

const EVENT_COLORS: Record<string, string> = {
  disappearance:           'oklch(55% 0.15 30)',
  death:                   'oklch(40% 0.12 0)',
  body_found:              'oklch(45% 0.1 300)',
  suspect_arrested:        'oklch(55% 0.12 145)',
  investigation_milestone: 'oklch(55% 0.1 248)',
  institutional_statement: 'oklch(55% 0.08 200)',
  political_event:         'oklch(55% 0.12 60)',
  media_event:             'oklch(60% 0.08 280)',
  other:                   'oklch(50% 0.04 260)',
};

const CASE_NAMES: Record<string, string> = {
  eskridge: 'Eskridge', hicks: 'Hicks', maiwald: 'Maiwald',
  chavez: 'Chavez', casias: 'Casias', reza: 'Reza',
  garcia: 'Garcia', thomas: 'Thomas', loureiro: 'Loureiro',
  mccasland: 'McCasland', grillmair: 'Grillmair',
};

// Desktop layout
const CARD_HEIGHT = 72;
const CARD_GAP = 12;
const CARD_WIDTH = 320;
const AXIS_X = 400;
const YEAR_LABEL_HEIGHT = 40;
const PAD_TOP = 60;
const PAD_BOTTOM = 40;
const TOTAL_WIDTH = 860;
const DOT_RADIUS = 6;

// Mobile layout
const MOBILE_BREAKPOINT = 600;
const MOBILE_AXIS_X = 24;
const MOBILE_CARD_GAP = 10;
const MOBILE_CONNECTOR = 16;
const MOBILE_DOT_RADIUS = 5;
const MOBILE_CARD_HEIGHT = 80;

// ── Mount ─────────────────────────────────────────────────────────────

export function mount(el: HTMLElement): void {
  const canvas = el.querySelector<HTMLElement>('.ms-interactive__canvas');
  const tooltip = el.querySelector<HTMLElement>('.ms-tooltip');
  if (!canvas) return;

  const src = el.dataset['src'];
  if (!src) return;

  fetch(src)
    .then(r => r.json())
    .then((data: TimelineData) => render(canvas, tooltip, data))
    .catch(err => {
      canvas.innerHTML = '<p style="padding:2rem;text-align:center">Failed to load timeline data.</p>';
      console.error('[ms-timeline]', err);
    });
}

// ── Render ────────────────────────────────────────────────────────────

function render(
  canvas: HTMLElement,
  tooltip: HTMLElement | null,
  data: TimelineData,
): void {
  const allEvents: PlottedEvent[] = [
    ...data.events.map(e => ({ ...e, row: 'case' as RowKind, parsedDate: new Date(e.date) })),
    ...data.context_events.map(e => ({ ...e, row: 'context' as RowKind, parsedDate: new Date(e.date) })),
  ].sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

  const containerWidth = canvas.clientWidth || TOTAL_WIDTH;
  const mobile = containerWidth < MOBILE_BREAKPOINT;

  if (mobile) {
    renderMobile(canvas, tooltip, allEvents, containerWidth);
  } else {
    renderDesktop(canvas, tooltip, allEvents);
  }
}

// ── Desktop render (original dual-column layout) ─────────────────────

function renderDesktop(
  canvas: HTMLElement,
  tooltip: HTMLElement | null,
  allEvents: PlottedEvent[],
): void {
  interface PositionedEvent extends PlottedEvent { y: number }
  const positioned: PositionedEvent[] = [];
  let cursorY = PAD_TOP;
  let lastYear = -1;

  for (const event of allEvents) {
    const year = event.parsedDate.getFullYear();
    if (year !== lastYear) {
      cursorY += YEAR_LABEL_HEIGHT;
      lastYear = year;
    }
    positioned.push({ ...event, y: cursorY });
    cursorY += CARD_HEIGHT + CARD_GAP;
  }

  const totalHeight = cursorY + PAD_BOTTOM;
  const width = TOTAL_WIDTH;

  canvas.style.overflowY = 'auto';
  canvas.style.overflowX = 'hidden';
  canvas.style.minBlockSize = '32rem';
  canvas.style.maxBlockSize = '80vh';

  const svg = d3.select(canvas)
    .append('svg')
    .attr('width', width)
    .attr('height', totalHeight)
    .attr('viewBox', `0 0 ${width} ${totalHeight}`)
    .attr('preserveAspectRatio', 'xMidYMin meet')
    .style('display', 'block')
    .style('margin', '0 auto');

  // Defs — drop shadow for cards
  const defs = svg.append('defs');
  const filter = defs.append('filter')
    .attr('id', 'tl-shadow')
    .attr('x', '-10%').attr('y', '-10%')
    .attr('width', '120%').attr('height', '130%');
  filter.append('feDropShadow')
    .attr('dx', 0).attr('dy', 1)
    .attr('stdDeviation', 2)
    .attr('flood-opacity', 0.08);

  // Central axis line
  svg.append('line')
    .attr('x1', AXIS_X).attr('x2', AXIS_X)
    .attr('y1', PAD_TOP).attr('y2', totalHeight - PAD_BOTTOM)
    .attr('stroke', 'var(--color-border)')
    .attr('stroke-width', 2);

  // Year markers
  let markerY = PAD_TOP;
  let prevYear = -1;
  for (const event of allEvents) {
    const year = event.parsedDate.getFullYear();
    if (year !== prevYear) {
      markerY += YEAR_LABEL_HEIGHT;
      const pillW = 56;
      const pillH = 24;
      svg.append('rect')
        .attr('x', AXIS_X - pillW / 2)
        .attr('y', markerY - CARD_HEIGHT - CARD_GAP - YEAR_LABEL_HEIGHT + 8)
        .attr('width', pillW)
        .attr('height', pillH)
        .attr('rx', pillH / 2)
        .attr('fill', 'var(--color-surface)')
        .attr('stroke', 'var(--color-border)')
        .attr('stroke-width', 1);

      svg.append('text')
        .attr('x', AXIS_X)
        .attr('y', markerY - CARD_HEIGHT - CARD_GAP - YEAR_LABEL_HEIGHT + 8 + pillH / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-size', '12px')
        .attr('font-weight', '700')
        .attr('fill', 'var(--color-text)')
        .attr('font-family', 'var(--font-mono)')
        .text(String(year));

      prevYear = year;
    }
    markerY += CARD_HEIGHT + CARD_GAP;
  }

  // Event cards
  for (const event of positioned) {
    const isCase = event.row === 'case';
    const cardX = isCase ? AXIS_X - CARD_WIDTH - 30 : AXIS_X + 30;
    const color = EVENT_COLORS[event.type] ?? EVENT_COLORS['other']!;
    const clickable = !!event.subject;

    const group = svg.append('g')
      .attr('class', 'tl-event')
      .style('cursor', clickable ? 'pointer' : 'default');

    if (clickable) {
      group.on('click', () => {
        window.location.href = `${BASE}/cases/${event.subject}/`;
      });
    }

    // Connector line from axis to card
    const connectorEndX = isCase ? AXIS_X - 26 : AXIS_X + 26;
    group.append('line')
      .attr('x1', AXIS_X)
      .attr('x2', connectorEndX)
      .attr('y1', event.y + CARD_HEIGHT / 2)
      .attr('y2', event.y + CARD_HEIGHT / 2)
      .attr('stroke', color)
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.5);

    // Dot on the axis
    group.append('circle')
      .attr('cx', AXIS_X)
      .attr('cy', event.y + CARD_HEIGHT / 2)
      .attr('r', DOT_RADIUS)
      .attr('fill', color)
      .attr('stroke', 'var(--color-surface)')
      .attr('stroke-width', 2);

    // Card background
    group.append('rect')
      .attr('x', cardX)
      .attr('y', event.y)
      .attr('width', CARD_WIDTH)
      .attr('height', CARD_HEIGHT)
      .attr('rx', 6)
      .attr('fill', 'var(--color-surface)')
      .attr('stroke', 'var(--color-border)')
      .attr('stroke-width', 1)
      .attr('filter', 'url(#tl-shadow)');

    // Color accent bar on the card edge
    const barX = isCase ? cardX + CARD_WIDTH - 4 : cardX;
    group.append('rect')
      .attr('x', barX)
      .attr('y', event.y)
      .attr('width', 4)
      .attr('height', CARD_HEIGHT)
      .attr('rx', isCase ? '0 2 2 0' : '2 0 0 2')
      .attr('fill', color);

    // Date label
    const dateStr = formatDate(event.parsedDate, event.date_precision);
    const textPadX = isCase ? cardX + 10 : cardX + 14;

    group.append('text')
      .attr('x', textPadX)
      .attr('y', event.y + 18)
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-mono)')
      .attr('fill', 'var(--color-text-muted)')
      .attr('pointer-events', 'none')
      .text(dateStr);

    // Type + subject badge
    const badgeText = [
      event.type.replace(/_/g, ' '),
      event.subject ? CASE_NAMES[event.subject] ?? event.subject : null,
    ].filter(Boolean).join(' · ');

    group.append('text')
      .attr('x', textPadX)
      .attr('y', event.y + 32)
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('fill', color)
      .attr('pointer-events', 'none')
      .text(badgeText);

    // Description (truncated)
    const maxDescChars = 55;
    const desc = event.description.length > maxDescChars
      ? event.description.slice(0, maxDescChars - 1).trimEnd() + '...'
      : event.description;

    group.append('text')
      .attr('x', textPadX)
      .attr('y', event.y + 48)
      .attr('font-size', '11px')
      .attr('fill', 'var(--color-text)')
      .attr('pointer-events', 'none')
      .text(desc);

    // Confidence tag
    const confOpacity = event.confidence === 'speculated' ? 0.5
      : event.confidence === 'alleged' ? 0.7 : 1;
    group.append('text')
      .attr('x', textPadX)
      .attr('y', event.y + 63)
      .attr('font-size', '9px')
      .attr('fill', 'var(--color-text-muted)')
      .attr('opacity', confOpacity)
      .attr('pointer-events', 'none')
      .text(event.confidence);

    // Tooltip on hover
    group
      .on('mouseenter', (mouseEvent: MouseEvent) => showTooltip(tooltip, mouseEvent, tooltipHtml(event)))
      .on('mouseleave', () => hideTooltip(tooltip));
  }

  // Keyboard: Escape dismisses tooltip
  canvas.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') hideTooltip(tooltip);
  });
}

// ── Mobile render (single-column layout) ─────────────────────────────

function renderMobile(
  canvas: HTMLElement,
  tooltip: HTMLElement | null,
  allEvents: PlottedEvent[],
  containerWidth: number,
): void {
  const axisX = MOBILE_AXIS_X;
  const cardX = axisX + MOBILE_CONNECTOR + 4;
  const cardWidth = containerWidth - cardX - 12;
  const cardHeight = MOBILE_CARD_HEIGHT;

  interface PositionedEvent extends PlottedEvent { y: number }
  const positioned: PositionedEvent[] = [];
  let cursorY = PAD_TOP;
  let lastYear = -1;

  for (const event of allEvents) {
    const year = event.parsedDate.getFullYear();
    if (year !== lastYear) {
      cursorY += YEAR_LABEL_HEIGHT;
      lastYear = year;
    }
    positioned.push({ ...event, y: cursorY });
    cursorY += cardHeight + MOBILE_CARD_GAP;
  }

  const totalHeight = cursorY + PAD_BOTTOM;

  canvas.style.overflowY = 'auto';
  canvas.style.overflowX = 'hidden';
  canvas.style.minBlockSize = '32rem';
  canvas.style.maxBlockSize = '85vh';
  canvas.style.setProperty('-webkit-overflow-scrolling', 'touch');

  const svg = d3.select(canvas)
    .append('svg')
    .attr('width', containerWidth)
    .attr('height', totalHeight)
    .attr('viewBox', `0 0 ${containerWidth} ${totalHeight}`)
    .style('display', 'block');

  // Defs — drop shadow
  const defs = svg.append('defs');
  const filter = defs.append('filter')
    .attr('id', 'tl-shadow-m')
    .attr('x', '-10%').attr('y', '-10%')
    .attr('width', '120%').attr('height', '130%');
  filter.append('feDropShadow')
    .attr('dx', 0).attr('dy', 1)
    .attr('stdDeviation', 2)
    .attr('flood-opacity', 0.08);

  // Left axis line
  svg.append('line')
    .attr('x1', axisX).attr('x2', axisX)
    .attr('y1', PAD_TOP).attr('y2', totalHeight - PAD_BOTTOM)
    .attr('stroke', 'var(--color-border)')
    .attr('stroke-width', 2);

  // Year markers — positioned on the axis as small pills
  let markerY = PAD_TOP;
  let prevYear = -1;
  for (const event of allEvents) {
    const year = event.parsedDate.getFullYear();
    if (year !== prevYear) {
      markerY += YEAR_LABEL_HEIGHT;
      const pillW = 48;
      const pillH = 20;
      const pillY = markerY - cardHeight - MOBILE_CARD_GAP - YEAR_LABEL_HEIGHT + 8;

      svg.append('rect')
        .attr('x', axisX - pillW / 2)
        .attr('y', pillY)
        .attr('width', pillW)
        .attr('height', pillH)
        .attr('rx', pillH / 2)
        .attr('fill', 'var(--color-surface)')
        .attr('stroke', 'var(--color-border)')
        .attr('stroke-width', 1);

      svg.append('text')
        .attr('x', axisX)
        .attr('y', pillY + pillH / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-size', '11px')
        .attr('font-weight', '700')
        .attr('fill', 'var(--color-text)')
        .attr('font-family', 'var(--font-mono)')
        .text(String(year));

      prevYear = year;
    }
    markerY += cardHeight + MOBILE_CARD_GAP;
  }

  // Track active tooltip group for tap-to-toggle
  let activeGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;

  // Event cards — all on right side
  for (const event of positioned) {
    const color = EVENT_COLORS[event.type] ?? EVENT_COLORS['other']!;
    const clickable = !!event.subject;
    const midY = event.y + cardHeight / 2;

    const group = svg.append('g')
      .attr('class', 'tl-event')
      .style('cursor', clickable ? 'pointer' : 'default');

    // Connector line from axis to card
    group.append('line')
      .attr('x1', axisX)
      .attr('x2', axisX + MOBILE_CONNECTOR)
      .attr('y1', midY)
      .attr('y2', midY)
      .attr('stroke', color)
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.5);

    // Dot on the axis
    group.append('circle')
      .attr('cx', axisX)
      .attr('cy', midY)
      .attr('r', MOBILE_DOT_RADIUS)
      .attr('fill', color)
      .attr('stroke', 'var(--color-surface)')
      .attr('stroke-width', 2);

    // Card background
    group.append('rect')
      .attr('x', cardX)
      .attr('y', event.y)
      .attr('width', cardWidth)
      .attr('height', cardHeight)
      .attr('rx', 6)
      .attr('fill', 'var(--color-surface)')
      .attr('stroke', 'var(--color-border)')
      .attr('stroke-width', 1)
      .attr('filter', 'url(#tl-shadow-m)');

    // Color accent bar on left edge of card
    group.append('rect')
      .attr('x', cardX)
      .attr('y', event.y)
      .attr('width', 4)
      .attr('height', cardHeight)
      .attr('rx', '2 0 0 2')
      .attr('fill', color);

    const textX = cardX + 12;

    // Date label
    const dateStr = formatDate(event.parsedDate, event.date_precision);
    group.append('text')
      .attr('x', textX)
      .attr('y', event.y + 16)
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-mono)')
      .attr('fill', 'var(--color-text-muted)')
      .attr('pointer-events', 'none')
      .text(dateStr);

    // Type + subject badge
    const badgeText = [
      event.type.replace(/_/g, ' '),
      event.subject ? CASE_NAMES[event.subject] ?? event.subject : null,
    ].filter(Boolean).join(' · ');

    group.append('text')
      .attr('x', textX)
      .attr('y', event.y + 30)
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('fill', color)
      .attr('pointer-events', 'none')
      .text(badgeText);

    // Description — more chars available since full width
    const maxChars = Math.max(30, Math.floor(cardWidth / 6));
    const desc = event.description.length > maxChars
      ? event.description.slice(0, maxChars - 1).trimEnd() + '...'
      : event.description;

    group.append('text')
      .attr('x', textX)
      .attr('y', event.y + 46)
      .attr('font-size', '11px')
      .attr('fill', 'var(--color-text)')
      .attr('pointer-events', 'none')
      .text(desc);

    // Second line of description for mobile if needed
    if (event.description.length > maxChars) {
      const line2 = event.description.slice(maxChars - 1).trimStart();
      const line2Text = line2.length > maxChars
        ? line2.slice(0, maxChars - 1).trimEnd() + '...'
        : line2;
      group.append('text')
        .attr('x', textX)
        .attr('y', event.y + 59)
        .attr('font-size', '11px')
        .attr('fill', 'var(--color-text)')
        .attr('pointer-events', 'none')
        .text(line2Text);
    }

    // Confidence tag
    const confOpacity = event.confidence === 'speculated' ? 0.5
      : event.confidence === 'alleged' ? 0.7 : 1;
    group.append('text')
      .attr('x', textX)
      .attr('y', event.y + cardHeight - 6)
      .attr('font-size', '9px')
      .attr('fill', 'var(--color-text-muted)')
      .attr('opacity', confOpacity)
      .attr('pointer-events', 'none')
      .text(event.confidence);

    // Touch: tap to show tooltip, second tap navigates (if clickable)
    group.on('touchstart', (touchEvent: TouchEvent) => {
      touchEvent.preventDefault();
      if (activeGroup === group) {
        // Second tap — navigate if clickable
        if (clickable) {
          window.location.href = `${BASE}/cases/${event.subject}/`;
        }
        hideTooltip(tooltip);
        activeGroup = null;
      } else {
        // First tap — show tooltip
        activeGroup = group;
        if (tooltip) {
          const touch = touchEvent.touches[0]!;
          const rect = tooltip.parentElement!.getBoundingClientRect();
          tooltip.innerHTML = tooltipHtml(event);
          tooltip.hidden = false;
          const x = Math.min(
            touch.clientX - rect.left + 12,
            rect.width - 240,
          );
          const y = touch.clientY - rect.top - 12;
          tooltip.style.left = `${Math.max(4, x)}px`;
          tooltip.style.top = `${y}px`;
        }
      }
    }, { passive: false });

    // Desktop: hover tooltip + click navigate
    group
      .on('mouseenter', (mouseEvent: MouseEvent) => showTooltip(tooltip, mouseEvent, tooltipHtml(event)))
      .on('mouseleave', () => hideTooltip(tooltip));

    if (clickable) {
      group.on('click', () => {
        window.location.href = `${BASE}/cases/${event.subject}/`;
      });
    }
  }

  // Dismiss tooltip on tap outside
  canvas.addEventListener('touchstart', (e: TouchEvent) => {
    if (activeGroup && !(e.target as Element)?.closest('.tl-event')) {
      hideTooltip(tooltip);
      activeGroup = null;
    }
  });

  // Keyboard: Escape dismisses tooltip
  canvas.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      hideTooltip(tooltip);
      activeGroup = null;
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────────────

function formatDate(date: Date, precision?: string): string {
  if (precision === 'year') return String(date.getFullYear());
  if (precision === 'month') {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  }
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function showTooltip(tooltip: HTMLElement | null, event: MouseEvent, html: string): void {
  if (!tooltip) return;
  tooltip.innerHTML = html;
  tooltip.hidden = false;
  const rect = tooltip.parentElement!.getBoundingClientRect();
  const x = event.clientX - rect.left + 12;
  const y = event.clientY - rect.top - 12;
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function hideTooltip(tooltip: HTMLElement | null): void {
  if (!tooltip) return;
  tooltip.hidden = true;
}

function tooltipHtml(d: PlottedEvent): string {
  const dateStr = formatDate(d.parsedDate, d.date_precision);
  const isTouch = 'ontouchstart' in window;
  let html = `<strong>${dateStr}</strong>`;
  html += `<p style="margin:0.25rem 0">${d.description}</p>`;
  html += `<p style="margin:0.25rem 0;font-size:0.85em;opacity:0.7">${d.type.replace(/_/g, ' ')} · ${d.confidence}</p>`;
  if (d.subject) {
    const action = isTouch ? 'Tap again to view case' : 'Click to view case';
    html += `<p style="margin:0.25rem 0;color:var(--color-accent)">${action}</p>`;
  }
  return html;
}
