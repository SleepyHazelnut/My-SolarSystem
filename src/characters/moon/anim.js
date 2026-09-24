/**
 * 动画层：月球的动作 —— 呼吸 / 浮动 / 悬停，外加睡帽自己的一点摆动。
 *
 * 与地球同构：纯逻辑、不碰 DOM，每帧返回一组绝对值，由 index.js 写进 SVG 属性。
 *
 * ⚠️ 月球**没有眨眼、也没有表情层**：五官（闭着的笑眼 + 腮红）烘在本体图上。
 * 所以这里不接 `shared/blink.js`。想加眨眼得先把眼从本体上抹掉、切三态，
 * 再跟太阳那样共用 `src/assets/eye/`。
 *
 * 素材几何：本体与睡帽是**同一张 1072×1108 裁剪画布**，所以共用同一份 MOON_T。
 */
import { approach } from '../../shared/approach.js';

/* viewBox 落点。月球是「一颗安静的球 + 一顶帽子」，构图没有上下伸展的东西，
   所以画面比地球方（440×440）、球体居中。 */
export const VIEW_W = 440;
export const VIEW_H = 440;
export const CX = 220;                  // 球心 x
export const CY = 220;                  // 球心 y

/* 素材几何（裁剪画布 1072×1108，实测）：球体 bbox 1068×1104、加权质心 (537.3, 553.5)。
   取**宽度**那一半（534）当半径 —— 球被画得略高一点点，用高度会偏大。 */
export const SRC = { cx: 537.3, cy: 553.5, r: 534 };

/** 球体直径定成 260 —— 与地球**同一个数**，两个角色并排一样大。 */
export const S = 260 / (SRC.r * 2);

/** 本体与睡帽共用的静态变换（两张图同一张画布）。 */
export const MOON_T = `translate(${CX} ${CY}) scale(${S.toFixed(6)}) translate(${-SRC.cx} ${-SRC.cy})`;

/* 呼吸：周期 3.6 s，比太阳（4.3）与地球（3.2）都慢 —— 月亮是三个里最静的那个。
   纵向为主、横向跟 40%。 */
export const BREATH = { dur: 3.6, amp: 0.016, lift: 3.4 };

/* 浮动：**不成倍数**的低频正弦合成，所以看着永远不重复。
   横向给得极小（1.4）—— 月球只是「悬着轻轻晃」，不是「飘来飘去」。 */
export const DRIFT = { x: [[19.3, 1.4]], y: [[13.7, 3.4]] };

/* 悬停：整颗往上抬。 */
export const HOVER = { lift: -9, rate: 11 };

/* 睡帽：绕**球心**来回摆 ±1.4°、周期 5.2 s（与呼吸 3.6 不成倍数）。
   幅度必须小 —— 支点在球心，帽尖离球心约 400 px，1.4° 就是约 10 px 的摆幅，
   再大帽檐会从头上「滑」下来。 */
export const CAP = { dur: 5.2, amp: 1.4 };

/**
 * 建一个月球的动画实例（**纯计算，不碰 DOM**）。
 *
 * 返回的一组值：
 *   sx / sy   本体缩放（绕球心）
 *   dx / dy   整颗的位移（呼吸起伏 + 漂移 + 悬停抬升，单位 = viewBox）
 *   capRot    睡帽的旋转（**度**，绕球心）
 */
export function createMoonAnim() {
  let t = 0;
  let hoverW = 0;
  let hover = false;

  function step(dt) {
    t += dt;
    hoverW = approach(hoverW, hover ? 1 : 0, HOVER.rate, dt);

    const ph = (t / BREATH.dur) * Math.PI * 2;
    const bs = Math.sin(ph) * BREATH.amp;
    const wob = (list) => list.reduce((s, [p, a]) => s + Math.sin((t / p) * Math.PI * 2) * a, 0);

    return {
      sx: 1 - bs * 0.40,
      sy: 1 + bs,
      dx: wob(DRIFT.x),
      dy: wob(DRIFT.y) + Math.sin(ph) * BREATH.lift + hoverW * HOVER.lift,
      capRot: Math.sin((t / CAP.dur) * Math.PI * 2) * CAP.amp,
      t,
    };
  }

  return { step, setHover(v) { hover = v; } };
}
