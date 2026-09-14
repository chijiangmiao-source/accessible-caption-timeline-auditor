import { expect, test } from '@playwright/test';

const OK_JSON = JSON.stringify([
  { id: 's1', start: 0, end: 1000, text: '第一句' },
  { id: 's2', start: 1100, end: 2000, text: '第二句' },
  { id: 's3', start: 2200, end: 3000, text: '第三句' },
]);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('合法且无问题：显示可交付并绘制全部片段', async ({ page }) => {
  await page.getByTestId('json-input').fill(OK_JSON);
  await expect(page.getByTestId('conclusion')).toHaveText('可交付');
  await expect(page.locator('[data-testid="segment-rect"]')).toHaveCount(3);
  await expect(page.getByTestId('error-panel')).toHaveCount(0);
});

test('重叠：显示类型、发生毫秒与双方 id，并联动高亮两个片段', async ({ page }) => {
  const json = JSON.stringify([
    { id: 'a', start: 0, end: 2500, text: '旁白一' },
    { id: 'b', start: 2000, end: 3000, text: '旁白二' },
  ]);
  await page.getByTestId('json-input').fill(json);
  await expect(page.getByTestId('problem-type')).toHaveText('重叠');
  await expect(page.getByTestId('problem-at')).toHaveText('2000');
  await expect(page.getByTestId('problem-id-a')).toHaveText('a');
  await expect(page.getByTestId('problem-id-b')).toHaveText('b');
  await expect(
    page.locator('[data-testid="segment-rect"][data-highlight="true"]'),
  ).toHaveCount(2);
  await expect(page.getByTestId('conclusion')).not.toHaveText('可交付');
});

test('过密切换：间隔小于 100ms，发生毫秒取前一片段 end', async ({ page }) => {
  const json = JSON.stringify([
    { id: 'a', start: 0, end: 1000, text: '一' },
    { id: 'b', start: 1050, end: 2000, text: '二' },
  ]);
  await page.getByTestId('json-input').fill(json);
  await expect(page.getByTestId('problem-type')).toHaveText('过密切换');
  await expect(page.getByTestId('problem-at')).toHaveText('1000');
  await expect(page.getByTestId('problem-id-a')).toHaveText('a');
  await expect(page.getByTestId('problem-id-b')).toHaveText('b');
});

test('间隔恰好 100ms 合格', async ({ page }) => {
  const json = JSON.stringify([
    { id: 'a', start: 0, end: 1000, text: '一' },
    { id: 'b', start: 1100, end: 2000, text: '二' },
  ]);
  await page.getByTestId('json-input').fill(json);
  await expect(page.getByTestId('conclusion')).toHaveText('可交付');
});

test('非法输入整批拒绝并清除旧图形与结论', async ({ page }) => {
  await page.getByTestId('json-input').fill(OK_JSON);
  await expect(page.getByTestId('conclusion')).toHaveText('可交付');
  await expect(page.locator('[data-testid="segment-rect"]')).toHaveCount(3);

  const bad = JSON.stringify([
    { id: 'a', start: 0, end: 100, text: 'x' },
    { id: 'a', start: 200, end: 300, text: 'y' },
  ]);
  await page.getByTestId('json-input').fill(bad);
  await expect(page.getByTestId('error-panel')).toBeVisible();
  await expect(page.getByTestId('error-panel')).toContainText('id');
  await expect(page.locator('[data-testid="segment-rect"]')).toHaveCount(0);
  await expect(page.getByTestId('conclusion')).toHaveCount(0);
});

test('携带额外字段（如 speaker）整批拒绝并清空结果', async ({ page }) => {
  await page.getByTestId('json-input').fill(OK_JSON);
  await expect(page.getByTestId('conclusion')).toHaveText('可交付');
  await expect(page.locator('[data-testid="segment-rect"]')).toHaveCount(3);

  const withSpeaker = JSON.stringify([
    { id: 's1', start: 0, end: 1000, text: '第一句', speaker: '甲' },
    { id: 's2', start: 1100, end: 2000, text: '第二句' },
  ]);
  await page.getByTestId('json-input').fill(withSpeaker);
  await expect(page.getByTestId('error-panel')).toBeVisible();
  await expect(page.getByTestId('error-panel')).toContainText('speaker');
  await expect(page.locator('[data-testid="segment-rect"]')).toHaveCount(0);
  await expect(page.getByTestId('conclusion')).toHaveCount(0);
});

test('字段缺失与时间非法均整批拒绝', async ({ page }) => {
  await page
    .getByTestId('json-input')
    .fill(JSON.stringify([{ id: 'a', start: 0, text: 'x' }]));
  await expect(page.getByTestId('error-panel')).toContainText('end');

  await page
    .getByTestId('json-input')
    .fill(JSON.stringify([{ id: 'a', start: 500, end: 500, text: 'x' }]));
  await expect(page.getByTestId('error-panel')).toContainText('end');

  await page.getByTestId('json-input').fill('[{"id":');
  await expect(page.getByTestId('error-panel')).toContainText('JSON 解析失败');
});

test('时间轴可缩放并可重置', async ({ page }) => {
  await page.getByTestId('json-input').fill(OK_JSON);
  const rect = page.locator('[data-testid="segment-rect"][data-id="s1"] rect');
  await expect(rect).toBeVisible();

  const w1 = Number(await rect.getAttribute('width'));
  await page.getByTestId('zoom-in').click();
  const w2 = Number(await rect.getAttribute('width'));
  expect(w2).toBeGreaterThan(w1);

  await page.getByTestId('zoom-out').click();
  await page.getByTestId('zoom-reset').click();
  const w3 = Number(await rect.getAttribute('width'));
  expect(w3).toBeCloseTo(w1, 1);
});

test('鼠标点击选中片段并展示完整详情', async ({ page }) => {
  await page.getByTestId('json-input').fill(OK_JSON);
  const seg = page.locator('[data-testid="segment-rect"][data-id="s2"]');

  await expect(page.getByTestId('segment-details')).toHaveCount(0);
  await seg.click();

  await expect(seg).toHaveAttribute('data-selected', 'true');
  await expect(seg).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('detail-id')).toHaveText('s2');
  await expect(page.getByTestId('detail-start')).toHaveText('1100');
  await expect(page.getByTestId('detail-end')).toHaveText('2000');
  await expect(page.getByTestId('detail-duration')).toHaveText('900');
  await expect(page.getByTestId('detail-text')).toHaveText('第二句');
});

test('键盘左右方向键按稳定排序切换，边界不循环并给出提示', async ({ page }) => {
  await page.getByTestId('json-input').fill(OK_JSON);
  await page.locator('[data-testid="segment-rect"][data-id="s1"]').click();
  await expect(page.getByTestId('detail-id')).toHaveText('s1');

  // 首条继续向左：不循环，提示已到首条
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('nav-hint')).toHaveText('已到首条');
  await expect(page.getByTestId('detail-id')).toHaveText('s1');

  // 向右依次切换 s1 → s2 → s3，提示随之清除
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('detail-id')).toHaveText('s2');
  await expect(page.getByTestId('nav-hint')).toHaveText('');
  await expect(
    page.locator('[data-testid="segment-rect"][data-id="s2"]'),
  ).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('detail-id')).toHaveText('s3');

  // 末条继续向右：不循环，提示已到末条
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('nav-hint')).toHaveText('已到末条');
  await expect(page.getByTestId('detail-id')).toHaveText('s3');

  // 向左回到 s2
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('detail-id')).toHaveText('s2');
});

test('问题结论中的双方 id 可直接选中对应片段并继续键盘核对', async ({ page }) => {
  const json = JSON.stringify([
    { id: 'a', start: 0, end: 2500, text: '旁白一' },
    { id: 'b', start: 2000, end: 3000, text: '旁白二' },
  ]);
  await page.getByTestId('json-input').fill(json);

  await page.getByTestId('problem-id-b').click();
  await expect(page.getByTestId('detail-id')).toHaveText('b');
  await expect(page.getByTestId('detail-text')).toHaveText('旁白二');
  // 焦点落在对应片段上，可直接继续方向键核对相邻片段
  await expect(page.locator('[data-testid="segment-rect"][data-id="b"]')).toBeFocused();

  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('detail-id')).toHaveText('a');

  await page.getByTestId('problem-id-a').click();
  await expect(page.getByTestId('detail-id')).toHaveText('a');
  await expect(page.getByTestId('detail-text')).toHaveText('旁白一');
});

test('选中时保持缩放比例并自动平移完整露出目标', async ({ page }) => {
  const json = JSON.stringify([
    { id: 'a', start: 0, end: 50000, text: '长旁白' },
    { id: 'b', start: 49000, end: 60000, text: '重叠句' },
  ]);
  await page.getByTestId('json-input').fill(json);

  // 放大数倍，使片段 b 移出可视窗口
  for (let i = 0; i < 4; i++) await page.getByTestId('zoom-in').click();
  const bRect = page.locator('[data-testid="segment-rect"][data-id="b"] rect');
  const widthBefore = Number(await bRect.getAttribute('width'));

  await page.getByTestId('problem-id-b').click();
  await expect(page.getByTestId('detail-id')).toHaveText('b');

  // 缩放比例不变（同样的毫秒跨度渲染为同样的像素宽度）
  const widthAfter = Number(await bRect.getAttribute('width'));
  expect(widthAfter).toBeCloseTo(widthBefore, 5);

  // 视口已平移到完整露出 b（按 viewBox 几何判定，不受选中描边影响）
  const viewBox = await page.locator('.timeline svg').getAttribute('viewBox');
  const svgWidth = Number(viewBox!.split(' ')[2]);
  await expect(async () => {
    const x = Number(await bRect.getAttribute('x'));
    const w = Number(await bRect.getAttribute('width'));
    expect(x).toBeGreaterThanOrEqual(-0.01);
    expect(x + w).toBeLessThanOrEqual(svgWidth + 0.01);
  }).toPass();
});

test('拖拽平移与点击选中互不干扰', async ({ page }) => {
  await page.getByTestId('json-input').fill(OK_JSON);
  const label = page.locator('.view-label');
  await page.getByTestId('zoom-in').click();
  await page.getByTestId('zoom-in').click();
  const before = await label.textContent();

  // 拖拽：视口平移，不产生选中
  const svg = page.locator('.timeline svg');
  const box = await svg.boundingBox();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + 30;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 120, cy, { steps: 5 });
  await page.mouse.up();
  expect(await label.textContent()).not.toBe(before);
  await expect(page.getByTestId('segment-details')).toHaveCount(0);

  // 原地点击（位移小于拖拽阈值）：选中片段，视口不再移动
  const afterDrag = await label.textContent();
  await page.locator('[data-testid="segment-rect"][data-id="s2"]').click();
  await expect(page.getByTestId('detail-id')).toHaveText('s2');
  expect(await label.textContent()).toBe(afterDrag);
});

test('输入变化后 id 仍存在则保留选择，失效或清空则撤销详情', async ({ page }) => {
  await page.getByTestId('json-input').fill(OK_JSON);
  await page.locator('[data-testid="segment-rect"][data-id="s2"]').click();
  await expect(page.getByTestId('detail-id')).toHaveText('s2');

  // id 仍存在：保留选择，详情同步为新正文
  const renamed = JSON.stringify([
    { id: 's1', start: 0, end: 1000, text: '第一句' },
    { id: 's2', start: 1100, end: 2000, text: '改后的第二句' },
    { id: 's3', start: 2200, end: 3000, text: '第三句' },
  ]);
  await page.getByTestId('json-input').fill(renamed);
  await expect(page.getByTestId('detail-id')).toHaveText('s2');
  await expect(page.getByTestId('detail-text')).toHaveText('改后的第二句');

  // 目标消失：撤销详情，且 id 再次出现时也不复活
  const withoutS2 = JSON.stringify([
    { id: 's1', start: 0, end: 1000, text: '第一句' },
    { id: 's3', start: 2200, end: 3000, text: '第三句' },
  ]);
  await page.getByTestId('json-input').fill(withoutS2);
  await expect(page.getByTestId('segment-details')).toHaveCount(0);
  await page.getByTestId('json-input').fill(OK_JSON);
  await expect(page.getByTestId('segment-details')).toHaveCount(0);

  // 整批非法：撤销详情
  await page.locator('[data-testid="segment-rect"][data-id="s1"]').click();
  await expect(page.getByTestId('segment-details')).toBeVisible();
  await page.getByTestId('json-input').fill('[{"id":');
  await expect(page.getByTestId('segment-details')).toHaveCount(0);

  // 清空输入：撤销详情
  await page.getByTestId('json-input').fill(OK_JSON);
  await page.locator('[data-testid="segment-rect"][data-id="s1"]').click();
  await expect(page.getByTestId('segment-details')).toBeVisible();
  await page.getByTestId('json-input').fill('');
  await expect(page.getByTestId('segment-details')).toHaveCount(0);
});
