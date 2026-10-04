/**
 * 角色注册表 + `[data-character]` 自动挂载 + 星系轨道布局。
 *
 * 每个角色在 `main.js` 的 register 那一行给一组轨道参数，这里换算成 CSS 变量：
 *   `--x` / `--y`   球心在整块里的位置（%）
 *   `--w`           舞台宽（%），已含 `meta.scale`
 *   `--ax` / `--ay` 球心在舞台内的位置（%，负值），用 translate 把它对到 `--x/--y`
 * 轨道圈接在 `[data-orbit="<名字>"]` 上：`--ox` / `--oy`（圆心）、`--od`（直径）。
 *
 * 轨道半径的基准 `R` = 块半边。
 */

/* 标称块边长（px）。球径与轨道半径都以它为基准，整块随视口等比缩放。 */
const STAGE = 864;

const REGISTRY = new Map();

export function registerCharacter(name, mount, meta = {}) {
  if (REGISTRY.has(name)) throw new Error(`角色重名：${name}`);
  REGISTRY.set(name, { mount, meta });
}

const pct = (v) => `${(v * 100).toFixed(4)}%`;

/* 极坐标 → 直角坐标。角度单位是度，0° 指向右，顺时针为正。 */
function polar(r, angle) {
  const t = (angle * Math.PI) / 180;
  return [r * Math.cos(t), r * Math.sin(t)];
}

function applyLayout(targets, orbits) {
  const S = STAGE;
  const half = S / 2;
  const meta = new Map(targets.map(({ name, entry }) => [name, entry.meta || {}]));

  /* 轨道半径的基准 = 块半边。球不超出块由 `ORBIT` / `ANGLE` 的取值保证。 */
  const R = half;

  /* 球心位置（px，相对块中心）。带 `parent` 的叠在父角色上（月球绕地球）。 */
  const pos = new Map();
  const resolve = (name) => {
    if (pos.has(name)) return pos.get(name);
    const m = meta.get(name) || {};
    const o = m.orbit || 0;
    let v = [0, 0];
    if (o) {
      const [dx, dy] = polar(o * R, m.angle || 0);
      const p = m.parent ? resolve(m.parent) : [0, 0];
      v = [p[0] + dx, p[1] + dy];
    }
    pos.set(name, v);
    return v;
  };
  for (const [name] of meta) resolve(name);

  for (const { name, el, entry } of targets) {
    const m = meta.get(name);
    const [w = 0, h = 0] = m.viewBox || [];
    const [cx, cy] = pos.get(name);
    const [px, py] = m.pivot || [w / 2, h / 2];

    el.classList.add(`${name}-stage`);
    if (w && h) el.style.aspectRatio = `${w} / ${h}`;
    el.style.setProperty('--x', pct((half + cx) / S));
    el.style.setProperty('--y', pct((half + cy) / S));
    el.style.setProperty('--w', pct(m.body ? (m.ball * (m.scale || 1) * w) / m.body / S : 0));
    el.style.setProperty('--ax', pct(-px / w));
    el.style.setProperty('--ay', pct(-py / h));

    const orbitEl = orbits.get(name);
    if (orbitEl) {
      /* 轨道圆心是「被绕的那颗」——行星绕太阳（块中心），月球绕地球。 */
      const [ox, oy] = m.parent ? pos.get(m.parent) : [0, 0];
      orbitEl.style.setProperty('--ox', pct((half + ox) / S));
      orbitEl.style.setProperty('--oy', pct((half + oy) / S));
      orbitEl.style.setProperty('--od', pct((2 * (m.orbit || 0) * R) / S));
    }
  }
}

/**
 * 挂载 `scope` 下所有 `[data-character]`。
 * @returns `[{ name, instance }, …]` —— 顺序即 DOM 顺序
 */
export function mountAll(scope = document) {
  const targets = [];
  for (const el of scope.querySelectorAll('[data-character]')) {
    const name = el.dataset.character;
    const entry = REGISTRY.get(name);
    if (!entry) {
      console.warn(`[registry] 未注册的角色「${name}」，跳过`);
      continue;
    }
    targets.push({ el, name, entry });
  }

  const orbits = new Map();
  for (const el of scope.querySelectorAll('[data-orbit]')) orbits.set(el.dataset.orbit, el);

  applyLayout(targets, orbits);
  return targets.map(({ name, el, entry }) => ({ name, instance: entry.mount(el) }));
}
