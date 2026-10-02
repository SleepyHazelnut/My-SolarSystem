/**
 * 页面入口：注册角色，挂载 HTML 里所有 `[data-character]`。
 *
 * 加一个星球：写 `characters/<名字>/`，在下面 `registerCharacter` 一行，
 * 并在 `index.html` 里放一个 `<div class="stage" data-character="<名字>"></div>`。
 */
import { mountAll, registerCharacter } from './core/registry.js';
import { VIEW as SUN_VIEW } from './characters/sun/anim.js';
import { mountSun } from './characters/sun/index.js';
import { VIEW as EARTH_VIEW } from './characters/earth/anim.js';
import { mountEarth } from './characters/earth/index.js';
import { VIEW as MOON_VIEW } from './characters/moon/anim.js';
import { mountMoon } from './characters/moon/index.js';

/* 标称尺寸 —— `registry.js` 按它换算整行比例：
     `viewBox` 舞台形状 ｜ `stageWidth` 舞台宽（px）｜ `ink` 墨迹宽（viewBox 单位，非透明像素的横向范围）
   墨迹屏宽 = `ink` / `viewBox.w` × `stageWidth`：
     太阳 471.9/528×439 ≈ 392 ｜ 地球 341.9/386×199.4 ≈ 177 ｜ 月球 316.8/362×171.1 ≈ 150
   ⚠️ 改 `VIEW.w` 时同比例改 `stageWidth` 与 `ink`；换素材后重测 `ink`。 */
registerCharacter('sun', mountSun, { viewBox: [SUN_VIEW.w, SUN_VIEW.h], stageWidth: 439, ink: 471.9 });
registerCharacter('earth', mountEarth, { viewBox: [EARTH_VIEW.w, EARTH_VIEW.h], stageWidth: 199.4, ink: 341.9 });
registerCharacter('moon', mountMoon, { viewBox: [MOON_VIEW.w, MOON_VIEW.h], stageWidth: 171.1, ink: 316.8 });

const mounted = mountAll();

/* 暴露到 window：回归脚本靠它读状态 */
const byName = Object.fromEntries(mounted.map(({ name, instance }) => [name, instance]));
window.sun = byName.sun;
window.earth = byName.earth;
window.moon = byName.moon;

// 热更新时先拆干净
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    mounted.forEach(({ instance }) => instance.destroy());
  });
}
