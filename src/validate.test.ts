import { describe, expect, it } from 'vitest';
import { validateSegments } from './validate';

const ok = (id: string, start = 0, end = 100, text = 'x') => ({ id, start, end, text });

describe('validateSegments', () => {
  it('接受合法输入并保留输入索引', () => {
    const r = validateSegments([ok('a'), ok('b', 200, 300, 'y')]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.segments.map((s) => s.id)).toEqual(['a', 'b']);
      expect(r.segments.map((s) => s.index)).toEqual([0, 1]);
    }
  });

  it('空数组合法', () => {
    const r = validateSegments([]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.segments).toEqual([]);
  });

  it('拒绝非数组输入', () => {
    for (const v of [null, {}, 'str', 5, true, undefined]) {
      const r = validateSegments(v);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.issue.itemIndex).toBeNull();
    }
  });

  it('拒绝非对象条目并定位到下标', () => {
    const r = validateSegments([ok('a'), 42]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issue.itemIndex).toBe(1);
  });

  it('字段缺失按 id→start→end→text 顺序报告', () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ start: 0, end: 5, text: 't' }, 'id'],
      [{ id: 'a', end: 5, text: 't' }, 'start'],
      [{ id: 'a', start: 0, text: 't' }, 'end'],
      [{ id: 'a', start: 0, end: 5 }, 'text'],
    ];
    for (const [item, field] of cases) {
      const r = validateSegments([item]);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.issue.itemIndex).toBe(0);
        expect(r.issue.field).toBe(field);
      }
    }
  });

  it('类型错误：id 非字符串', () => {
    const r = validateSegments([{ ...ok('a'), id: 123 }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issue.field).toBe('id');
  });

  it('类型错误：start/end 非整数毫秒', () => {
    for (const bad of [
      { ...ok('a'), start: '0' },
      { ...ok('a'), start: 0.5 },
      { ...ok('a'), start: Number.NaN },
      { ...ok('a'), start: true },
      { ...ok('a'), end: 1.5 },
      { ...ok('a'), end: null },
    ]) {
      const r = validateSegments([bad]);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(['start', 'end']).toContain(r.issue.field);
    }
  });

  it('类型错误：text 非字符串', () => {
    const r = validateSegments([{ ...ok('a'), text: 9 }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issue.field).toBe('text');
  });

  it('时间非法：start 为负', () => {
    const r = validateSegments([ok('a', -1, 100)]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issue.field).toBe('start');
  });

  it('时间非法：end 不大于 start', () => {
    for (const [s, e] of [
      [100, 100],
      [100, 50],
      [0, 0],
    ]) {
      const r = validateSegments([ok('a', s, e)]);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.issue.field).toBe('end');
    }
  });

  it('空字符串 text 非法', () => {
    const r = validateSegments([ok('a', 0, 100, '')]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issue.field).toBe('text');
  });

  it('重复 id 定位到后出现的项', () => {
    const r = validateSegments([ok('a'), ok('b', 200, 300), ok('a', 400, 500)]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issue.itemIndex).toBe(2);
      expect(r.issue.field).toBe('id');
    }
  });

  it('首个错误按输入项顺序定位：靠前项优先', () => {
    const r = validateSegments([
      { id: 'x', start: -5, end: 10, text: 't' },
      { id: 'x', start: 0, end: 10, text: 't' }, // 重复 id，但前一项先出错
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issue.itemIndex).toBe(0);
      expect(r.issue.field).toBe('start');
    }
  });

  it('同一项内按字段顺序定位：id 优先于 start', () => {
    const r = validateSegments([{ id: 7, start: -1, end: 0, text: '' }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issue.field).toBe('id');
  });

  it('边界：start 为 0 合法，end 恰好比 start 大 1 合法', () => {
    const r = validateSegments([ok('a', 0, 1)]);
    expect(r.ok).toBe(true);
  });
});
