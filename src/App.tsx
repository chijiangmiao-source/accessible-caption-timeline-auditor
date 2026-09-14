import { useMemo, useState } from 'react';
import { evaluateJson } from './evaluate';
import { Timeline, type TimelineHighlight } from './Timeline';

const SAMPLE_OK = JSON.stringify(
  [
    { id: 's1', start: 0, end: 1800, text: '开场白' },
    { id: 's2', start: 2000, end: 3600, text: '主持人介绍嘉宾' },
    { id: 's3', start: 3800, end: 5600, text: '第一段访谈' },
  ],
  null,
  2,
);

const SAMPLE_OVERLAP = JSON.stringify(
  [
    { id: 'a', start: 0, end: 2500, text: '旁白一' },
    { id: 'b', start: 2000, end: 3200, text: '旁白二' },
    { id: 'c', start: 3500, end: 4800, text: '旁白三' },
  ],
  null,
  2,
);

const SAMPLE_DENSE = JSON.stringify(
  [
    { id: 'a', start: 0, end: 1500, text: '第一句' },
    { id: 'b', start: 1550, end: 2400, text: '第二句' },
    { id: 'c', start: 2600, end: 4000, text: '第三句' },
  ],
  null,
  2,
);

export default function App() {
  const [raw, setRaw] = useState('');
  const [emphasized, setEmphasized] = useState(false);
  const evaluation = useMemo(() => evaluateJson(raw), [raw]);

  const highlight: TimelineHighlight | null =
    evaluation.status === 'valid' && evaluation.result.kind !== 'ok'
      ? {
          kind: evaluation.result.kind,
          ids: [evaluation.result.first.id, evaluation.result.second.id],
        }
      : null;

  return (
    <div className="app">
      <header>
        <h1>字幕时间轴质检</h1>
        <p className="subtitle">
          粘贴字幕 JSON 数组（id / start / end / text），检查重叠与过密切换（间隔 &lt; 100ms）
        </p>
      </header>

      <section className="panel">
        <div className="input-head">
          <label htmlFor="json-input">字幕 JSON</label>
          <div className="samples">
            <button type="button" onClick={() => setRaw(SAMPLE_OK)}>
              合格示例
            </button>
            <button type="button" onClick={() => setRaw(SAMPLE_OVERLAP)}>
              重叠示例
            </button>
            <button type="button" onClick={() => setRaw(SAMPLE_DENSE)}>
              过密示例
            </button>
            <button type="button" onClick={() => setRaw('')}>
              清空
            </button>
          </div>
        </div>
        <textarea
          id="json-input"
          data-testid="json-input"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder='[{"id":"s1","start":0,"end":1200,"text":"……"}]'
          spellCheck={false}
        />
      </section>

      {evaluation.status === 'invalid' && (
        <div className="error-panel" data-testid="error-panel" role="alert">
          <strong>整批拒绝：</strong>
          {evaluation.message}
        </div>
      )}

      {evaluation.status === 'valid' && (
        <>
          {evaluation.result.kind === 'ok' ? (
            <div
              className="conclusion ok"
              data-testid="conclusion"
              data-status="ok"
              aria-live="polite"
            >
              可交付
            </div>
          ) : (
            <div
              className={`conclusion problem ${evaluation.result.kind}`}
              data-testid="conclusion"
              data-status="problem"
              aria-live="polite"
              onMouseEnter={() => setEmphasized(true)}
              onMouseLeave={() => setEmphasized(false)}
            >
              <div>
                <span className="k">问题类型</span>
                <span data-testid="problem-type">
                  {evaluation.result.kind === 'overlap' ? '重叠' : '过密切换'}
                </span>
              </div>
              <div>
                <span className="k">发生毫秒</span>
                <span data-testid="problem-at">{evaluation.result.at}</span>
              </div>
              <div>
                <span className="k">双方 id</span>
                <span className="id-chip" data-testid="problem-id-a">
                  {evaluation.result.first.id}
                </span>
                <span className="id-chip" data-testid="problem-id-b">
                  {evaluation.result.second.id}
                </span>
              </div>
            </div>
          )}
          <Timeline
            segments={evaluation.sorted}
            highlight={highlight}
            emphasized={emphasized}
          />
        </>
      )}

      {evaluation.status === 'empty' && (
        <p className="hint">等待输入：请在上方粘贴字幕 JSON 数组。</p>
      )}
    </div>
  );
}
