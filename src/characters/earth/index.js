/**
 * 地球角色：把动画写进 DOM。
 *
 *   scene.js  图层结构（静态，原图：本体 + 三态眼 + 花环 + 花环上的两片叶 + 落叶 7 张）
 *   anim.js   动作参数与几何（姿态由 `core/pose.js` 给出）
 *   本文件    挂载入口：命中区选择器 + 把姿态写进 DOM 的 `setupPose`，
 *             再写落叶的弧线滑落与花环两片叶的呼吸 / 点击回弹
 *
 * 注入 SVG / 入场进度 / 指针输入 / 逐帧时钟 / 首帧 / destroy 都在 `core/character.js`。
 */
import { SVG_SCENE } from './scene.js';
import {
  BODY_C, FLOWER_LEAF_A, FLOWER_LEAF_B, LEAF_BREATH, LEAF_FX, LEAF_KICK, createEarthAnim,
} from './anim.js';
import { defineCharacter } from '../../core/character.js';
import { setupPose } from '../../core/apply.js';
import { dampedImpulse } from '../../shared/impulse.js';

/* 绕某个点旋转：先把该点移到原点，转完再移回去。支点用叶子外层的局部单位。 */
const spin = (pivot, deg) =>
  `translate(${pivot.x} ${pivot.y}) rotate(${deg.toFixed(3)}) translate(${-pivot.x} ${-pivot.y})`;

function setupEarth(root, { reduced = false } = {}) {
  const base = setupPose({ name: 'earth', bodyC: BODY_C, eyes: true })(root);

  /* 落叶：从初始 transform 读落位，换算成绕球心的极坐标。周期与相位按序号错开。
     降低动效时留空 —— 叶子停在原位不再滑落。 */
  const leaves = reduced ? [] : [...root.querySelectorAll('#earthLeaves > g')].map((el, i) => {
    const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(el.getAttribute('transform'));
    const x = +m[1], y = +m[2];
    const r = Math.hypot(x, y) || 1;
    return {
      g: el, img: el.querySelector('image'),
      r, th: Math.atan2(y, x), side: x >= 0 ? 1 : -1,
      dur: 2.7 + i * 0.33, phase: (i * 0.413) % 1, wob: 4.2 + i * 0.5,
    };
  });

  /* 花环上的两片叶：各绕自己的叶根开合。 */
  const blooms = [[FLOWER_LEAF_A, root.querySelector('#earthLeafA')],
    [FLOWER_LEAF_B, root.querySelector('#earthLeafB')]];

  return {
    apply(v, iv) {
      base.apply(v, iv);
      const t = v.t;

      /* 落叶：一个寿命内淡入、绕球心沿弧线滑落并外漂（逐渐加速）、自转，到 `duty` 后淡出归零。 */
      for (const p of leaves) {
        const ph = (t / p.dur + p.phase) % 1;
        if (ph >= LEAF_FX.duty) {
          p.img.setAttribute('opacity', '0');
          continue;
        }
        const u = ph / LEAF_FX.duty;
        const e = Math.pow(u, 1.4);
        const th = p.th + p.side * (LEAF_FX.arc / p.r) * e;
        const r = p.r + LEAF_FX.drift * e;
        const rot = Math.sin((t / p.wob) * Math.PI * 2) * LEAF_FX.rock + p.side * LEAF_FX.spin * e;
        p.g.setAttribute('transform',
          `translate(${(Math.cos(th) * r).toFixed(2)} ${(Math.sin(th) * r).toFixed(2)}) `
          + `rotate(${rot.toFixed(2)})`);
        p.img.setAttribute('opacity', Math.sin(Math.PI * u).toFixed(3));
      }

      /* 花环叶：慢速开合呼吸 + 点击后的一次阻尼回弹。降低动效时只留回弹。 */
      const kick = dampedImpulse(v.kick, LEAF_KICK.amp, LEAF_KICK.decay, LEAF_KICK.omega);
      for (const [cfg, el] of blooms) {
        const breathe = reduced ? 0 : Math.sin((t / LEAF_BREATH.period + cfg.phase) * Math.PI * 2) * LEAF_BREATH.amp;
        el.setAttribute('transform', spin(cfg.pivot, cfg.dir * (breathe + kick)));
      }
    },
  };
}

export const mount = defineCharacter({
  scene: SVG_SCENE,
  createAnim: createEarthAnim,
  hit: '#earthHit',
  setup: setupEarth,
});

export { BALL_D, BODY_C, ORIGIN, VIEW } from './anim.js';
