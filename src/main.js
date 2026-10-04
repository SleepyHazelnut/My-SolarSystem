/**
 * 页面入口：注册角色，挂载 HTML 里所有 `[data-character]`。
 *
 * 加一个星球：写 `characters/<名字>/`，在下面 `registerCharacter` 一行，
 * 并在 `index.html` 里放一个 `<div class="stage" data-character="<名字>"></div>`
 * 与一个 `<div class="orbit" data-orbit="<名字>"></div>`。
 */
import { mountAll, registerCharacter } from './core/registry.js';
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

/* 球屏幕径（标称 px，块边长 864 下）：地球 149.6，其余按真实半径的 0.5 次幂压。
   太阳是地球的 109 倍、线性放不下，单独给。 */
const EARTH_BALL = 149.6;
const SUN_BALL = 272;
const R_KM = {
  mercury: 2439.7, venus: 6051.8, earth: 6371.0, moon: 1737.4, mars: 3389.5,
  jupiter: 69911, saturn: 58232, uranus: 25559, neptune: 24622,
};
const ballOf = (name) => EARTH_BALL * (R_KM[name] / R_KM.earth) ** 0.5;

/* 球心在 viewBox 内的坐标 = 局部原点落点 + 球心偏移 − viewBox 左上角。 */
const pivot = (view, pos, bodyC) => [pos.x + bodyC.x - view.minX, pos.y + bodyC.y - view.minY];

/* 轨道半径（归一化，最外的海王星 = 1）：真实半长轴开方后按海王星归一。
   基准 R = 块半边 − 海王星球半径；月球是相对地球的「地球半径 + 月球半径 + 间隙」。 */
const R_BASE = 432 - ballOf('neptune') / 2;
const MOON_GAP = 6;
const ORBIT = {
  mercury: 0.11345, venus: 0.15506, earth: 0.18236, mars: 0.22512,
  jupiter: 0.41597, saturn: 0.56317, uranus: 0.79887, neptune: 1.0,
  moon: (ballOf('earth') / 2 + ballOf('moon') / 2 + MOON_GAP) / R_BASE,
};

/* 角度（度）：0° 指向右，顺时针为正。各角色错开。 */
const ANGLE = {
  mercury: -50, venus: 160, earth: 25, mars: 205, moon: -40,
  jupiter: 100, saturn: -135, uranus: 60, neptune: -170,
};

registerCharacter('sun', mountSun, {
  viewBox: [SUN_VIEW.w, SUN_VIEW.h],
  ball: SUN_BALL, body: 292.4, pivot: pivot(SUN_VIEW, SUN, SUN_C),
});
registerCharacter('mercury', mountMercury, {
  viewBox: [MERCURY_VIEW.w, MERCURY_VIEW.h],
  ball: ballOf('mercury'), body: 292.0, pivot: pivot(MERCURY_VIEW, MERCURY, MERCURY_C),
  orbit: ORBIT.mercury, angle: ANGLE.mercury,
});
registerCharacter('venus', mountVenus, {
  viewBox: [VENUS_VIEW.w, VENUS_VIEW.h],
  ball: ballOf('venus'), body: 355.5, pivot: pivot(VENUS_VIEW, VENUS, VENUS_C),
  orbit: ORBIT.venus, angle: ANGLE.venus,
});
registerCharacter('earth', mountEarth, {
  viewBox: [EARTH_VIEW.w, EARTH_VIEW.h],
  ball: ballOf('earth'), body: 340.2, pivot: pivot(EARTH_VIEW, EARTH, EARTH_C),
  orbit: ORBIT.earth, angle: ANGLE.earth,
});
registerCharacter('moon', mountMoon, {
  viewBox: [MOON_VIEW.w, MOON_VIEW.h],
  ball: ballOf('moon'), body: 317.4, pivot: pivot(MOON_VIEW, MOON, MOON_C),
  orbit: ORBIT.moon, angle: ANGLE.moon, parent: 'earth',
});
registerCharacter('mars', mountMars, {
  viewBox: [MARS_VIEW.w, MARS_VIEW.h],
  ball: ballOf('mars'), body: 317.29, pivot: pivot(MARS_VIEW, MARS, MARS_C),
  orbit: ORBIT.mars, angle: ANGLE.mars,
});
registerCharacter('jupiter', mountJupiter, {
  viewBox: [JUPITER_VIEW.w, JUPITER_VIEW.h],
  ball: ballOf('jupiter'), body: 317.4, pivot: pivot(JUPITER_VIEW, JUPITER, JUPITER_C),
  orbit: ORBIT.jupiter, angle: ANGLE.jupiter,
});
registerCharacter('saturn', mountSaturn, {
  viewBox: [SATURN_VIEW.w, SATURN_VIEW.h],
  ball: ballOf('saturn'), body: 317.4, pivot: pivot(SATURN_VIEW, SATURN, SATURN_C),
  orbit: ORBIT.saturn, angle: ANGLE.saturn,
});
registerCharacter('uranus', mountUranus, {
  viewBox: [URANUS_VIEW.w, URANUS_VIEW.h],
  ball: ballOf('uranus'), body: 317.4, pivot: pivot(URANUS_VIEW, URANUS, URANUS_C),
  orbit: ORBIT.uranus, angle: ANGLE.uranus,
});
registerCharacter('neptune', mountNeptune, {
  viewBox: [NEPTUNE_VIEW.w, NEPTUNE_VIEW.h],
  ball: ballOf('neptune'), body: 317.4, pivot: pivot(NEPTUNE_VIEW, NEPTUNE, NEPTUNE_C),
  orbit: ORBIT.neptune, angle: ANGLE.neptune,
});

const mounted = mountAll();

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
    mounted.forEach(({ instance }) => instance.destroy());
  });
}
