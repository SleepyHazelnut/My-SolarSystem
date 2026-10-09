/**
 * 动画层：地球的动作。
 *
 * 纯逻辑、不碰 DOM：姿态由 `core/pose.js` 的状态机给出，本文件只声明几何与呼吸参数，
 * 逐帧写进 DOM 由 `core/apply.js` 负责。
 *
 * 素材几何：`earth_base.png` 与 `eye_{open,half,closed}.png` 都是 1536 画布，
 * 眼图是从本体上原样抠出来的，两层共用同一份 `CANVAS_T`。
 */
import { createPose } from '../../core/pose.js';

/** viewBox 的左上角（局部坐标）与尺寸。由所有动作的包络取并集，再留边距。 */
export const VIEW = { minX: -250, minY: -250, w: 500, h: 452 };

/* 素材画布（1536）→ 局部单位。 */
const K = 0.30;

/* 素材画布中心。本体与三态眼都按它对齐。 */
const CANVAS_C = 768;

/* 素材球体直径（px，1536 画布）。 */
const BALL_PX = 1134;

/** 局部原点（素材画布中心）在 viewBox 里的落点 = viewBox 中心 − 动作包络中心。 */
export const ORIGIN = { x: 0.1, y: -4.4 };

/* 呼吸缩放的支点 = 球心（素材坐标 (749.5, 779)）。 */
export const BODY_C = { x: K * (749.5 - CANVAS_C), y: K * (779 - CANVAS_C) };

/** 球体在局部单位下的直径。`registry.js` 用它把球屏幕径换算成舞台宽。 */
export const BALL_D = K * BALL_PX;

/** 素材画布（1536）→ 局部单位 的公共变换。本体与三态眼都用它。 */
export const CANVAS_T = `scale(${K}) translate(-${CANVAS_C} -${CANVAS_C})`;

/* 花环图层：画布像素偏移（dx / dy）与绕画布中心的缩放（k）。 */
export const FLOWER = { dx: -294.7, dy: -366.8, k: 0.698 };

/** 花环的附加变换，接在 `CANVAS_T` 之后（对画布坐标生效）。 */
export const FLOWER_T =
  `translate(${FLOWER.dx} ${FLOWER.dy}) ` +
  `translate(${CANVAS_C} ${CANVAS_C}) scale(${FLOWER.k}) translate(-${CANVAS_C} -${CANVAS_C})`;

/* ---------- 落叶与花环叶 ---------- */

/* 每片的位置与尺寸：`[文件名, 相对球心的 x, y, 宽, 高]`（局部单位）。
   数值由「地球设定3.png」等比换算（设定图 px × 0.6623）。 */
export const LEAF_PTS = [
  ['leaf1', -108.3, -168.9, 15.9, 15.2],
  ['leaf2', -182.0, -75.0, 15.9, 16.6],
  ['leaf3', -208.6, 21.9, 36.4, 40.4],
  ['leaf4', -174.8, 89.4, 16.6, 21.9],
  ['leaf5', -92.7, 171.2, 27.2, 21.2],
  ['leaf6', 127.5, 160.9, 22.5, 19.2],
  ['leaf7', 187.7, 28.8, 18.5, 29.1],
];

/* 落叶：一个寿命内「淡入 → 绕球心弧线滑落 → 淡出」，`duty` 是可见时间占比。
   `arc` 是沿球面的弧长（局部单位），`drift` 是同时的外漂距离（局部单位），
   `rock` 是自转摆动幅度（度），`spin` 是随滑落方向的净自转（度）。 */
export const LEAF_FX = { duty: 0.62, arc: 38, drift: 6.0, rock: 8.0, spin: 26 };

/* 花环叶与花环共用 `CANVAS_T` + `FLOWER_T`；这一串把素材画布坐标换成叶子外层的局部单位。 */
const flowerPt = (x, y) => ({
  x: K * FLOWER.k * x + K * (FLOWER.dx + CANVAS_C - FLOWER.k * CANVAS_C) - K * CANVAS_C,
  y: K * FLOWER.k * y + K * (FLOWER.dy + CANVAS_C - FLOWER.k * CANVAS_C) - K * CANVAS_C,
});

/* 花环上两片叶：旋转支点是素材画布坐标里的叶根位置（各自独立，茎不动）。
   `dir` 是「张开」的旋转方向（+1 = 屏幕顺时针）。 */
export const FLOWER_LEAF_A = { pivot: flowerPt(1050, 440), dir: -1, phase: 0 };
export const FLOWER_LEAF_B = { pivot: flowerPt(1040, 455), dir: 1, phase: 0.38 };

/* 叶的呼吸：绕叶根开合的幅度（度）与周期（秒）。 */
export const LEAF_BREATH = { amp: 2.6, period: 4.2 };

/* 叶的点击回弹：抬起时的一次阻尼冲激（幅度单位是度）。 */
export const LEAF_KICK = { amp: 12, decay: 6.5, omega: 20 };

/* ---------- 动作参数 ---------- */

/* 呼吸（本体）：周期 3.2 s，纵向为主。 */
const BREATH = { dur: 3.2, amp: 0.016, lift: 2.4, wide: 0.42, phase: 1.3 };

/* 悬停 / 按压 / 回弹 / 入场 / 眨眼：十颗一致，缺省值见 `core/pose.js` 与 `shared/blink.js`。 */

export function createEarthAnim(opts) {
  const pose = createPose({ ...opts, breath: BREATH, blink: true });
  let down = false;
  /* 点击冲激的计时（秒）。初值取大数，让衰减项归零。 */
  let kick = 1e9;
  return {
    step(dt) {
      kick += dt;
      return { ...pose.step(dt), kick };
    },
    setHover: (v) => pose.setHover(v),
    setDown(v) {
      if (v && !down) kick = 0;
      down = v;
      pose.setDown(v);
    },
    blinkNow: () => pose.blinkNow(),
    blinkValue: () => pose.blinkValue(),
  };
}
