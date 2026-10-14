/**
 * 水星角色：把动画写进 DOM。
 *
 *   scene.js  图层结构（静态，4 张原图：本体 + 风扇 + 墨镜 + 风纹）
 *   anim.js   动作参数与几何（姿态由 `core/pose.js` 给出）
 *   本文件    挂载入口：命中区选择器 + 把姿态写进 DOM 的 `setupPose`，
 *             再写出风的循环、风扇与墨镜的点击反馈
 *
 * 五官烘死，不接眨眼。装饰在本体组里，跟着呼吸 / 悬停 / 按压一起动。
 *
 * 注入 SVG / 入场进度 / 指针输入 / 逐帧时钟 / 首帧 / destroy 都在 `core/character.js`。
 */
import { SVG_SCENE } from './scene.js';
import {
  BODY_C, FAN_KICK, FAN_PIVOT, GLASSES_PIVOT, GLASSES_SHAKE, GLASSES_SHAKE_PX,
  WIND, WIND_DIST_PX, WIND_PUFF, WIND_PUFF_PX, createMercuryAnim,
} from './anim.js';
import { defineCharacter } from '../../core/character.js';
import { setupPose } from '../../core/apply.js';
import { dampedImpulse } from '../../shared/impulse.js';

/* 绕某个点旋转：先把该点移到原点，转完再移回去。支点在画布坐标里。 */
const spin = (p, deg) =>
  `translate(${p.x} ${p.y}) rotate(${deg.toFixed(3)}) translate(${-p.x} ${-p.y})`;

/* 亮度：`rise` 之前爬满，之后按 `fade` 次幂衰减。 */
const flash = (u) => (u < WIND.rise
  ? u / WIND.rise
  : Math.pow(1 - (u - WIND.rise) / (1 - WIND.rise), WIND.fade));

/* 扇口方向（画布坐标里的单位向量）。 */
const WA = (WIND.ang * Math.PI) / 180;
const WUX = Math.cos(WA);
const WUY = -Math.sin(WA);

function setupMercury(root, { reduced = false } = {}) {
  const base = setupPose({ name: 'mercury', bodyC: BODY_C, eyes: false })(root);
  const windRig = root.querySelector('#mercuryWindRig');
  const fanRig = root.querySelector('#mercuryFanRig');
  const glassesRig = root.querySelector('#mercurySunglassesRig');

  return {
    apply(v, iv) {
      base.apply(v, iv);
      const t = v.t;

      /* 点击补的那股风：抬起后一次阻尼冲激，只取正半周。 */
      const puff = Math.max(0, dampedImpulse(v.kick, 1, WIND_PUFF.decay, WIND_PUFF.omega));

      /* 风：一轮内淡入、沿扇口方向外移、按次幂衰减；`duty` 之外完全收起。
         降低动效时停在 `freeze` 相位，点击补风照常。 */
      const ph = reduced ? WIND.freeze : (t / WIND.dur) % 1;
      const on = ph < WIND.duty;
      const u = on ? ph / WIND.duty : 0;
      const d = WIND_DIST_PX * (1 - Math.pow(1 - u, 3)) + WIND_PUFF_PX * puff;
      windRig.setAttribute('transform',
        `translate(${(WUX * d).toFixed(2)} ${(WUY * d).toFixed(2)})`);
      windRig.setAttribute('opacity',
        (on ? Math.min(1, flash(u) + WIND_PUFF.boost * puff) : 0).toFixed(3));

      /* 风扇：点击时绕底座摆一下。 */
      fanRig.setAttribute('transform',
        spin(FAN_PIVOT, dampedImpulse(v.kick, FAN_KICK.amp, FAN_KICK.decay, FAN_KICK.omega)));

      /* 墨镜：点击时上下抖两下。 */
      const sh = dampedImpulse(v.kick, 1, GLASSES_SHAKE.decay, GLASSES_SHAKE.omega);
      glassesRig.setAttribute('transform',
        `translate(0 ${(sh * GLASSES_SHAKE_PX).toFixed(2)}) `
        + spin(GLASSES_PIVOT, sh * GLASSES_SHAKE.rot));
    },
  };
}

export const mount = defineCharacter({
  scene: SVG_SCENE,
  createAnim: createMercuryAnim,
  hit: '#mercuryHit',
  setup: setupMercury,
});

export { BALL_D, BODY_C, ORIGIN, VIEW } from './anim.js';
