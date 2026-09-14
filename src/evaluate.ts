import { validateSegments } from './validate';
import { scanSegments, sortSegments, type ScanResult } from './scan';
import type { Segment } from './types';

export type Evaluation =
  | { status: 'empty' }
  | { status: 'invalid'; message: string }
  | {
      status: 'valid';
      segments: Segment[];
      sorted: Segment[];
      result: ScanResult;
    };

/** 解析并评估用户粘贴的 JSON 文本：解析失败或校验失败即整批拒绝。 */
export function evaluateJson(raw: string): Evaluation {
  if (raw.trim() === '') return { status: 'empty' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      status: 'invalid',
      message: `JSON 解析失败：${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const validation = validateSegments(parsed);
  if (!validation.ok) {
    return { status: 'invalid', message: validation.issue.message };
  }

  const sorted = sortSegments(validation.segments);
  const result = scanSegments(sorted);
  return { status: 'valid', segments: validation.segments, sorted, result };
}
