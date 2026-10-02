/**
 * 金星角色：把动画写进 DOM。
 *
 *   scene.js  图层结构（静态，4 张原图：本体 + 三态眼）
 *   anim.js   动作参数 + 纯逻辑（由 `core/motions.js` 的原语叠出）
 *   本文件    金星专属部分：哪个组写什么 transform、入场支点在哪
 *
 * 注入 SVG / 入场进度 / 指针输入 / 逐帧时钟 / 首帧 / destroy 都在 `core/character.js`，
 * 这里只提供 `setup()`。入场形状（`INTRO`）在 `anim.js`。
 *
 * 与太阳 / 地球逐行同构，只有 id 前缀与球心不同。
 */
import { SVG_SCENE } from './scene.js';
import { BODY_C, INTRO, createVenusAnim } from './anim.js';
import { defineCharacter } from '../../core/character.js';

export const mountVenus = defineCharacter({
  scene: SVG_SCENE,
  createAnim: createVenusAnim,
  intro: INTRO,
  /* 命中区 id 带角色前缀 —— 五个角色的 SVG 在同一页里，id 不能重名。 */
  hit: '#venusHit',

  setup(root) {
    const venusEl = root.querySelector('#venus');
    const sceneEl = root.querySelector('#venusScene');
    const bodyWrapEl = root.querySelector('#venusBodyWrap');
    /* 三态眼按名字取，不用数组下标 —— eyeWeights() 返回 [open, half, closed]，
       DOM 顺序或权重顺序变动时不致静默错位。 */
    const eyeEls = {
      open: root.querySelector('#venusEyeOpen'),
      half: root.querySelector('#venusEyeHalf'),
      closed: root.querySelector('#venusEyeClosed'),
    };

    return {
      apply(v, iv) {
        /* `iv.opacity === null` → 清掉 inline opacity */
        if (iv.opacity === null) { if (sceneEl.style.opacity) sceneEl.style.opacity = ''; }
        else sceneEl.style.opacity = iv.opacity;

        /* 入场缩放与下移叠在 #venus 上（原点 = 画布中心，原地放大）。 */
        venusEl.setAttribute('transform',
          `scale(${iv.k.toFixed(6)}) translate(0 ${iv.dy.toFixed(4)})`);

        /* 本体：呼吸（绕球心缩放）+ 悬停上浮 + 按压下沉。
           眼睛是 #venusBodyWrap 的子节点，随之一起移动，不会与烘死的嘴错开。 */
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

  /* 探针接口：挂载器不认识的自己带上。 */
  extra: (anim) => ({
    get blink() { return anim.blinkValue(); },
    blinkNow() { anim.blinkNow(); },
  }),
});
