/**
 * 页面入口：注册角色表，挂载 HTML 里所有 `[data-character]`，起轨道摆动。
 *
 * 加一个角色：写 `characters/<名字>/`，在下面 `TABLE` 里加一行，
 * 并在 `index.html` 的 `.hero` 里放一个 `<div class="stage" data-character="<名字>"></div>`
 * （DOM 顺序 = 绘制顺序，后声明者在上）。轨道圈与摆动的父子关系都由表推出。
 */
import { mountAll, registerCharacter } from './core/registry.js';
import { startOrbitDrift } from './core/orbit-drift.js';

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

/* 轨道摆动：角度摆幅（度）/ 基准周期（秒）/ 每颗递增的周期差（秒）。
   摆幅超过 12.9° 土星与天王星会重叠。 */
const DRIFT = { amp: 6, period: 22, spread: 1.6 };

/* 渲染哪几条轨道圈，其余不生成。 */
const RINGS = ['mercury', 'neptune'];

/* 一行一颗：模块 / 轨道半径 ÷ 块半边 / 角度（度）/ 档位；`parent` 是绕谁转，
   `ball` 缺省由 `ballOf` 算，其余几何都从模块自己取。 */
const TABLE = [
  { name: 'sun', mod: sun, ball: SUN_BALL },
  { name: 'mercury', mod: mercury, orbit: 0.60070, angle: 29.21, step: 2 },
  { name: 'venus', mod: venus, orbit: 0.66837, angle: 334.28, step: 3 },
  { name: 'earth', mod: earth, orbit: 0.73514, angle: 133.19, step: 4 },
  { name: 'moon', mod: moon, orbit: 0.28293, angle: 209.25, step: 0, parent: 'earth' },
  { name: 'mars', mod: mars, orbit: 0.82406, angle: 240.72, step: 4 },
  { name: 'jupiter', mod: jupiter, orbit: 1.17248, angle: 318.95, step: 1 },
  { name: 'saturn', mod: saturn, orbit: 1.27921, angle: 177.29, step: 1 },
  { name: 'uranus', mod: uranus, orbit: 1.41253, angle: 222.61, step: 2 },
  { name: 'neptune', mod: neptune, orbit: 1.47997, angle: 30.26, step: 2 },
];

/* 球心在 viewBox 内的坐标 = 局部原点落点 + 球心偏移 − viewBox 左上角。 */
const pivot = (view, pos, bodyC) => [pos.x + bodyC.x - view.minX, pos.y + bodyC.y - view.minY];

const hero = document.querySelector('.hero');

document.documentElement.style.setProperty('--hero-max', HERO_MAX + 'px');

/* 轨道圈：只生成 `RINGS` 里的，插在 `.hero` 最前面 → 在球下面。 */
const frag = document.createDocumentFragment();
for (const { name } of TABLE) {
  if (!RINGS.includes(name)) continue;
  const el = document.createElement('div');
  el.className = 'orbit';
  el.dataset.orbit = name;
  frag.appendChild(el);
}
hero.prepend(frag);

for (const { name, mod, orbit, angle, step, parent, ball } of TABLE) {
  const { VIEW, ORIGIN, BODY_C, BALL_D, mount } = mod;
  registerCharacter(name, mount, {
    viewBox: [VIEW.w, VIEW.h],
    ball: ball ?? ballOf(name),
    ballD: BALL_D,
    scale: SCALE_STEP ** (step || 0),
    pivot: pivot(VIEW, ORIGIN, BODY_C),
    ...(orbit === undefined ? {} : { orbit, angle, parent }),
  });
}

const { mounted, layout } = mountAll();

const drift = startOrbitDrift({ items: layout, ...DRIFT });

/* 暴露到 window：回归脚本靠它读状态 */
for (const { name, instance } of mounted) window[name] = instance;

// 热更新时先拆干净
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    drift.destroy();
    mounted.forEach(({ instance }) => instance.destroy());
  });
}
