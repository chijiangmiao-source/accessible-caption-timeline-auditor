/** 一条合法字幕片段。index 为其在输入数组中的下标，用于稳定排序与“输入索引最小者”判定。 */
export interface Segment {
  id: string;
  start: number;
  end: number;
  text: string;
  /** 输入数组中的下标 */
  index: number;
}
