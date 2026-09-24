/**
 * 动画层：太阳只剩三层 —— **本体 + 光圈 + 眼睛**，动作全是程序化正弦，没有关键帧表。
 *
 * ⚠️ **本体不呼吸** —— 本体只跟着悬停上浮，缩放恒为 1；活气全交给光圈的呼吸 + 摇摆（见 RAYS）。
 * 所以 `step()` 里没有 `bodySX / bodySY`，`#sunBodyWrap` 只吃一个 `translate(0 dy)`。
 *
 * 与地球同构：纯逻辑、不碰 DOM，每帧返回一组绝对值，由 index.js 写进 SVG 属性。
 *
 * ⚠️ 这里**没有状态机、没有混合器、没有点击**。旧那套（Idle / Hover / Clicked 三态互斥 +
 * 关键帧表 + 星环 + 星光 + 皇冠弹簧 + 侧转 + 猫脸）已随皇冠与星环一起退役。
 * 想加点击反馈就新写一条程序化波形，别去恢复关键帧表。
 *
 * 素材几何：
 *   · `sun_base.png`（本体）与 `sun_rays.png`（光圈）都是 **1536 画布**、内容以画布中心
 *     (768,768) 为心 —— 共用同一份 `scale(K) translate(-768 -768)`，天然同心。
 *     光圈画在**本体之上**：花瓣压在球体边缘上，缝里透出本体。
 *   · 眼睛是**与地球共用**的 `src/assets/eye/*.png`（2048 画布），落位要自己算，见 EYE_T。
 */
import { cubicBezier } from '../../shared/easing.js';
import { approach } from '../../shared/approach.js';
import { createBlinkLayer, eyeWeights } from '../../shared/blink.js';

/* Sun 节点在画板上的落点 —— **唯一一份**。scene.js 的静态 <g translate> 与 index.js
   每帧写 #sun 时的基准偏移都从这里取，不存在「改一处忘一处」。 */
export const SUN = { x: 295, y: 300 };

/* 素材画布（1536）→ 局部单位。本体与光圈共用，所以调这一个数不会把两层错开。
   取 0.42：本体半径 475 px → 199.5 单位；光圈外缘 605 px → 254 单位。 */
export const K = 0.42;

/* 素材画布中心。两张图都按它对齐，所以它同时是本体与光圈的**共同支点**：
   呼吸 / 摇摆都绕它，两层才不会各转各的。 */
const CANVAS_C = 768;

/* 公共三态眼的落位。两个锚点都是实测：
     · 太阳本体上那两只豆豆眼（已抹掉）—— 左 (632.9, 751.0)、右 (964.3, 689.8)，1536 画布
     · 公共眼图里那两只眼睛 —— 左 (1014.9, 1126.3)、右 (1343.3, 1072.1)，2048 画布
   两边眼距几乎相同（337.0 vs 332.8 px）、朝向也几乎相同（−10.5° vs −9.4°），
   所以「中点对中点 + 按眼距比缩放 + 补 1.1° 的差」就严丝合缝，不用另切一张太阳专用眼图。 */
const EYE_SUN = { midX: 798.6, midY: 720.4, sep: 337.00 };
const EYE_IMG = { midX: 1179.1, midY: 1099.2, sep: 332.84 };
const EYE_TILT = -10.465 + 9.372;          // ≈ −1.093°

/** 眼睛那一层（#sunEyes）的静态变换。**挂在 #sunBodyWrap 里面** ——
    悬停上浮时眼睛要跟着本体一起走，否则眼与本体上烘死的嘴会错开。 */
export const EYE_T =
  `translate(${(K * (EYE_SUN.midX - CANVAS_C)).toFixed(3)} ${(K * (EYE_SUN.midY - CANVAS_C)).toFixed(3)}) ` +
  `rotate(${EYE_TILT.toFixed(3)}) ` +
  `scale(${(K * EYE_SUN.sep / EYE_IMG.sep).toFixed(6)}) ` +
  `translate(${-EYE_IMG.midX} ${-EYE_IMG.midY})`;

/* 悬停：整颗往上抬（负 = 上）。rate 越大越跟手。
   ⚠️ 本体**没有**自己的上下起伏 —— 只吃这一份悬停抬升。 */
export const HOVER = { lift: -9, rate: 11 };

/* 光圈：**呼吸 + 左右摇摆**都在这一层 —— 本体静止，活气全靠它。
   · 呼吸周期 4.3 s，幅度小：光圈画在本体**上面**，花瓣之间的缝里透出本体，
     涨太多缝就张开、把本体的边「露」出来（「注意不用太过露出图层」）。
   · 摇摆 = 「左转下、右转下」：绕画布中心来回转，摆幅 2.6°、周期 6.6 s
     （与呼吸 4.3 s 不成倍数，合成运动长时间不重复）。 */
export const RAYS = {
  breathDur: 4.3, breathAmp: 0.018,
  rockDur: 6.6, rockAmp: 2.6,
};

/* 眨眼：相位按**帧**对齐（5 闭 + 1 保持 + 3 睁 = 9 帧），和地球同一套口径。
   眼图是共用的，所以两边闭到同一个深度、同一段时长。 */
export const BLINK = {
  min: 2.5, max: 6.0,              // 两次眨眼**起点到起点**的间隔（秒）
  firstMin: 1.5, firstMax: 3.5,    // 首次眨眼的延迟
  double: 0.15,                    // 连眨概率
  doubleMin: 0.20, doubleMax: 0.28,
  closeF: 5, holdF: 1, openF: 3,
};

/* 眨眼的闭合 / 张开曲线。只属于太阳 —— 共用的是**眼图与拆权重口径**，不是缓动。 */
const EASE = {
  ei: cubicBezier(0.40, 0.00, 1.00, 1.00),   // 闭合
  eo: cubicBezier(0.00, 0.00, 0.20, 1.00),   // 张开
};

/**
 * 建一个太阳的动画实例（**纯计算，不碰 DOM**）。
 * @param rand 随机源，注入是为了锁种子复现（探针用）；默认 Math.random。
 */
export function createSunAnim({ rand = Math.random } = {}) {
  const blink = createBlinkLayer({ ...BLINK, easeIn: EASE.ei, easeOut: EASE.eo, rand });

  let t = 0;            // 全局时间轴（秒）—— 三条正弦都从它取相位，所以永远连续
  let hoverW = 0;       // 悬停权重 0~1，指数逼近而不是硬切
  let hover = false;

  /** 推进一帧，返回这一帧要写进 DOM 的一组绝对值（单位 = viewBox）：
   *  `bodyDY` 整颗上浮（**只有悬停抬升**）、`raysS` 光圈缩放（呼吸在这层）、
   *  `raysRot` 光圈旋转（**度**）、`eyes` = [睁, 半闭, 闭] 三段不透明度。 */
  function step(dt) {
    t += dt;
    hoverW = approach(hoverW, hover ? 1 : 0, HOVER.rate, dt);
    blink.step(dt, true);

    const rs = Math.sin((t / RAYS.breathDur) * Math.PI * 2) * RAYS.breathAmp;
    const rr = Math.sin((t / RAYS.rockDur) * Math.PI * 2) * RAYS.rockAmp;

    const b = blink.value();
    return {
      bodyDY: hoverW * HOVER.lift,
      raysS: 1 + rs,
      raysRot: rr,
      eyes: eyeWeights(b),
      blink: b,
      t,
    };
  }

  return {
    step,
    setHover(v) { hover = v; },
    /** 立刻眨一次 */
    blinkNow() { blink.fire(); },
    /** 当前闭眼量 0~1（探针用） */
    blinkValue: blink.value,
  };
}

export { eyeWeights };
