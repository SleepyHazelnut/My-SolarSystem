/**
 * 土星角色：把动画写进 DOM。
 *
 *   scene.js  图层结构（静态：光环后层 / 本体 / 光环前层）
 *   anim.js   动作参数 + 纯逻辑（由 `core/motions.js` 的原语叠出）
 *   本文件    土星专属部分：哪个组写什么 transform、入场支点在哪
 *
 * 注入 SVG / 入场进度 / 指针输入 / 逐帧时钟 / 首帧 / destroy 都在 `core/character.js`，
 * 这里只提供 `setup()`。入场形状（`INTRO`）在 `anim.js`。
 */
import { SVG_SCENE } from './scene.js';
import { BODY_C, INTRO, createSaturnAnim } from './anim.js';
import { defineCharacter } from '../../core/character.js';

export const mountSaturn = defineCharacter({
  scene: SVG_SCENE,
  createAnim: createSaturnAnim,
  intro: INTRO,
  /* 命中区 id 带角色前缀 —— 八个角色的 SVG 在同一页里，id 不能重名。 */
  hit: '#saturnHit',

  setup(root) {
    const saturnEl = root.querySelector('#saturn');
    const sceneEl = root.querySelector('#saturnScene');
    const bodyWrapEl = root.querySelector('#saturnBodyWrap');

    return {
      apply(v, iv) {
        /* `iv.opacity === null` → 清掉 inline opacity */
        if (iv.opacity === null) { if (sceneEl.style.opacity) sceneEl.style.opacity = ''; }
        else sceneEl.style.opacity = iv.opacity;

        /* 入场缩放与下移叠在 #saturn 上（原点 = 画布中心，原地放大）。 */
        saturnEl.setAttribute('transform',
          `scale(${iv.k.toFixed(6)}) translate(0 ${iv.dy.toFixed(4)})`);

        /* 本体 + 前后两层光环：呼吸（绕球心缩放）+ 悬停上浮 + 按压下沉。 */
        bodyWrapEl.setAttribute('transform',
          `translate(0 ${v.bodyDY.toFixed(4)}) ` +
          `translate(${BODY_C.x.toFixed(3)} ${BODY_C.y.toFixed(3)}) ` +
          `scale(${v.bodySX.toFixed(6)} ${v.bodySY.toFixed(6)}) ` +
          `translate(${(-BODY_C.x).toFixed(3)} ${(-BODY_C.y).toFixed(3)})`);
      },
    };
  },
});
