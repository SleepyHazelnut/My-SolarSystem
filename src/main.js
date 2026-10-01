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

/* `viewBox` 出宽高比，`stageWidth` 是标称宽度上限（px）—— 两者共同决定舞台多大。
   `viewBox` 从各角色的 `anim.js` 取，不在 `scene.js` 里另写一份。
   ⚠️ 三个角色**球体在屏幕上的大小**由「球体直径 / viewBox 宽」× stageWidth 决定：
       太阳 292.4 / 528 × 439 ≈ 243 px（含火焰，本来就大一号）
       地球 340.2 / 386 × 199.4 ≈ 176 px
       月球 317.4 / 362 × 171.1 ≈ 150 px（= 地球的 0.85 倍）
   ⚠️ `stageWidth / viewBox.w` 是**每单位多少 px**，才是真正决定球大小的量。
      改 `VIEW.w`（给按压的横向鼓起留余量）时必须按同一比例改 `stageWidth`，
      这样 `--stage-w` 变了、球在屏幕上的大小不变。 */
registerCharacter('sun', mountSun, { viewBox: [SUN_VIEW.w, SUN_VIEW.h], stageWidth: 439 });
registerCharacter('earth', mountEarth, { viewBox: [EARTH_VIEW.w, EARTH_VIEW.h], stageWidth: 199.4 });
registerCharacter('moon', mountMoon, { viewBox: [MOON_VIEW.w, MOON_VIEW.h], stageWidth: 171.1 });

const mounted = mountAll();

/* 暴露到 window：回归脚本靠它读状态 */
const byName = Object.fromEntries(mounted.map(({ name, instance }) => [name, instance]));
window.sun = byName.sun;
window.earth = byName.earth;
window.moon = byName.moon;

// 热更新时先拆干净，否则会叠出第二个 rAF 循环
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    mounted.forEach(({ instance }) => instance.destroy());
  });
}
