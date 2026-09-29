/**
 * 太阳角色：把动画写进 DOM。
 *
 *   scene.js  图层结构（静态，4 张原图：本体 + 三态眼）
 *   anim.js   动作（纯逻辑，由 `core/motions.js` 的原语叠出）
 *   本文件    太阳专属部分：哪个组写什么 transform、入场支点在哪
 *
 * 注入 SVG / 入场进度 / 指针输入 / 逐帧时钟 / 首帧 / destroy 都在 `core/character.js`，
 * 这里只提供 `setup()`。
 *
 * 入场形状与曲线在 `shared/intro.js`。缩放写在 `#sun` 上，其局部原点即太阳中心，原地放大。
 */
import { SVG_SCENE } from './scene.js';
import { BODY_C, createSunAnim } from './anim.js';
import { defineCharacter } from '../../core/character.js';

/** 入场参数转出，保持既有调用方与 `_draft/` 探针可用。 */
export { INTRO } from '../../shared/intro.js';

export const mountSun = defineCharacter({
  scene: SVG_SCENE,
  createAnim: createSunAnim,

  setup(root) {
    const sunEl = root.querySelector('#sun');
    const sceneEl = root.querySelector('#scene');
    const bodyWrapEl = root.querySelector('#sunBodyWrap');
    /* 三态眼按名字取，不用数组下标 —— eyeWeights() 返回 [open, half, closed]，
       DOM 顺序或权重顺序变动时不致静默错位。 */
    const eyeEls = {
      open: root.querySelector('#eyeOpen'),
      half: root.querySelector('#eyeHalf'),
      closed: root.querySelector('#eyeClosed'),
    };

    return {
      apply(v, iv) {
        /* 入场：仅在 `INTRO.dur` 未走完时生效；结束后 k 恒为 1、dy 恒为 0、opacity 清空，
           画面与无入场时逐位一致（见 `shared/intro.js`）。 */
        if (iv.opacity === null) { if (sceneEl.style.opacity) sceneEl.style.opacity = ''; }
        else sceneEl.style.opacity = iv.opacity;

        /* 入场缩放与下移叠在 #sun 上（原点 = 太阳中心，原地放大）。 */
        sunEl.setAttribute('transform',
          `scale(${iv.k.toFixed(6)}) translate(0 ${iv.dy.toFixed(4)})`);

        /* 本体：呼吸（绕球心缩放）+ 悬停上浮。
           眼睛是 #sunBodyWrap 的子节点，随之一起移动，不会与烘死的嘴错开。 */
        bodyWrapEl.setAttribute('transform',
          `translate(0 ${v.bodyDY.toFixed(4)}) ` +
          `translate(${BODY_C.x.toFixed(3)} ${BODY_C.y.toFixed(3)}) ` +
          `scale(${v.bodySX.toFixed(6)} ${v.bodySY.toFixed(6)}) ` +
          `translate(${(-BODY_C.x).toFixed(3)} ${(-BODY_C.y).toFixed(3)})`);

        /* 眨眼：三态眼按权重切 opacity。相邻两段权重和恒为 1，不会闪。 */
        const [wOpen, wHalf, wClosed] = v.eyes;
        eyeEls.open.setAttribute('opacity', wOpen.toFixed(4));
        eyeEls.half.setAttribute('opacity', wHalf.toFixed(4));
        eyeEls.closed.setAttribute('opacity', wClosed.toFixed(4));
      },
    };
  },

  /* 探针接口（`_draft/` 用）：挂载器不认识的自己带上。 */
  extra: (anim) => ({
    get blink() { return anim.blinkValue(); },
    blinkNow() { anim.blinkNow(); },
  }),
});

/* 点击反馈由 `anim.js` 的 `setDown()` 驱动，本文件不额外接线 —— 挂载器把
   pointerdown / pointerup 转发过去，姿态照旧走 `bodySX` / `bodySY` / `bodyDY` 三个量。 */
