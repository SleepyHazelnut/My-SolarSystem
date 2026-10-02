/**
 * 火星角色：把动画写进 DOM。
 *
 *   scene.js  图层结构（静态，4 张原图：本体 + 三态眼）
 *   anim.js   动作参数 + 纯逻辑（由 `core/motions.js` 的原语叠出）
 *   本文件    火星专属部分：哪个组写什么 transform、入场支点在哪
 *
 * 注入 SVG / 入场进度 / 指针输入 / 逐帧时钟 / 首帧 / destroy 都在 `core/character.js`，
 * 这里只提供 `setup()`。入场形状（`INTRO`）在 `anim.js`。
 *
 * 与太阳 / 水星逐行同构，只有 id 前缀与球心不同。
 */
import { SVG_SCENE } from './scene.js';
import { BODY_C, INTRO, createMarsAnim } from './anim.js';
import { defineCharacter } from '../../core/character.js';

export const mountMars = defineCharacter({
  scene: SVG_SCENE,
  createAnim: createMarsAnim,
  intro: INTRO,
  /* 命中区 id 带角色前缀 —— 六个角色的 SVG 在同一页里，id 不能重名。 */
  hit: '#marsHit',

  setup(root) {
    const marsEl = root.querySelector('#mars');
    const sceneEl = root.querySelector('#marsScene');
    const bodyWrapEl = root.querySelector('#marsBodyWrap');
    /* 三态眼按名字取，不用数组下标 —— eyeWeights() 返回 [open, half, closed]。 */
    const eyeEls = {
      open: root.querySelector('#marsEyeOpen'),
      half: root.querySelector('#marsEyeHalf'),
      closed: root.querySelector('#marsEyeClosed'),
    };

    return {
      apply(v, iv) {
        /* `iv.opacity === null` → 清掉 inline opacity */
        if (iv.opacity === null) { if (sceneEl.style.opacity) sceneEl.style.opacity = ''; }
        else sceneEl.style.opacity = iv.opacity;

        /* 入场缩放与下移叠在 #mars 上（原点 = 画布中心，原地放大）。 */
        marsEl.setAttribute('transform',
          `scale(${iv.k.toFixed(6)}) translate(0 ${iv.dy.toFixed(4)})`);

        /* 本体：呼吸（绕球心缩放）+ 悬停上浮 + 按压下沉。
           眼睛是 #marsBodyWrap 的子节点，随之一起移动，不会与烘死的嘴错开。 */
        bodyWrapEl.setAttribute('transform',
          `translate(0 ${v.bodyDY.toFixed(4)}) ` +
          `translate(${BODY_C.x.toFixed(3)} ${BODY_C.y.toFixed(3)}) ` +
          `scale(${v.bodySX.toFixed(6)} ${v.bodySY.toFixed(6)}) ` +
          `translate(${(-BODY_C.x).toFixed(3)} ${(-BODY_C.y).toFixed(3)})`);

        /* 眨眼：三态眼按权重切 opacity。相邻两段权重和恒为 1。 */
        const [wOpen, wHalf, wClosed] = v.eyes;
        eyeEls.open.setAttribute('opacity', wOpen.toFixed(4));
        eyeEls.half.setAttribute('opacity', wHalf.toFixed(4));
        eyeEls.closed.setAttribute('opacity', wClosed.toFixed(4));
      },
    };
  },

  /* 探针接口：挂载器不认识的自己带上。 */
  extra: (anim) => ({
    get blink() { return anim.blinkValue(); },
    blinkNow() { anim.blinkNow(); },
  }),
});
