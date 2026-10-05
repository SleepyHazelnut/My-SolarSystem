/**
 * 角色注册表 + `[data-character]` 自动挂载 + 星系轨道布局。
 *
 * 每个角色在 `main.js` 的表里给一行轨道参数，这里换算成 CSS 变量：
 *   `--x` / `--y`   球心在整块里的位置（%）
 *   `--w`           舞台宽（%），已含 `meta.scale`
 *   `--ax` / `--ay` 球心在舞台内的位置（%，负值），用 translate 把它对到 `--x/--y`
 *   `--rot`         球体自转角（度），绕球心
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

/** 写 CSS 变量。
 *  @returns 静止布局 `[{ name, el, x, y, parent }]`，`x` / `y` 是球心在块里的百分数 */
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

  const layout = [];
  for (const { name, el, entry } of targets) {
    const m = meta.get(name);
    const [w = 0, h = 0] = m.viewBox || [];
    const [cx, cy] = pos.get(name);
    const [px, py] = m.pivot || [w / 2, h / 2];
    const x = (half + cx) / S;
    const y = (half + cy) / S;

    el.classList.add(`${name}-stage`);
    if (w && h) el.style.aspectRatio = `${w} / ${h}`;
    el.style.setProperty('--x', pct(x));
    el.style.setProperty('--y', pct(y));
    el.style.setProperty('--w', pct(m.ballD ? (m.ball * (m.scale || 1) * w) / m.ballD / S : 0));
    el.style.setProperty('--ax', pct(-px / w));
    el.style.setProperty('--ay', pct(-py / h));
    el.style.setProperty('--rot', `${m.rot || 0}deg`);

    const orbitEl = orbits.get(name);
    if (orbitEl) {
      /* 轨道圆心是「被绕的那颗」——行星绕太阳（块中心），月球绕地球。 */
      const [ox, oy] = m.parent ? pos.get(m.parent) : [0, 0];
      orbitEl.style.setProperty('--ox', pct((half + ox) / S));
      orbitEl.style.setProperty('--oy', pct((half + oy) / S));
      orbitEl.style.setProperty('--od', pct((2 * (m.orbit || 0) * R) / S));
    }

    layout.push({ name, el, x: x * 100, y: y * 100, parent: m.parent || null });
  }
  return layout;
}

/**
 * 挂载 `scope` 下所有 `[data-character]`。
 * `meta.intro` 原样转给 `mount`（入场形状的覆盖项）。
 * @returns `{ mounted, layout }` —— `mounted` 顺序即 DOM 顺序；`layout` 是静止布局，供 `orbit-drift.js` 吃
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

  const layout = applyLayout(targets, orbits);
  const mounted = targets.map(({ name, el, entry }) => ({
    name, instance: entry.mount(el, { intro: entry.meta.intro }),
  }));
  return { mounted, layout };
}
