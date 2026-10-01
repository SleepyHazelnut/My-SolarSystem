/**
 * 角色注册表 + `[data-character]` 自动挂载。
 *
 * 加一个星球三步：写角色模块、在 `main.js` 里 `registerCharacter` 一行、
 * 在 HTML 里放一个 `<div class="stage" data-character="<名字>"></div>`。
 * 标称尺寸写在 register 那一行；**怎么排、窄屏怎么缩**是 `style.css` 的事，
 * 这里只把尺寸转成两个 CSS 变量交出去。
 *
 * 注册重名直接抛错；未注册的名字只 warn 并跳过，其余角色照常显示。
 */
const REGISTRY = new Map();

export function registerCharacter(name, mount, meta = {}) {
  if (REGISTRY.has(name)) throw new Error(`角色重名：${name}`);
  REGISTRY.set(name, { mount, meta });
}

/** 写入角色专属类名与标称尺寸变量。
 *  · 类名 `<名字>-stage` 自动加，`_draft/` 下的探针与调试页靠它选元素；
 *  · `--stage-w` = 标称宽度（px 的**数值**，不带单位）—— 它同时是行布局里分配宽度的
 *    flex 权重与宽度上限，所以不能带单位。高度不写，由 `style.css` 的 `aspect-ratio`
 *    从宽度反推。
 *  ⚠️ 窄屏兜底不在这里：`style.css` 按视口宽高整体缩，三个角色的相对大小才不会走形。 */
function applyStage(el, name, { viewBox, stageWidth } = {}) {
  el.classList.add(`${name}-stage`);
  if (!viewBox) return;
  const [w, h] = viewBox;
  el.style.aspectRatio = `${w} / ${h}`;
  if (stageWidth) el.style.setProperty('--stage-w', String(+stageWidth.toFixed(1)));
}

/**
 * 挂载 `scope` 下所有 `[data-character]`。
 * @returns `[{ name, instance }, …]` —— 顺序即 DOM 顺序
 */
export function mountAll(scope = document) {
  const mounted = [];
  for (const el of scope.querySelectorAll('[data-character]')) {
    const name = el.dataset.character;
    const entry = REGISTRY.get(name);
    if (!entry) {
      console.warn(`[registry] 未注册的角色「${name}」，跳过`);
      continue;
    }
    applyStage(el, name, entry.meta);
    mounted.push({ name, instance: entry.mount(el) });
  }
  return mounted;
}
