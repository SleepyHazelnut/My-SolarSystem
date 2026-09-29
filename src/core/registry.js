/**
 * 角色注册表 + `[data-character]` 自动挂载。
 *
 * 加一个星球三步：写角色模块、在 `main.js` 里 `registerCharacter` 一行、
 * 在 HTML 里放一个 `<div class="stage" data-character="<名字>"></div>`。
 * 舞台尺寸也写在 register 那一行，不需要在 `style.css` 里配宽度。
 *
 * 注册重名直接抛错；未注册的名字只 warn 并跳过，其余角色照常显示。
 */
const REGISTRY = new Map();

/* 舞台宽度的基准视口（px）。`stageWidth` 只给 px，vw 兜底按此基准换算，不写第二份。
   1333 取自原先 px/vw 成对出现的那几组数。 */
const BASE_VIEWPORT = 1333;

export function registerCharacter(name, mount, meta = {}) {
  if (REGISTRY.has(name)) throw new Error(`角色重名：${name}`);
  REGISTRY.set(name, { mount, meta });
}

/** 写入舞台尺寸与角色专属类名。
 *  · 尺寸写行内样式，`style.css` 里不需要每个角色一条规则；
 *  · 类名 `<名字>-stage` 自动加，`_draft/` 下的探针与调试页靠它选元素。 */
function applyStage(el, name, { viewBox, stageWidth } = {}) {
  el.classList.add(`${name}-stage`);
  if (viewBox) el.style.aspectRatio = `${viewBox[0]} / ${viewBox[1]}`;
  if (stageWidth) {
    const vw = ((stageWidth / BASE_VIEWPORT) * 100).toFixed(2);
    el.style.width = `min(${stageWidth}px, ${vw}vw)`;
  }
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
