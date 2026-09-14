// 等待 web 服务就绪（verify 一次性验收服务在 docker compose 网络中使用）
const base = process.env.BASE_URL || 'http://localhost:8080';
const deadline = Date.now() + 90_000;
let lastErr;

while (Date.now() < deadline) {
  try {
    const res = await fetch(base, { method: 'GET' });
    if (res.ok) {
      console.log(`web 服务就绪：${base}`);
      process.exit(0);
    }
    lastErr = new Error(`HTTP ${res.status}`);
  } catch (err) {
    lastErr = err;
  }
  await new Promise((r) => setTimeout(r, 1000));
}

console.error(`等待 ${base} 超时`, lastErr ?? '');
process.exit(1);
