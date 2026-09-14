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
