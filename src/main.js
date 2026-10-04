/**
 * 页面入口：注册角色，挂载 HTML 里所有 `[data-character]`。
 *
 * 加一个星球：写 `characters/<名字>/`，在下面 `registerCharacter` 一行，
 * 并在 `index.html` 里放一个 `<div class="stage" data-character="<名字>"></div>`
 * 与一个 `<div class="orbit" data-orbit="<名字>"></div>`。
 */
import { mountAll, registerCharacter } from './core/registry.js';
import { startOrbitDrift } from './core/orbit-drift.js';

import { BODY_C as SUN_C, SUN, VIEW as SUN_VIEW } from './characters/sun/anim.js';
import { mountSun } from './characters/sun/index.js';
import { BODY_C as MERCURY_C, MERCURY, VIEW as MERCURY_VIEW } from './characters/mercury/anim.js';
import { mountMercury } from './characters/mercury/index.js';
import { BODY_C as VENUS_C, VENUS, VIEW as VENUS_VIEW } from './characters/venus/anim.js';
import { mountVenus } from './characters/venus/index.js';
import { BODY_C as EARTH_C, EARTH, VIEW as EARTH_VIEW } from './characters/earth/anim.js';
import { mountEarth } from './characters/earth/index.js';
import { BODY_C as MOON_C, MOON, VIEW as MOON_VIEW } from './characters/moon/anim.js';
import { mountMoon } from './characters/moon/index.js';
import { BODY_C as MARS_C, MARS, VIEW as MARS_VIEW } from './characters/mars/anim.js';
import { mountMars } from './characters/mars/index.js';
import { BODY_C as JUPITER_C, JUPITER, VIEW as JUPITER_VIEW } from './characters/jupiter/anim.js';
import { mountJupiter } from './characters/jupiter/index.js';
import { BODY_C as SATURN_C, SATURN, VIEW as SATURN_VIEW } from './characters/saturn/anim.js';
import { mountSaturn } from './characters/saturn/index.js';
import { BODY_C as URANUS_C, URANUS, VIEW as URANUS_VIEW } from './characters/uranus/anim.js';
import { mountUranus } from './characters/uranus/index.js';
import { BODY_C as NEPTUNE_C, NEPTUNE, VIEW as NEPTUNE_VIEW } from './characters/neptune/anim.js';
import { mountNeptune } from './characters/neptune/index.js';

/* 整块边长上限（px）。块边长 = min(容器宽, 这个值, 容器高)，位置与尺寸都以它为分母。 */
const HERO_MAX = 640;

/* 球屏幕径（标称 px，块边长 864 下）：地球 99.4，其余按真实半径的 0.3 次幂压。
   太阳是地球的 109 倍、线性放不下，单独给。 */
const EARTH_BALL = 99.4;
const SUN_BALL = 238.5;
const BALL_EXP = 0.3;
const R_KM = {
  mercury: 2439.7, venus: 6051.8, earth: 6371.0, moon: 1737.4, mars: 3389.5,
  jupiter: 69911, saturn: 58232, uranus: 25559, neptune: 24622,
};
const ballOf = (name) => EARTH_BALL * (R_KM[name] / R_KM.earth) ** BALL_EXP;

/* 球心在 viewBox 内的坐标 = 局部原点落点 + 球心偏移 − viewBox 左上角。 */
const pivot = (view, pos, bodyC) => [pos.x + bodyC.x - view.minX, pos.y + bodyC.y - view.minY];

/* 轨道半径 ÷ 块半边（块边长 864）。月球那条是相对地球的。 */
const ORBIT = {
  mercury: 0.60070, venus: 0.66837, earth: 0.73514, mars: 0.82406,
  jupiter: 1.17248, saturn: 1.27921, uranus: 1.41253, neptune: 1.47997,
  moon: 0.28293,
};

/* 角度（度）：0° 指向右，顺时针为正。 */
const ANGLE = {
  mercury: 29.21, venus: 334.28, earth: 133.19, mars: 240.72, jupiter: 318.95,
  saturn: 177.29, uranus: 222.61, neptune: 30.26, moon: 209.25,
};

/* 每颗的额外视觉缩放，乘在 `ballOf` 的球径上。 */
const SCALE = {
  mercury: 1.2712, venus: 1.4333, earth: 1.6161, moon: 1, mars: 1.6161,
  jupiter: 1.1275, saturn: 1.1275, uranus: 1.2712, neptune: 1.2712,
};

/* 轨道摆动：角度摆幅（度）/ 基准周期（秒）/ 每颗递增的周期差（秒）。
   摆幅超过 12.9° 土星与天王星会重叠。 */
const DRIFT = { amp: 6, period: 22, spread: 1.6 };

/* 渲染哪几条轨道圈，其余从 DOM 摘掉。 */
const RINGS = ['mercury', 'neptune'];

const BALL = (name) => (name === 'sun' ? SUN_BALL : ballOf(name));

document.documentElement.style.setProperty('--hero-max', HERO_MAX + 'px');

for (const el of document.querySelectorAll('.orbit')) {
  if (!RINGS.includes(el.dataset.orbit)) el.remove();
}

registerCharacter('sun', mountSun, {
  viewBox: [SUN_VIEW.w, SUN_VIEW.h],
  ball: BALL('sun'), body: 292.4, pivot: pivot(SUN_VIEW, SUN, SUN_C),
});
registerCharacter('mercury', mountMercury, {
  viewBox: [MERCURY_VIEW.w, MERCURY_VIEW.h],
  ball: BALL('mercury'), body: 292.0, pivot: pivot(MERCURY_VIEW, MERCURY, MERCURY_C),
  orbit: ORBIT.mercury, angle: ANGLE.mercury, scale: SCALE.mercury,
});
registerCharacter('venus', mountVenus, {
  viewBox: [VENUS_VIEW.w, VENUS_VIEW.h],
  ball: BALL('venus'), body: 355.5, pivot: pivot(VENUS_VIEW, VENUS, VENUS_C),
  orbit: ORBIT.venus, angle: ANGLE.venus, scale: SCALE.venus,
});
registerCharacter('earth', mountEarth, {
  viewBox: [EARTH_VIEW.w, EARTH_VIEW.h],
  ball: BALL('earth'), body: 340.2, pivot: pivot(EARTH_VIEW, EARTH, EARTH_C),
  orbit: ORBIT.earth, angle: ANGLE.earth, scale: SCALE.earth,
});
registerCharacter('moon', mountMoon, {
  viewBox: [MOON_VIEW.w, MOON_VIEW.h],
  ball: BALL('moon'), body: 317.4, pivot: pivot(MOON_VIEW, MOON, MOON_C),
  orbit: ORBIT.moon, angle: ANGLE.moon, parent: 'earth', scale: SCALE.moon,
});
registerCharacter('mars', mountMars, {
  viewBox: [MARS_VIEW.w, MARS_VIEW.h],
  ball: BALL('mars'), body: 317.29, pivot: pivot(MARS_VIEW, MARS, MARS_C),
  orbit: ORBIT.mars, angle: ANGLE.mars, scale: SCALE.mars,
});
registerCharacter('jupiter', mountJupiter, {
  viewBox: [JUPITER_VIEW.w, JUPITER_VIEW.h],
  ball: BALL('jupiter'), body: 317.4, pivot: pivot(JUPITER_VIEW, JUPITER, JUPITER_C),
  orbit: ORBIT.jupiter, angle: ANGLE.jupiter, scale: SCALE.jupiter,
});
registerCharacter('saturn', mountSaturn, {
  viewBox: [SATURN_VIEW.w, SATURN_VIEW.h],
  ball: BALL('saturn'), body: 317.4, pivot: pivot(SATURN_VIEW, SATURN, SATURN_C),
  orbit: ORBIT.saturn, angle: ANGLE.saturn, scale: SCALE.saturn,
});
registerCharacter('uranus', mountUranus, {
  viewBox: [URANUS_VIEW.w, URANUS_VIEW.h],
  ball: BALL('uranus'), body: 317.4, pivot: pivot(URANUS_VIEW, URANUS, URANUS_C),
  orbit: ORBIT.uranus, angle: ANGLE.uranus, scale: SCALE.uranus,
});
registerCharacter('neptune', mountNeptune, {
  viewBox: [NEPTUNE_VIEW.w, NEPTUNE_VIEW.h],
  ball: BALL('neptune'), body: 317.4, pivot: pivot(NEPTUNE_VIEW, NEPTUNE, NEPTUNE_C),
  orbit: ORBIT.neptune, angle: ANGLE.neptune, scale: SCALE.neptune,
});

const mounted = mountAll();

/* 月球跟着地球平移，不自己摆。 */
const drift = startOrbitDrift({ ...DRIFT, parents: { moon: 'earth' } });

/* 暴露到 window：回归脚本靠它读状态 */
const byName = Object.fromEntries(mounted.map(({ name, instance }) => [name, instance]));
window.sun = byName.sun;
window.earth = byName.earth;
window.mercury = byName.mercury;
window.venus = byName.venus;
window.moon = byName.moon;
window.mars = byName.mars;
window.jupiter = byName.jupiter;
window.saturn = byName.saturn;
window.uranus = byName.uranus;
window.neptune = byName.neptune;

// 热更新时先拆干净
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    drift.destroy();
    mounted.forEach(({ instance }) => instance.destroy());
  });
}
