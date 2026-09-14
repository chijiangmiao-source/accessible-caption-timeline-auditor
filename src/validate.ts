import type { Segment } from './types';

export type FieldName = 'id' | 'start' | 'end' | 'text';

export interface ValidationIssue {
  /** 出错条目在输入数组中的下标；整体结构错误时为 null */
  itemIndex: number | null;
  /** 出错字段；整体结构错误时为 null */
  field: FieldName | null;
  message: string;
}

export type ValidationResult =
  | { ok: true; segments: Segment[] }
  | { ok: false; issue: ValidationIssue };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isIntMs = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);

function missing(itemIndex: number, field: FieldName): ValidationResult {
  return {
    ok: false,
    issue: { itemIndex, field, message: `第 ${itemIndex + 1} 项缺少字段 ${field}` },
  };
}

function typeError(itemIndex: number, field: FieldName, detail: string): ValidationResult {
  return {
    ok: false,
    issue: { itemIndex, field, message: `第 ${itemIndex + 1} 项字段 ${field} 类型错误：${detail}` },
  };
}

function illegal(itemIndex: number, field: FieldName, detail: string): ValidationResult {
  return {
    ok: false,
    issue: { itemIndex, field, message: `第 ${itemIndex + 1} 项字段 ${field} 非法：${detail}` },
  };
}

/**
 * 校验输入数组。按输入项顺序、每项内按 id → start → end → text 的字段顺序
 * 定位首个错误；任一字段缺失、类型错误、id 重复或时间非法即整批拒绝。
 */
export function validateSegments(input: unknown): ValidationResult {
  if (!Array.isArray(input)) {
    return {
      ok: false,
      issue: { itemIndex: null, field: null, message: '输入必须是 JSON 数组' },
    };
  }

  const seenIds = new Map<string, number>();
  const segments: Segment[] = [];

  for (let i = 0; i < input.length; i++) {
    const item: unknown = input[i];
    if (!isPlainObject(item)) {
      return {
        ok: false,
        issue: { itemIndex: i, field: null, message: `第 ${i + 1} 项必须是对象` },
      };
    }

    // id：存在 → 字符串 → 唯一
    if (!('id' in item)) return missing(i, 'id');
    if (typeof item.id !== 'string') return typeError(i, 'id', '应为字符串');
    const firstSeen = seenIds.get(item.id);
    if (firstSeen !== undefined) {
      return {
        ok: false,
        issue: {
          itemIndex: i,
          field: 'id',
          message: `第 ${i + 1} 项字段 id 与第 ${firstSeen + 1} 项重复（"${item.id}"）`,
        },
      };
    }

    // start：存在 → 整数毫秒 → ≥ 0
    if (!('start' in item)) return missing(i, 'start');
    if (!isIntMs(item.start)) return typeError(i, 'start', '应为整数毫秒');
    if (item.start < 0) return illegal(i, 'start', '必须 ≥ 0');

    // end：存在 → 整数毫秒 → 大于 start
    if (!('end' in item)) return missing(i, 'end');
    if (!isIntMs(item.end)) return typeError(i, 'end', '应为整数毫秒');
    if (item.end <= item.start) {
      return illegal(i, 'end', `必须大于 start（${item.start}）`);
    }

    // text：存在 → 字符串 → 非空
    if (!('text' in item)) return missing(i, 'text');
    if (typeof item.text !== 'string') return typeError(i, 'text', '应为字符串');
    if (item.text.length === 0) return illegal(i, 'text', '不能为空字符串');

    seenIds.set(item.id, i);
    segments.push({ id: item.id, start: item.start, end: item.end, text: item.text, index: i });
  }

  return { ok: true, segments };
}
