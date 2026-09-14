import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { panToReveal, stepSelection, type View } from './locate';
import type { Segment } from './types';

export interface TimelineHighlight {
  kind: 'overlap' | 'dense';
  ids: [string, string];
}

export interface TimelineHandle {
  /** 将键盘焦点移到指定片段（供结论区 id 跳转后连续方向键操作） */
  focusSegment: (id: string) => void;
}

interface TimelineProps {
  /** 已按 start、end、输入索引排序的合法片段，全部绘制 */
  segments: Segment[];
  highlight: TimelineHighlight | null;
  /** 结论区悬停时联动强调高亮片段 */
  emphasized: boolean;
  /** 当前选中的片段 id（选择状态的唯一契约），null 表示无选择 */
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const LANE_HEIGHT = 26;
const LANE_GAP = 6;
const AXIS_HEIGHT = 26;
const TOP_PAD = 8;
const MIN_SPAN_MS = 10;
/** 按下后移动超过该距离才算拖拽平移，否则视为点击选中 */
const DRAG_THRESHOLD_PX = 3;

/** 贪心分配泳道，仅影响可视化布局，不影响扫描结论 */
function assignLanes(sorted: readonly Segment[]): number[] {
  const laneEnds: number[] = [];
  return sorted.map((seg) => {
    for (let lane = 0; lane < laneEnds.length; lane++) {
      if (laneEnds[lane] <= seg.start) {
        laneEnds[lane] = seg.end;
        return lane;
      }
    }
    laneEnds.push(seg.end);
    return laneEnds.length - 1;
  });
}

function niceStep(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 5, 10]) {
    if (raw <= m * pow) return m * pow;
  }
  return 10 * pow;
}

function clampView(view: View, total: number): View {
  const span = Math.min(Math.max(view.span, MIN_SPAN_MS), total);
  const offset = Math.min(Math.max(view.offset, 0), Math.max(0, total - span));
  return { offset, span };
}

export function formatMs(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const rem = ms % 1000;
  const base = `${m}:${String(s).padStart(2, '0')}`;
  return rem === 0 ? base : `${base}.${String(rem).padStart(3, '0')}`;
}

export const Timeline = forwardRef<TimelineHandle, TimelineProps>(function Timeline(
  { segments, highlight, emphasized, selectedId, onSelect },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(960);
  /** null 表示“适配全部” */
  const [view, setView] = useState<View | null>(null);
  /** 已到首条/末条的可感知提示 */
  const [hint, setHint] = useState<string | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startOffset: number;
    active: boolean;
  } | null>(null);
  const segRefs = useRef(new Map<string, SVGGElement>());

  const total = useMemo(
    () => Math.max(1, ...segments.map((s) => s.end)),
    [segments],
  );
  const lanes = useMemo(() => assignLanes(segments), [segments]);
  const laneCount = lanes.length === 0 ? 1 : Math.max(...lanes) + 1;

  useImperativeHandle(
    ref,
    () => ({
      focusSegment: (id: string) => {
        segRefs.current.get(id)?.focus();
      },
    }),
    [],
  );

  // 数据变化时重置视图与边界提示
  useEffect(() => {
    setView(null);
    setHint(null);
  }, [segments]);

  // 选中变化时保持当前缩放比例，自动平移到完整露出目标
  useEffect(() => {
    if (selectedId === null) return;
    const seg = segments.find((s) => s.id === selectedId);
    if (!seg) return;
    setView((cur) => {
      const base = cur ?? { offset: 0, span: total };
      const next = panToReveal(base, seg.start, seg.end, total);
      return next.offset === base.offset && next.span === base.span ? cur : next;
    });
  }, [selectedId, segments, total]);

  // 跟踪容器宽度（挂载时同步测量一次，避免首帧与后续读数不一致；
  // 与 ResizeObserver 一致取 content-box）
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const initial =
      el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (initial > 0) setWidth(initial);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 滚轮缩放（需要非 passive 监听以阻止页面滚动）
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
      const factor = e.deltaY < 0 ? 1.25 : 0.8;
      setView((cur) => {
        const base = cur ?? { offset: 0, span: total };
        const center = base.offset + ratio * base.span;
        const span = base.span / factor;
        return clampView({ offset: center - ratio * span, span }, total);
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [total]);

  const eff: View = view ?? { offset: 0, span: total };
  const pxPerMs = width / eff.span;
  const toX = (ms: number) => (ms - eff.offset) * pxPerMs;

  const zoomAt = (factor: number, centerMs: number) => {
    setView((cur) => {
      const base = cur ?? { offset: 0, span: total };
      const span = base.span / factor;
      const ratio = (centerMs - base.offset) / base.span;
      return clampView({ offset: centerMs - ratio * span, span }, total);
    });
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startOffset: eff.offset,
      active: false,
    };
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (!drag.active) {
      if (Math.abs(e.clientX - drag.startX) < DRAG_THRESHOLD_PX) return;
      drag.active = true;
      e.currentTarget.setPointerCapture(drag.pointerId);
    }
    const dMs = (e.clientX - drag.startX) / pxPerMs;
    setView(clampView({ offset: drag.startOffset - dMs, span: eff.span }, total));
  };
  const endDrag = () => {
    dragRef.current = null;
  };

  const selectAndFocus = (id: string) => {
    setHint(null);
    onSelect(id);
    segRefs.current.get(id)?.focus();
  };

  const onSegKeyDown = (e: ReactKeyboardEvent<SVGGElement>, seg: Segment) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectAndFocus(seg.id);
      return;
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const direction = e.key === 'ArrowRight' ? 1 : -1;
    const result = stepSelection(segments, selectedId, direction);
    if (result.kind === 'moved') {
      selectAndFocus(result.segment.id);
    } else if (result.kind === 'boundary') {
      setHint(direction < 0 ? '已到首条' : '已到末条');
    }
  };

  const targetTicks = Math.max(2, Math.round(width / 110));
  const step = niceStep(eff.span / targetTicks);
  const ticks: number[] = [];
  for (let t = Math.ceil(eff.offset / step) * step; t <= eff.offset + eff.span; t += step) {
    ticks.push(Math.round(t));
  }

  const height = TOP_PAD + laneCount * (LANE_HEIGHT + LANE_GAP) + AXIS_HEIGHT;
  const axisY = height - AXIS_HEIGHT;
  const highlightIds = highlight ? new Set(highlight.ids) : null;

  return (
    <div
      className={`timeline${emphasized ? ' emph' : ''}`}
      ref={containerRef}
      data-testid="timeline"
    >
      <div className="timeline-toolbar">
        <button
          type="button"
          data-testid="zoom-in"
          onClick={() => zoomAt(1.5, eff.offset + eff.span / 2)}
        >
          放大
        </button>
        <button
          type="button"
          data-testid="zoom-out"
          onClick={() => zoomAt(1 / 1.5, eff.offset + eff.span / 2)}
        >
          缩小
        </button>
        <button type="button" data-testid="zoom-reset" onClick={() => setView(null)}>
          重置
        </button>
        <span className="view-label">
          {formatMs(Math.round(eff.offset))} – {formatMs(Math.round(eff.offset + eff.span))} · 共{' '}
          {segments.length} 条
        </span>
      </div>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label="字幕时间轴"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={toX(t)} y1={TOP_PAD} x2={toX(t)} y2={axisY} />
            <line
              className="tick"
              x1={toX(t)}
              y1={axisY}
              x2={toX(t)}
              y2={axisY + 5}
            />
            <text
              className="tick-label"
              x={Math.min(Math.max(toX(t), 16), width - 16)}
              y={height - 8}
              textAnchor="middle"
            >
              {formatMs(t)}
            </text>
          </g>
        ))}
        <line className="axis" x1={0} y1={axisY} x2={width} y2={axisY} />
        {segments.map((seg, i) => {
          const lane = lanes[i];
          const y = TOP_PAD + lane * (LANE_HEIGHT + LANE_GAP);
          const x = toX(seg.start);
          const w = Math.max(1, (seg.end - seg.start) * pxPerMs);
          const isHl = highlightIds?.has(seg.id) ?? false;
          const isSel = seg.id === selectedId;
          const cls = `seg${isHl && highlight ? ` hl hl-${highlight.kind}` : ''}${isSel ? ' sel' : ''}`;
          return (
            <g
              key={seg.id}
              ref={(el) => {
                if (el) segRefs.current.set(seg.id, el);
                else segRefs.current.delete(seg.id);
              }}
              className={cls}
              data-testid="segment-rect"
              data-id={seg.id}
              data-highlight={isHl || undefined}
              data-selected={isSel || undefined}
              tabIndex={0}
              role="button"
              aria-pressed={isSel}
              aria-label={`片段 ${seg.id}：${formatMs(seg.start)} 至 ${formatMs(seg.end)}，${seg.text}`}
              onClick={() => selectAndFocus(seg.id)}
              onKeyDown={(e) => onSegKeyDown(e, seg)}
            >
              <rect x={x} y={y} width={w} height={LANE_HEIGHT} rx={3}>
                <title>{`${seg.id}｜${formatMs(seg.start)} – ${formatMs(seg.end)}｜${seg.text}`}</title>
              </rect>
              {w > 36 && (
                <text className="seg-label" x={x + 4} y={y + LANE_HEIGHT / 2 + 4}>
                  {seg.id}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="nav-hint" data-testid="nav-hint" role="status">
        {hint}
      </div>
    </div>
  );
});
