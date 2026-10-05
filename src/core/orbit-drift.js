/**
 * 轨道摆动：每颗行星在自己角度附近做小幅正弦摆动。
 *
 * 吃 `registry.js` 算出的静止布局（球心在块里的百分数与父子关系），逐帧改写 `--x` / `--y`。
 * 半径不变，只动角度 —— 摆幅上限见 `src/main.js` 的 `DRIFT`。
 *
 * 参数：
 *   `items`   `[{ name, el, x, y, parent }]`，顺序决定周期递增
 *   `amp`     角度摆幅（度）
 *   `period`  基准周期（秒），整圈来回一次
 *   `spread`  每颗递增的周期差（秒），错开节奏
 */
import gsap from 'gsap';

export function startOrbitDrift({ items: rows = [], amp = 6, period = 22, spread = 1.6 } = {}) {
  const items = [];
  let i = 0;

  for (const row of rows) {
    const dx = row.x - 50;
    const dy = row.y - 50;
    const r = Math.hypot(dx, dy);
    if (r < 1e-3) continue;                       /* 落在块中心的那颗没有轨道 */

    items.push({
      name: row.name,
      el: row.el,
      x: row.x,
      y: row.y,
      a: Math.atan2(dy, dx),
      r,
      w: (Math.PI * 2) / (period + i * spread),
      parent: row.parent,
    });
    i += 1;
  }

  const write = (it, x, y) => {
    it.el.style.setProperty('--x', x.toFixed(4) + '%');
    it.el.style.setProperty('--y', y.toFixed(4) + '%');
  };

  function tick(time) {
    const shift = new Map();

    for (const it of items) {
      if (it.parent) continue;
      const a = it.a + (amp * Math.sin(time * it.w) * Math.PI) / 180;
      const x = 50 + it.r * Math.cos(a);
      const y = 50 + it.r * Math.sin(a);
      write(it, x, y);
      shift.set(it.name, [x - it.x, y - it.y]);
    }

    for (const it of items) {
      if (!it.parent) continue;
      const [sx, sy] = shift.get(it.parent) || [0, 0];
      write(it, it.x + sx, it.y + sy);
    }
  }

  gsap.ticker.add(tick);
  return { destroy: () => gsap.ticker.remove(tick) };
}
