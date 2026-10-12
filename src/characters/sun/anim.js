/**
 * 动画层：太阳的动作。
 *
 * 纯逻辑、不碰 DOM：姿态由 `core/pose.js` 的状态机给出，本文件只声明几何与呼吸参数，
 * 逐帧写进 DOM 由 `core/apply.js` 负责。
 *
 * 呼吸落在本体上：火焰边缘烘在本体内，本体缩放即整颗太阳的呼吸。
 *
 * 素材几何：`sun_base.png` 与 `src/assets/eye/*.png` 都是 1536 画布，且眼图从本体上原样抠出，
 * 两层共用同一份 `CANVAS_T`。
 */
import { createPose, PRESS } from '../../core/pose.js';
import { createBlend, EASE_OUT } from '../../core/transition.js';

/* 固定种子的伪随机：逐帧要复现，不能用 Math.random。 */
export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** viewBox 的左上角（局部坐标）与尺寸。由所有动作的包络取并集，再留边距。 */
export const VIEW = { minX: -100, minY: -53, w: 700, h: 580 };

/* 素材画布（1536）→ 局部单位。 */
const K = 0.42;

/* 素材画布中心。本体与三态眼都按它对齐。 */
const CANVAS_C = 768;

/* 素材球体直径（px，1536 画布）。 */
const BALL_PX = 696;

/** 局部原点（素材画布中心）在 viewBox 里的落点。 */
export const ORIGIN = { x: 268.2, y: 263.0 };

/* 太阳球心（素材画布坐标）。呼吸绕它缩放，星点以它为原点往外漂。 */
export const BODY_PX = { x: 788, y: 732 };

/* 呼吸缩放的支点 = 球心相对画布中心的偏移（局部单位）。 */
export const BODY_C = { x: K * (BODY_PX.x - CANVAS_C), y: K * (BODY_PX.y - CANVAS_C) };

/** 球体在局部单位下的直径。`registry.js` 用它把球屏幕径换算成舞台宽。 */
export const BALL_D = K * BALL_PX;

/* 光晕：垫在本体下面的暖色径向渐变圆，半径 = 球半径 × `r`，`opacity` 是静止时的强度。 */
export const GLOW = { r: 1.75, opacity: 0.60 };

/** 素材画布（1536）→ 局部单位 的公共变换。本体与三态眼都用它。 */
export const CANVAS_T = `scale(${K}) translate(-${CANVAS_C} -${CANVAS_C})`;

/* ---------- 光环与特效 ---------- */

/* 每层的锚点（素材画布坐标）与摆放：相对画布中心的偏移（素材 px）、缩放、角度（度）。
   缩放与旋转都绕该层自己的锚点。 */
export const HALO_C = { x: 764, y: 882 };
export const HALO = { dx: -35.1, dy: -490.6, s: 0.383, rot: -4.0 };

/* 星在环坐标系里的下沉量（素材 px）：环后 / 星 / 环前 共用 HALO 的摆放，
   星的下沉只写在自己的图变换里，三层的相对位置随手一调就变。 */
export const STAR_SINK = 0;

/* 星的视觉中心（素材画布坐标）。星呼吸绕它缩放，水滴迸溅以它为原点。 */
export const STAR_C = { x: 773.5, y: 741.5 };

export const HALO_FX_C = { x: 787, y: 519 };
export const HALO_FX = { dx: -32.2, dy: -650.3, s: 0.383, rot: -4.0 };

export const FX_C = { x: 760, y: 816 };
export const FX = { dx: -35.1, dy: -4.4, s: 1.127, rot: 0.0 };

/* 拆成单颗的水滴 / 星点，各一层的落位（素材画布上的 x y w h）。
   图在 src/assets/sun/halofx/ 与 fx/，由 `_draft/_split_fx.py` 切出来。 */
export const HF_PTS = [
  [341, 565, 121, 119],
  [534, 540, 60, 70],
  [670, 355, 63, 141],
  [721, 566, 18, 23],
  [912, 473, 108, 129],
  [1143, 556, 91, 102],
];

export const FX_PTS = [
  [177, 545, 64, 82],
  [207, 772, 84, 57],
  [232, 1037, 82, 105],
  [300, 984, 62, 55],
  [344, 549, 77, 58],
  [391, 607, 34, 18],
  [427, 480, 14, 18],
  [565, 1201, 58, 67],
  [758, 349, 21, 15],
  [858, 1220, 32, 30],
  [1071, 1144, 32, 32],
  [1085, 1092, 91, 83],
  [1208, 353, 79, 104],
  [1226, 909, 46, 38],
  [1277, 874, 68, 81],
];

/* 设定7 抠出的 5 颗装饰星，各一张图（`src/assets/sun/star/`，与文件排序一一对应），
   落位格式同 `FX_PTS`（素材画布上的 x y w h）。 */
export const FX_STARS = [
  [330, 280, 43, 54],
  [627, 249, 40, 53],
  [1093, 302, 39, 53],
  [438, 1233, 39, 49],
  [1002, 1237, 37, 40],
];

/* 一层的组变换：偏移用素材 px，换算成局部单位。 */
const layerT = (p) =>
  `translate(${(p.dx * K).toFixed(3)} ${(p.dy * K).toFixed(3)}) rotate(${p.rot}) scale(${p.s})`;

/* 一层的图变换：把该层的锚点挪到组原点。 */
const layerImgT = (c) => `scale(${K}) translate(${-c.x} ${-c.y})`;

export const HALO_T = layerT(HALO);
export const HALO_IMG_T = layerImgT(HALO_C);
export const STAR_IMG_T = layerImgT({ x: HALO_C.x, y: HALO_C.y - STAR_SINK });
export const STAR_ORIGIN = { x: K * (STAR_C.x - HALO_C.x), y: K * (STAR_C.y + STAR_SINK - HALO_C.y) };
export const HALO_FX_T = layerT(HALO_FX);
export const HALO_FX_IMG_T = layerImgT(HALO_FX_C);
export const FX_T = layerT(FX);
export const FX_IMG_T = layerImgT(FX_C);

/* ---------- 动作参数 ---------- */

/* 呼吸（本体）：周期 4.3 s，纵向为主。幅度受火焰边缘限制。 */
const BREATH = { dur: 4.3, amp: 0.017, lift: 2.4, wide: 0.40, phase: 0.9 };

/* 光环呼吸：环后 / 环前 一起，绕环心缩放。 */
export const HALO_BREATH = { dur: 5.2, amp: 0.022 };

/* 光环摆动：绕环心轻摇 + 整体上下浮动，两者差 1/4 周期，合起来像在飘。
   `rock` 是角度（度），`lift` 是上下幅度（局部单位）。周期与呼吸、星脉冲都错开。 */
export const HALO_SWAY = { dur: 6.4, rock: 3.6, lift: 2.2 };

/* 点击：按住时环收紧、星的光晕变亮（蓄力），抬起时水滴迸溅（释放）。
   `kick` 是抬起时环随回弹冲激的额外缩放幅度。 */
export const HALO_PRESS = { tight: 0.12, glow: 0.55, kick: 0.12 };

/* 星呼吸：亮度 / 大小 / 上下同步。`min` 是最暗时的 opacity，`grow` 是最大放大比例，
   `glow` 是模糊光晕层最亮时的 opacity，`bob` 是上下浮动的单侧幅度（局部单位）。 */
export const STAR_PULSE = { dur: 2.6, min: 0.80, grow: 0.05, glow: 0.50, bob: 2.6 };

/* 水滴：抬起时迸溅一次，静止时不可见。
   `dur` 寿命，`rise` / `hold` 是冲到顶与顶住的时长，`sc` 是最小缩放，
   `grow` 是最亮时的额外放大，`push` 是沿径向外推的距离（倍于水滴到星的距离）。 */
export const DROP_BURST = { dur: 0.42, rise: 0.05, hold: 0.08, sc: 0.55, grow: 0.5, push: 0.45 };

/* 星点：各自固定相位与周期，一个寿命内「淡入 → 沿背离太阳的方向迸出 → 淡出」。
   `dur` 是单颗的可见寿命（秒），`duty` 是可见时间占整个循环的比例 —— 余下的静默段
   完全不显示，这样「灭掉」才看得出来。`drift` 是外移距离（局部单位），位移先快后慢。 */
export const FX_PARTICLE = { dur: [2.4, 4.6], duty: 0.6, drift: 10, seed: 20261010 };

/* 星点写在 `FX_IMG_T` 组内（画布坐标），把局部单位换算成画布 px。 */
export const FX_DRIFT_PX = FX_PARTICLE.drift / (K * FX.s);

/* 星点爆发：按下时整层向外散开的比例，松手收回。 */
export const FX_BURST = { grow: 0.14 };

/* 点击表情：按下即显示；至少显示 `minShow` 秒（从按下算），松手后最多再停 `hold` 秒。
   `in` / `out` 是淡入与淡出的过渡口径，快进慢出。 */
export const CLICK_FACE = {
  in: { dur: 0.26, ease: EASE_OUT },
  out: { dur: 0.68, ease: EASE_OUT },
  minShow: 0.55,
  hold: 0.25,
};

/* 悬停 / 按压 / 回弹 / 入场 / 眨眼：十颗一致，缺省值见 `core/pose.js` 与 `shared/blink.js`。 */

/* 在姿态上补「按压权重」（特效爆发用）与「迸溅进度」（抬起触发一次）。
   `burst` 超出 1 即表示没在播。 */
export function createSunAnim(opts) {
  const pose = createPose({ ...opts, breath: BREATH, blink: true });
  /* 光环的按压权重：与本体共用 `PRESS` 的过渡时长与曲线。 */
  const haloPress = createBlend(PRESS);
  const clickW = createBlend(CLICK_FACE.in);
  let down = false;
  let burstT = Infinity;
  let clickOn = false;
  let showT = 0;
  let offT = 0;
  return {
    ...pose,
    step(dt) {
      haloPress.step(dt);
      clickW.step(dt);
      burstT += dt;
      if (clickOn) {
        showT += dt;
        if (!down) offT += dt;
        if (showT >= CLICK_FACE.minShow && offT >= CLICK_FACE.hold) {
          clickOn = false;
          clickW.set(0, CLICK_FACE.out);
        }
      }
      return { ...pose.step(dt), pressW: haloPress.value, burst: burstT / DROP_BURST.dur, clickW: clickW.value };
    },
    setDown(v) {
      if (down && !v) burstT = 0;
      if (v && !down) { clickOn = true; showT = 0; offT = 0; clickW.set(1, CLICK_FACE.in); }
      down = v;
      haloPress.set(v ? 1 : 0);
      pose.setDown(v);
    },
  };
}
