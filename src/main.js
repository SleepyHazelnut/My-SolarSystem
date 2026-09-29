/**
 * 页面入口：注册角色，挂载 HTML 里所有 `[data-character]`。
 *
 * 加一个星球：写 `characters/<名字>/`，在下面 `registerCharacter` 一行，
 * 并在 `index.html` 里放一个 `<div class="stage" data-character="<名字>"></div>`。
 */
import { mountAll, registerCharacter } from './core/registry.js';
import { mountSun } from './characters/sun/index.js';

/* `viewBox` 与 `stageWidth` 共同决定舞台在屏幕上的大小：viewBox 出宽高比，
   stageWidth 是宽度上限（px），窄屏的 vw 兜底由 registry 按同一基准换算。
   两者之比 = 屏幕像素 / viewBox 单位，当前 439 / 528 ≈ 0.832。
   ⚠️ 放大太阳只改 `stageWidth`；viewBox 由动作包络推出，改小会裁到火焰。 */
registerCharacter('sun', mountSun, { viewBox: [528, 512], stageWidth: 439 });

const mounted = mountAll();

/* 暴露到 window：回归脚本靠它读状态 */
const byName = Object.fromEntries(mounted.map(({ name, instance }) => [name, instance]));
window.sun = byName.sun;

// 热更新时先拆干净，否则会叠出第二个 rAF 循环
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    mounted.forEach(({ instance }) => instance.destroy());
  });
}
