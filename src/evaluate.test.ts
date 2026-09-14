import { describe, expect, it } from 'vitest';
import { evaluateJson } from './evaluate';

describe('evaluateJson', () => {
  it('空白输入为 empty', () => {
    expect(evaluateJson('').status).toBe('empty');
    expect(evaluateJson('   \n ').status).toBe('empty');
  });

  it('JSON 解析失败整批拒绝', () => {
    const r = evaluateJson('[{"id":');
    expect(r.status).toBe('invalid');
    if (r.status === 'invalid') expect(r.message).toContain('JSON 解析失败');
  });

  it('校验失败整批拒绝并给出首个错误', () => {
    const r = evaluateJson(
      JSON.stringify([
        { id: 'a', start: 0, end: 100, text: 'x' },
        { id: 'a', start: 200, end: 300, text: 'y' },
      ]),
    );
    expect(r.status).toBe('invalid');
    if (r.status === 'invalid') expect(r.message).toContain('id');
  });

  it('合法且无问题：可交付', () => {
    const r = evaluateJson(
      JSON.stringify([
        { id: 'a', start: 0, end: 100, text: 'x' },
        { id: 'b', start: 200, end: 300, text: 'y' },
      ]),
    );
    expect(r.status).toBe('valid');
    if (r.status === 'valid') expect(r.result).toEqual({ kind: 'ok' });
  });

  it('合法输入会被排序后扫描并全部保留', () => {
    const r = evaluateJson(
      JSON.stringify([
        { id: 'b', start: 500, end: 900, text: 'y' },
        { id: 'a', start: 0, end: 100, text: 'x' },
      ]),
    );
    expect(r.status).toBe('valid');
    if (r.status === 'valid') {
      expect(r.sorted.map((s) => s.id)).toEqual(['a', 'b']);
      expect(r.segments.map((s) => s.id)).toEqual(['b', 'a']);
      expect(r.result).toEqual({ kind: 'ok' });
    }
  });

  it('检出重叠：类型、发生毫秒与双方 id', () => {
    const r = evaluateJson(
      JSON.stringify([
        { id: 'a', start: 0, end: 2500, text: 'x' },
        { id: 'b', start: 2000, end: 3000, text: 'y' },
      ]),
    );
    expect(r.status).toBe('valid');
    if (r.status === 'valid') {
      expect(r.result.kind).toBe('overlap');
      if (r.result.kind === 'overlap') {
        expect(r.result.at).toBe(2000);
        expect(r.result.first.id).toBe('a');
        expect(r.result.second.id).toBe('b');
      }
    }
  });

  it('检出过密切换：发生毫秒取前一片段 end', () => {
    const r = evaluateJson(
      JSON.stringify([
        { id: 'a', start: 0, end: 1000, text: 'x' },
        { id: 'b', start: 1050, end: 2000, text: 'y' },
      ]),
    );
    expect(r.status).toBe('valid');
    if (r.status === 'valid') {
      expect(r.result.kind).toBe('dense');
      if (r.result.kind === 'dense') expect(r.result.at).toBe(1000);
    }
  });
});
