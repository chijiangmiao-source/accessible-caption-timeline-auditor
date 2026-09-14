import type { Segment } from './types';

/** 过密切换的最小间隔：间隔 < 100ms 判为过密，恰好 100ms 合格 */
export const MIN_GAP_MS = 100;

export type ScanProblem = {
  /** overlap=重叠；dense=过密切换 */
  kind: 'overlap' | 'dense';
  /** 发生毫秒：重叠取当前片段 start；过密取前一片段 end */
  at: number;
  /** 在先的一方（重叠时为输入索引最小的未结束片段；过密时为排序后前一片段） */
  first: Segment;
  /** 当前片段 */
  second: Segment;
};

export type ScanResult = { kind: 'ok' } | ScanProblem;

/** 按 start、end、输入索引稳定排序，返回新数组，不改动入参。 */
export function sortSegments(segments: readonly Segment[]): Segment[] {
  return [...segments].sort(
    (a, b) => a.start - b.start || a.end - b.end || a.index - b.index,
  );
}

/**
 * 一次顺序区间扫描（扫描线）：
 * 1. 处理当前片段时，若其 start 小于任一尚未结束（end > 当前 start）片段的 end，
 *    判为重叠，发生毫秒取当前 start；存在多个在先片段时取输入索引最小者。
 * 2. 若无重叠，仅检查当前片段与排序后前一片段的间隔，小于 100ms 判为过密，
 *    发生毫秒取前一片段 end；恰好 100ms 合格。
 * 3. 遇到首个问题立即停止，不收集其余问题。
 *
 * 入参必须已经过 sortSegments 排序。
 */
export function scanSegments(sorted: readonly Segment[]): ScanResult {
  // 活跃集合：已处理且尚未结束的片段（end 大于当前处理位置）
  const active: Segment[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];

    // 1. 重叠检查：任一尚未结束的在先片段，取输入索引最小者
    let other: Segment | null = null;
    for (const seg of active) {
      if (seg.end > cur.start && (other === null || seg.index < other.index)) {
        other = seg;
      }
    }
    if (other !== null) {
      return { kind: 'overlap', at: cur.start, first: other, second: cur };
    }

    // 2. 过密检查：仅与排序后的前一片段比较
    if (i > 0) {
      const prev = sorted[i - 1];
      if (cur.start - prev.end < MIN_GAP_MS) {
        return { kind: 'dense', at: prev.end, first: prev, second: cur };
      }
    }

    // 3. 推进扫描线：丢弃已结束片段，当前片段进入活跃集合
    for (let j = active.length - 1; j >= 0; j--) {
      if (active[j].end <= cur.start) active.splice(j, 1);
    }
    active.push(cur);
  }

  return { kind: 'ok' };
}
