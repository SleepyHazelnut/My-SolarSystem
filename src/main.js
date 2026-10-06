/**
 * 页面入口：注册角色表，挂载 HTML 里所有 `[data-character]`。
 *
 * 加一个角色：写 `characters/<名字>/`，在下面 `TABLE` 里加一行，
 * 并在 `index.html` 的 `.hero` 里放一个 `<div class="stage" data-character="<名字>"></div>`
 * （DOM 顺序 = 绘制顺序，后声明者在上）。
 */
import { mountAll, registerCharacter } from './core/registry.js';

import * as sun from './characters/sun/index.js';
import * as mercury from './characters/mercury/index.js';
import * as venus from './characters/venus/index.js';
import * as earth from './characters/earth/index.js';
import * as moon from './characters/moon/index.js';
import * as mars from './characters/mars/index.js';
import * as jupiter from './characters/jupiter/index.js';
import * as saturn from './characters/saturn/index.js';
import * as uranus from './characters/uranus/index.js';
import * as neptune from './characters/neptune/index.js';

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

/* 视觉档位：每颗的额外缩放 = `SCALE_STEP` 的 `step` 次幂，乘在 `ballOf` 的球径上。 */
const SCALE_STEP = 1.1275;

/* 入场错开：太阳先落，其余按下面 `TABLE` 的顺序（由内向外）依次跟上。
   `INTRO_LEAD` = 太阳单独领先的秒数，`INTRO_STEP` = 相邻两颗的间隔（秒）；
   形状（`dur` / `fromScale` / `dy`）每颗不同，写在 `TABLE` 各行里。 */
const INTRO_LEAD = 0.30;
const INTRO_STEP = 0.13;

/* 一行一颗：模块 / 轨道半径 ÷ 块半边 / 角度（度）/ 档位；`parent` 是绕谁转，
   `ball` 缺省由 `ballOf` 算，`rot` 是球体自转角（度，绕球心），
   `intro` 是该颗的入场形状（缺省项见 `shared/intro.js`），其余几何都从模块自己取。
   半径、角度、自转都是手摆的，不做等分。 */
const TABLE = [
  { name: 'sun', mod: sun, ball: SUN_BALL, rot: -1.1, intro: { dur: 0.66, fromScale: 0.58, dy: 30 } },
  { name: 'mercury', mod: mercury, orbit: 0.71850, angle: 29.21, step: 2, rot: 2.9, intro: { dur: 0.54, fromScale: 0.68, dy: 34 } },
  { name: 'venus', mod: venus, orbit: 0.77050, angle: 334.28, step: 3, rot: -3.4, intro: { dur: 0.62, fromScale: 0.60, dy: 26 } },
  { name: 'earth', mod: earth, orbit: 0.86300, angle: 133.19, step: 4, rot: 1.7, intro: { dur: 0.58, fromScale: 0.66, dy: 33 } },
  { name: 'moon', mod: moon, orbit: 0.30164, angle: 209.25, step: 0, parent: 'earth', rot: -4.0, intro: { dur: 0.68, fromScale: 0.56, dy: 28 } },
  { name: 'mars', mod: mars, orbit: 0.92250, angle: 240.72, step: 4, rot: 3.4, intro: { dur: 0.56, fromScale: 0.64, dy: 31 } },
  { name: 'jupiter', mod: jupiter, orbit: 1.30000, angle: 318.95, step: 1, rot: -1.7, intro: { dur: 0.70, fromScale: 0.62, dy: 27 } },
  { name: 'saturn', mod: saturn, orbit: 1.22804, angle: 177.29, step: 1, rot: 2.3, intro: { dur: 0.60, fromScale: 0.57, dy: 34 } },
  { name: 'uranus', mod: uranus, orbit: 1.39134, angle: 222.61, step: 2, rot: -2.9, intro: { dur: 0.64, fromScale: 0.67, dy: 29 } },
  { name: 'neptune', mod: neptune, orbit: 1.43557, angle: 30.26, step: 2, rot: 1.1, intro: { dur: 0.55, fromScale: 0.61, dy: 32 } },
];

/* 球心在 viewBox 内的坐标 = 局部原点落点 + 球心偏移 − viewBox 左上角。 */
const pivot = (view, pos, bodyC) => [pos.x + bodyC.x - view.minX, pos.y + bodyC.y - view.minY];

document.documentElement.style.setProperty('--hero-max', HERO_MAX + 'px');

for (const [i, { name, mod, orbit, angle, step, parent, ball, rot, intro }] of TABLE.entries()) {
  const { VIEW, ORIGIN, BODY_C, BALL_D, mount } = mod;
  registerCharacter(name, mount, {
    viewBox: [VIEW.w, VIEW.h],
    ball: ball ?? ballOf(name),
    ballD: BALL_D,
    scale: SCALE_STEP ** (step || 0),
    rot,
    pivot: pivot(VIEW, ORIGIN, BODY_C),
    intro: { ...intro, delay: i ? INTRO_LEAD + (i - 1) * INTRO_STEP : 0 },
    ...(orbit === undefined ? {} : { orbit, angle, parent }),
  });
}

/* ---------- 背景星点 ---------- */

/* 固定种子，生成一次，之后不再动。 */
const STAR_SEED = 20261010;
const DOT_N = 56;
const SPARK_N = 6;

/* 四角星的单位路径（半径 1），靠 transform 缩放。 */
const SPARK = 'M0 -1Q0.26 -0.26 1 0Q0.26 0.26 0 1Q-0.26 0.26 -1 0Q-0.26 -0.26 0 -1Z';

const rand = (() => {
  let a = STAR_SEED;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();

const r1 = (v) => v.toFixed(1);
const marks = [];
for (let i = 0; i < DOT_N; i++) {
  marks.push(
    `<circle cx="${r1(rand() * 1920)}" cy="${r1(rand() * 1080)}" r="${r1(1.6 + rand() * 2.6)}" ` +
      `opacity="${(0.16 + rand() * 0.26).toFixed(2)}"/>`,
  );
}
for (let i = 0; i < SPARK_N; i++) {
  marks.push(
    `<path d="${SPARK}" transform="translate(${r1(rand() * 1920)} ${r1(rand() * 1080)}) ` +
      `scale(${r1(11 + rand() * 8)})" opacity="${(0.20 + rand() * 0.20).toFixed(2)}"/>`,
  );
}

const stars = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
stars.setAttribute('class', 'stars');
stars.setAttribute('viewBox', '0 0 1920 1080');
stars.setAttribute('preserveAspectRatio', 'xMidYMid slice');
stars.setAttribute('aria-hidden', 'true');
stars.innerHTML = marks.join('');
document.body.prepend(stars);

const { mounted } = mountAll();

/* 暴露到 window：回归脚本靠它读状态 */
for (const { name, instance } of mounted) window[name] = instance;

// 热更新时先拆干净
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    mounted.forEach(({ instance }) => instance.destroy());
  });
}
