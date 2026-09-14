import type { Segment } from './types';

/** 时间轴可视窗口：offset 为起始毫秒，span 为可视跨度（缩放比例的唯一来源） */
export interface View {
  offset: number;
  span: number;
}

/**
 * 输入变化后解析选择：选择状态以片段 id 为唯一契约，
 * 该 id 在当前片段中仍存在则返回对应片段（保留选择），否则返回 null（撤销详情）。
 */
export function resolveSelected(
  segments: readonly Segment[],
  selectedId: string | null,
): Segment | null {
  if (selectedId === null) return null;
  return segments.find((s) => s.id === selectedId) ?? null;
}

export type StepResult =
  | { kind: 'moved'; segment: Segment }
  /** 已到首条/末条，不循环；segment 为当前所在的边界片段 */
  | { kind: 'boundary'; segment: Segment }
  | { kind: 'empty' };

/**
 * 按现有稳定排序（入参须已排序）向左/右切换选择，边界不循环。
 * 无选择（或所选 id 已不存在）时：向右选中首条，向左选中末条。
 */
export function stepSelection(
  sorted: readonly Segment[],
  selectedId: string | null,
  direction: -1 | 1,
): StepResult {
  if (sorted.length === 0) return { kind: 'empty' };
  const idx = selectedId === null ? -1 : sorted.findIndex((s) => s.id === selectedId);
  if (idx === -1) {
    return {
      kind: 'moved',
      segment: direction > 0 ? sorted[0] : sorted[sorted.length - 1],
    };
  }
  const next = idx + direction;
  if (next < 0 || next >= sorted.length) {
    return { kind: 'boundary', segment: sorted[idx] };
  }
  return { kind: 'moved', segment: sorted[next] };
}

/**
 * 保持当前缩放比例（span 不变），最小平移视口使 [start, end] 完整露出；
 * 片段比视口还宽时对齐其 start；结果收敛在 [0, total - span] 内。
 */
export function panToReveal(view: View, start: number, end: number, total: number): View {
  const span = view.span;
  let offset = view.offset;
  if (end - start >= span) {
    offset = start;
  } else if (start < offset) {
    offset = start;
  } else if (end > offset + span) {
    offset = end - span;
  }
  const maxOffset = Math.max(0, total - span);
  offset = Math.min(Math.max(offset, 0), maxOffset);
  return { offset, span };
}
