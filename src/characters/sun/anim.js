/**
 * 动画层：太阳的动作 —— 本体呼吸 + 悬停上浮 + 随机眨眼。
 *
 * 纯逻辑、不碰 DOM，每帧返回一组绝对值，由 `index.js` 写进 SVG 属性。
 * 姿态由 `core/motions.js` 的原语经 `compose()` 叠出，新增动作在 `compose()` 追加一项。
 *
 * 呼吸落在本体上：火焰边缘烘在本体内，本体缩放即整颗太阳的呼吸。
 *
 * 素材几何：`sun_base.png` 与 `src/assets/eye/*.png` 都是 1536 画布，且眼图从本体上原样抠出，
 * 内容已在画布上的正确位置，两层共用同一份 `scale(K) translate(-768 -768)`。
 * 见 `_draft/_rebuild-eyes.py`。
 */
import { cubicBezier } from '../../shared/easing.js';
import { approach } from '../../shared/approach.js';
import { breath, compose, hover } from '../../core/motions.js';
import { createBlinkLayer, eyeWeights } from '../../shared/blink.js';

/* Sun 节点在画板上的落点，唯一一份：scene.js 的静态 <g translate> 与 index.js 写 #sun 的
   基准偏移都取自这里。
   值 = viewBox 中心 − 动作包络中心，所以太阳在画布里居中。 */
export const SUN = { x: 268.2, y: 263.0 };

/* 素材画布（1536）→ 局部单位。本体与三态眼共用，改这一个数不会让两层错开。
   0.42：本体（含火焰）1055 px 高 → 443 单位。 */
export const K = 0.42;

/* 素材画布中心。两层都按它对齐，即本体与眼睛的共同原点。 */
const CANVAS_C = 768;

/* 呼吸缩放的支点 = 太阳球心（素材坐标 (788, 732)，实测球半径 ≈348）。
   不用画布中心 (768,768)：该点偏左下，绕它缩放会带轻微平移。 */
export const BODY_C = { x: K * (788 - CANVAS_C), y: K * (732 - CANVAS_C) };

/** 三态眼层（#sunEyes）的静态变换，与本体完全相同。
    眼图是从本体上原样抠出的 1536 画布图，内容就在脸上原位置，
    共用本体的缩放与居中即落在原处，不需要单独的对位参数。 */
export const EYE_T = `scale(${K}) translate(-${CANVAS_C} -${CANVAS_C})`;

/* 呼吸（本体）：周期 4.3 s，幅度小 —— 火焰边缘为锯齿状，胀过头会张开缝。
   纵向为主，横向跟四成；`lift` 是同一条正弦驱动的纵向起伏。 */
export const BREATH = { dur: 4.3, amp: 0.018, lift: 2.4, wide: 0.40 };

/* 悬停：整颗上抬（负 = 上）。rate 越大越跟手。 */
export const HOVER = { lift: -9, rate: 11 };

/* 眨眼：相位按帧对齐（5 闭 + 1 保持 + 3 睁 = 9 帧）。
   三态眼图由 `_draft/_rebuild-eyes.py` 生成 —— 半闭 / 闭 为睁眼绕自身中心垂直压扁
   （0.5047 / 0.1682）。 */
export const BLINK = {
  min: 2.5, max: 6.0,              // 两次眨眼起点到起点的间隔（秒）
  firstMin: 1.5, firstMax: 3.5,    // 首次眨眼的延迟
  double: 0.15,                    // 连眨概率
  doubleMin: 0.20, doubleMax: 0.28,
  closeF: 5, holdF: 1, openF: 3,
};

/* 眨眼的闭合 / 张开曲线。 */
const EASE = {
  ei: cubicBezier(0.40, 0.00, 1.00, 1.00),   // 闭合
  eo: cubicBezier(0.00, 0.00, 0.20, 1.00),   // 张开
};

/**
 * 建一个太阳的动画实例（纯计算，不碰 DOM）。
 * @param rand 随机源，注入是为了锁种子复现（探针用）；默认 Math.random。
 */
export function createSunAnim({ rand = Math.random } = {}) {
  const blink = createBlinkLayer({ ...BLINK, easeIn: EASE.ei, easeOut: EASE.eo, rand });

  let t = 0;            // 全局时间轴（秒）。两条正弦都从它取相位，保证连续
  let hoverW = 0;       // 悬停权重 0~1，指数逼近
  let hovered = false;

  /** 推进一帧，返回该帧要写进 DOM 的一组绝对值（单位 = viewBox）：
   *  `bodySX` / `bodySY` 本体缩放（绕球心）、`bodyDY` 呼吸起伏 + 悬停上浮、
   *  `eyes` = [睁, 半闭, 闭] 三段不透明度。 */
  function step(dt) {
    t += dt;
    hoverW = approach(hoverW, hovered ? 1 : 0, HOVER.rate, dt);
    blink.step(dt, true);

    const v = compose(
      breath(t, BREATH),
      hover(hoverW, HOVER),
    );

    const b = blink.value();
    return {
      bodySX: v.sx,
      bodySY: v.sy,
      bodyDY: v.dy,
      eyes: eyeWeights(b),
      blink: b,
      t,
    };
  }

  return {
    step,
    setHover(v) { hovered = v; },
    /** 立刻眨一次 */
    blinkNow() { blink.fire(); },
    /** 当前闭眼量 0~1（探针用） */
    blinkValue: blink.value,
  };
}

export { eyeWeights };
