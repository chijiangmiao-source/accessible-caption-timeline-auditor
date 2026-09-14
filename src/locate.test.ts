import { describe, expect, it } from 'vitest';
import { panToReveal, resolveSelected, stepSelection } from './locate';
import { sortSegments } from './scan';
import type { Segment } from './types';

const seg = (id: string, start: number, end: number, index: number): Segment => ({
  id,
  start,
  end,
  text: `t-${id}`,
  index,
});

// 稳定排序后顺序：c(0-100) → a(200-300) → b(400-500)
const sorted = sortSegments([seg('b', 400, 500, 0), seg('a', 200, 300, 1), seg('c', 0, 100, 2)]);

describe('resolveSelected', () => {
  it('所选 id 仍存在时返回对应片段（保留选择）', () => {
    expect(resolveSelected(sorted, 'a')?.id).toBe('a');
  });

  it('id 消失或无选择时返回 null（撤销详情）', () => {
    expect(resolveSelected(sorted, 'gone')).toBeNull();
    expect(resolveSelected(sorted, null)).toBeNull();
    expect(resolveSelected([], 'a')).toBeNull();
  });
});

describe('stepSelection', () => {
  it('按稳定排序向右/向左移动', () => {
    const right = stepSelection(sorted, 'c', 1);
    expect(right).toEqual({ kind: 'moved', segment: sorted[1] });
    const left = stepSelection(sorted, 'b', -1);
    expect(left).toEqual({ kind: 'moved', segment: sorted[1] });
  });

  it('首条继续向左不循环，返回 boundary 且停在原片段', () => {
    const r = stepSelection(sorted, 'c', -1);
    expect(r.kind).toBe('boundary');
    if (r.kind === 'boundary') expect(r.segment.id).toBe('c');
  });

  it('末条继续向右不循环，返回 boundary 且停在原片段', () => {
    const r = stepSelection(sorted, 'b', 1);
    expect(r.kind).toBe('boundary');
    if (r.kind === 'boundary') expect(r.segment.id).toBe('b');
  });

  it('无选择时向右选中首条、向左选中末条', () => {
    expect(stepSelection(sorted, null, 1)).toEqual({ kind: 'moved', segment: sorted[0] });
    expect(stepSelection(sorted, null, -1)).toEqual({
      kind: 'moved',
      segment: sorted[sorted.length - 1],
    });
  });

  it('所选 id 不在列表中时按无选择处理', () => {
    expect(stepSelection(sorted, 'gone', 1)).toEqual({ kind: 'moved', segment: sorted[0] });
  });

  it('空列表返回 empty', () => {
    expect(stepSelection([], null, 1)).toEqual({ kind: 'empty' });
    expect(stepSelection([], 'a', -1)).toEqual({ kind: 'empty' });
  });
});

describe('panToReveal', () => {
  it('目标已完整露出时视口不动', () => {
    const view = { offset: 1000, span: 500 };
    expect(panToReveal(view, 1100, 1300, 5000)).toEqual({ offset: 1000, span: 500 });
  });

  it('目标在视口左侧时向左平移对齐其 start，保持 span', () => {
    const view = { offset: 1000, span: 500 };
    expect(panToReveal(view, 200, 300, 5000)).toEqual({ offset: 200, span: 500 });
  });

  it('目标在视口右侧时向右平移对齐其 end，保持 span', () => {
    const view = { offset: 1000, span: 500 };
    expect(panToReveal(view, 1800, 2000, 5000)).toEqual({ offset: 1500, span: 500 });
  });

  it('平移结果收敛在 [0, total - span] 内', () => {
    const view = { offset: 1000, span: 500 };
    // start 为 0 的目标不会把 offset 推到负数
    expect(panToReveal(view, 0, 100, 5000)).toEqual({ offset: 0, span: 500 });
    // 贴底的片段不会把 offset 推过 total - span
    expect(panToReveal(view, 1900, 2000, 2000)).toEqual({ offset: 1500, span: 500 });
  });

  it('片段比视口宽时对齐其 start', () => {
    const view = { offset: 400, span: 300 };
    expect(panToReveal(view, 100, 1000, 2000)).toEqual({ offset: 100, span: 300 });
  });
});
