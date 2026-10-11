/**
 * 太阳角色：把动画写进 DOM。
 *
 *   scene.js  图层结构（静态）
 *   anim.js   动作参数与几何（姿态由 `core/pose.js` 给出）
 *   本文件    挂载入口：在通用的 `setupPose` 之外，再写本体光晕 / 光环呼吸与摆动 /
 *             星呼吸 / 水滴迸溅 / 星点粒子 / 按压爆发这几层太阳独有的动作
 *
 * 注入 SVG / 入场进度 / 指针输入 / 逐帧时钟 / 首帧 / destroy 都在 `core/character.js`。
 */
import { SVG_SCENE } from './scene.js';
import {
  BODY_C, BODY_PX, createSunAnim, DROP_BURST, FX_BURST, FX_DRIFT_PX, FX_PARTICLE, GLOW,
  HALO_BREATH, HALO_PRESS, HALO_SWAY, HALO_T, mulberry32, STAR_C, STAR_ORIGIN, STAR_PULSE,
} from './anim.js';
import { defineCharacter } from '../../core/character.js';
import { setupPose } from '../../core/apply.js';

function setupSun(root, { reduced = false } = {}) {
  const base = setupPose({ name: 'sun', bodyC: BODY_C, eyes: true })(root);

  const haloBack = root.querySelector('#sunHaloBack');
  const haloFront = root.querySelector('#sunHaloFront');
  const star = root.querySelector('#sunStar');
  const starImg = root.querySelector('#sunStarImg');
  const starGlow = root.querySelector('#sunStarGlow');
  const glow = root.querySelector('#sunGlow');
  const fx = root.querySelector('#sunFx');
  const clickFace = root.querySelector('#sunClickFace');
  const eyes = root.querySelector('#sunEyes');

  /* 水滴：预存各自的中心、径向单位向量（背离星）、外推距离（倍于到星的距离）。 */
  const drops = [...root.querySelectorAll('[data-name^="水滴"]')].map((el) => {
    const x = +el.getAttribute('x'), y = +el.getAttribute('y');
    const w = +el.getAttribute('width'), h = +el.getAttribute('height');
    const cx = x + w / 2, cy = y + h / 2;
    const ux = cx - STAR_C.x, uy = cy - STAR_C.y;
    const len = Math.hypot(ux, uy) || 1;
    return { el, cx, cy, ux: ux / len, uy: uy / len, reach: DROP_BURST.push * len };
  });
  const RISE = DROP_BURST.rise / DROP_BURST.dur;
  const HOLD = (DROP_BURST.rise + DROP_BURST.hold) / DROP_BURST.dur;

  /* 星点：预存各自背离太阳的单位向量。固定种子，逐帧可复现。 */
  const rnd = mulberry32(FX_PARTICLE.seed);
  const pts = [...root.querySelectorAll('[data-name^="星点"]')].map((el) => {
    const x = +el.getAttribute('x'), y = +el.getAttribute('y');
    const w = +el.getAttribute('width'), h = +el.getAttribute('height');
    const ux = x + w / 2 - BODY_PX.x, uy = y + h / 2 - BODY_PX.y;
    const len = Math.hypot(ux, uy) || 1;
    const dur = FX_PARTICLE.dur[0] + rnd() * (FX_PARTICLE.dur[1] - FX_PARTICLE.dur[0]);
    return {
      el, ux: ux / len, uy: uy / len,
      phase: rnd(),
      dur,
      cycle: dur / FX_PARTICLE.duty,
    };
  });

  const f3 = (v) => v.toFixed(3);

  return {
    apply(v, iv) {
      base.apply(v, iv);
      const t = v.t;

      /* 自走的循环动画的总幅度：`prefers-reduced-motion: reduce` 时为 0。
         交互反馈（悬停 / 按压 / 回弹 / 点击表情 / 水滴）不乘它。 */
      const amb = reduced ? 0 : 1;

      /* 点击表情：按住淡入，同时把三态眼压下去。 */
      clickFace.setAttribute('opacity', f3(v.clickW));
      eyes.setAttribute('opacity', f3(1 - v.clickW));

      /* 本体光晕：按住时跟着变亮。 */
      glow.setAttribute('opacity', f3(GLOW.opacity + (1 - GLOW.opacity) * 0.5 * v.pressW));

      /* 光环：呼吸 + 摆动（都绕环心），按住时收紧、抬起时随回弹冲激弹一下。
         上下在环坐标系外，屏幕上直上直下。 */
      const hb = 1 + Math.sin((t / HALO_BREATH.dur) * Math.PI * 2) * HALO_BREATH.amp * amb;
      const ha = (t / HALO_SWAY.dur) * Math.PI * 2;
      const hp = (1 - HALO_PRESS.tight * v.pressW) * (1 + v.kick * HALO_PRESS.kick);
      const halo = `translate(0 ${(Math.cos(ha) * HALO_SWAY.lift * amb).toFixed(3)}) ${HALO_T} `
        + `scale(${(hb * hp).toFixed(5)}) `
        + `rotate(${(Math.sin(ha) * HALO_SWAY.rock * amb).toFixed(3)})`;
      haloBack.setAttribute('transform', halo);
      haloFront.setAttribute('transform', halo);

      /* 星呼吸：亮度 / 大小 / 上下同相，缩放绕自己的中心，上下在环坐标系里直上直下。
         光晕层只跟上下，不跟着缩放（它是模糊光斑）。星不跟环的摆动走。 */
      const pu = reduced ? 0.5 : 0.5 - 0.5 * Math.cos((t / STAR_PULSE.dur) * Math.PI * 2);
      const starT = `translate(0 ${(-(2 * pu - 1) * STAR_PULSE.bob).toFixed(3)}) ${HALO_T}`;
      star.setAttribute('transform',
        `${starT} translate(${STAR_ORIGIN.x.toFixed(3)} ${STAR_ORIGIN.y.toFixed(3)}) `
        + `scale(${(1 + pu * STAR_PULSE.grow).toFixed(5)}) `
        + `translate(${(-STAR_ORIGIN.x).toFixed(3)} ${(-STAR_ORIGIN.y).toFixed(3)})`);
      starGlow.setAttribute('transform', starT);
      starImg.setAttribute('opacity', f3(STAR_PULSE.min + (1 - STAR_PULSE.min) * pu));
      starGlow.setAttribute('opacity',
        f3(Math.min(1, STAR_PULSE.glow * pu * pu + HALO_PRESS.glow * v.pressW)));

      /* 水滴迸溅：抬起触发一次，`bp` 从 0 走到 1，沿各自径向外推，边飞边淡出。
         位移与淡出同一条寿命，先快后慢。 */
      const bp = v.burst;
      const be = bp > 1 ? 0
        : bp <= RISE ? bp / RISE
          : bp <= HOLD ? 1
            : Math.pow(1 - (bp - HOLD) / (1 - HOLD), 1.6);
      const bs = (DROP_BURST.sc + DROP_BURST.grow * be).toFixed(4);
      const bo = f3(be);
      const bt = bp > 1 ? 0 : bp;
      const bd = 1 - Math.pow(1 - bt, 3);
      for (const d of drops) {
        const k = d.reach * bd;
        d.el.setAttribute('opacity', bo);
        d.el.setAttribute('transform',
          `translate(${(d.ux * k).toFixed(1)} ${(d.uy * k).toFixed(1)}) `
          + `translate(${d.cx} ${d.cy}) scale(${bs}) translate(${-d.cx} ${-d.cy})`);
      }

      /* 星点：一个寿命内淡入、最亮、淡出到 0；位移沿径向迸出，先快后慢。
         `duty` 之外的静默段完全不显示，两端透明度都是 0。
         降低动效时时间取 0，星点停在各自的初始相位。 */
      const pt = reduced ? 0 : t;
      for (const p of pts) {
        const v = (pt / p.cycle + p.phase) % 1;
        const on = v < FX_PARTICLE.duty;
        const u = on ? v / FX_PARTICLE.duty : 0;
        const r = FX_DRIFT_PX * (1 - Math.pow(1 - u, 3));
        p.el.setAttribute('opacity', on ? f3(Math.sin(Math.PI * u)) : '0');
        p.el.setAttribute('transform',
          `translate(${(p.ux * r).toFixed(2)} ${(p.uy * r).toFixed(2)})`);
      }

      /* 爆发：按住时整层从太阳中心往外散开，松手收回。 */
      fx.setAttribute('transform', `scale(${(1 + v.pressW * FX_BURST.grow).toFixed(4)})`);
    },
  };
}

export const mount = defineCharacter({
  scene: SVG_SCENE,
  createAnim: createSunAnim,
  hit: '#sunHit',
  setup: setupSun,
});

export { BALL_D, BODY_C, ORIGIN, VIEW } from './anim.js';
