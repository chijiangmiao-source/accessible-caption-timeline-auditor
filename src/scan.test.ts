import { describe, expect, it } from 'vitest';
import { MIN_GAP_MS, scanSegments, sortSegments } from './scan';
import type { Segment } from './types';

const seg = (id: string, start: number, end: number, index: number): Segment => ({
  id,
  start,
  end,
  text: `t-${id}`,
  index,
});

describe('sortSegments', () => {
  it('按 start、end、输入索引稳定排序', () => {
    const a = seg('a', 100, 200, 0);
    const b = seg('b', 100, 150, 1);
    const c = seg('c', 50, 60, 2);
    const d = seg('d', 100, 150, 3);
    const sorted = sortSegments([a, b, c, d]);
    expect(sorted.map((s) => s.id)).toEqual(['c', 'b', 'd', 'a']);
  });

  it('不改动原数组', () => {
    const input = [seg('b', 100, 200, 1), seg('a', 0, 50, 0)];
    sortSegments(input);
    expect(input.map((s) => s.id)).toEqual(['b', 'a']);
  });
});

describe('scanSegments', () => {
  it('空输入与单片段均无问题', () => {
    expect(scanSegments([])).toEqual({ kind: 'ok' });
    expect(scanSegments(sortSegments([seg('a', 0, 100, 0)]))).toEqual({ kind: 'ok' });
  });

  it('间隔恰好 100ms 合格，大于 100ms 也合格', () => {
    const sorted = sortSegments([
      seg('a', 0, 100, 0),
      seg('b', 200, 300, 1), // 间隔恰好 100
      seg('c', 450, 500, 2), // 间隔 150
    ]);
    expect(scanSegments(sorted)).toEqual({ kind: 'ok' });
  });

  it('重叠：发生毫秒取当前片段 start', () => {
    const a = seg('a', 0, 1000, 0);
    const b = seg('b', 500, 600, 1);
    const r = scanSegments(sortSegments([a, b]));
    expect(r.kind).toBe('overlap');
    if (r.kind === 'overlap') {
      expect(r.at).toBe(500);
      expect(r.first.id).toBe('a');
      expect(r.second.id).toBe('b');
    }
  });

  it('重叠：当前片段被在先片段完全包含也算重叠', () => {
    const a = seg('a', 100, 900, 0);
    const b = seg('b', 300, 400, 1);
    const r = scanSegments(sortSegments([a, b]));
    expect(r.kind).toBe('overlap');
    if (r.kind === 'overlap') expect(r.at).toBe(300);
  });

  it('端点相接（end == start）不算重叠，但间隔 0 判为过密', () => {
    const a = seg('a', 0, 100, 0);
    const b = seg('b', 100, 200, 1);
    const r = scanSegments(sortSegments([a, b]));
    expect(r.kind).toBe('dense');
    if (r.kind === 'dense') expect(r.at).toBe(100);
  });

  it('过密：间隔 99ms 判为过密，发生毫秒取前一片段 end', () => {
    const a = seg('a', 0, 1000, 0);
    const b = seg('b', 1000 + MIN_GAP_MS - 1, 2000, 1);
    const r = scanSegments(sortSegments([a, b]));
    expect(r.kind).toBe('dense');
    if (r.kind === 'dense') {
      expect(r.at).toBe(1000);
      expect(r.first.id).toBe('a');
      expect(r.second.id).toBe('b');
    }
  });

  it('过密：仅与排序后前一片段比较（跨过中间片段的间隔不算）', () => {
    // a 结束于 100，b 与 a 间隔 100 合格；c 与 b 间隔 50 过密
    const a = seg('a', 0, 100, 0);
    const b = seg('b', 200, 250, 1);
    const c = seg('c', 300, 310, 2);
    const r = scanSegments(sortSegments([a, b, c]));
    expect(r.kind).toBe('dense');
    if (r.kind === 'dense') {
      expect(r.at).toBe(250);
      expect(r.first.id).toBe('b');
      expect(r.second.id).toBe('c');
    }
  });

  it('扫描按排序后顺序进行，与输入顺序无关', () => {
    // x 输入在最前，但排序后最后；问题发生在 a→b 之间
    const x = seg('x', 5000, 6000, 0);
    const a = seg('a', 0, 100, 1);
    const b = seg('b', 120, 200, 2);
    const r = scanSegments(sortSegments([x, a, b]));
    expect(r.kind).toBe('dense');
    if (r.kind === 'dense') {
      expect(r.at).toBe(100);
      expect(r.first.id).toBe('a');
      expect(r.second.id).toBe('b');
    }
  });

  it('遇到首个问题立即停止，不收集后续问题', () => {
    // a→b 过密（先发生），b 与 c 重叠（后发生），只报告过密
    const a = seg('a', 0, 100, 0);
    const b = seg('b', 150, 160, 1);
    const c = seg('c', 155, 156, 2);
    const r = scanSegments(sortSegments([a, b, c]));
    expect(r.kind).toBe('dense');
    if (r.kind === 'dense') {
      expect(r.at).toBe(100);
      expect(r.first.id).toBe('a');
      expect(r.second.id).toBe('b');
    }
  });

  it('重叠优先于过密：先发生的重叠被报告', () => {
    // a 与 b 重叠（先发生），b→c 间隔过密（后发生）
    const a = seg('a', 0, 1000, 0);
    const b = seg('b', 500, 600, 1);
    const c = seg('c', 650, 700, 2);
    const r = scanSegments(sortSegments([a, b, c]));
    expect(r.kind).toBe('overlap');
    if (r.kind === 'overlap') {
      expect(r.at).toBe(500);
      expect(r.second.id).toBe('b');
    }
  });

  it('相同 start 的片段按输入索引排序，后到者与先到者重叠', () => {
    const a = seg('a', 0, 100, 0);
    const b = seg('b', 0, 100, 1);
    const r = scanSegments(sortSegments([a, b]));
    expect(r.kind).toBe('overlap');
    if (r.kind === 'overlap') {
      expect(r.at).toBe(0);
      expect(r.first.id).toBe('a');
      expect(r.second.id).toBe('b');
    }
  });

  it('已结束片段不参与重叠判定', () => {
    // a 在 100 结束，b 从 100 之后开始，不与 a 重叠
    const a = seg('a', 0, 100, 0);
    const b = seg('b', 300, 400, 1);
    const c = seg('c', 500, 4500, 2);
    const d = seg('d', 1000, 2000, 3);
    const r = scanSegments(sortSegments([a, b, c, d]));
    // d 与 c 重叠（c 尚未结束），与更早的 a/b 无关
    expect(r.kind).toBe('overlap');
    if (r.kind === 'overlap') {
      expect(r.at).toBe(1000);
      expect(r.first.id).toBe('c');
      expect(r.second.id).toBe('d');
    }
  });
});
