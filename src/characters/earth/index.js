/**
 * 地球角色：DOM 与时钟。
 *
 * 用法：
 *   const earth = mountEarth(document.getElementById('earth'));
 *   earth.destroy();   // 拆 ticker / 监听，并把注入的 SVG 清掉
 *
 * 职责划分（和太阳同一套）：
 *   scene.js  图层结构（静态，8 张原图）
 *   anim.js   几何落点 + 动画参数 + 每帧的数值计算（纯逻辑，不碰 DOM）
 *   本文件     把数值写回 DOM 属性、绑定输入、跑逐帧时钟
 *
 * ⚠️ 地球和太阳不同的一点：它**没有状态机** —— 呼吸 / 摆动 / 眨眼 / 雨都是程序化正弦，
 *    云的漂移也是；只有**点击后的环绕**是一条路径表（`anim.js` 的 `ORBIT_PATH`）。
 *    所以这一层不做混合，只做「取数 → 写属性」。
 */
import gsap from 'gsap';
import { EARTH_SCENE } from './scene.js';
import {
  CX, CY, CLOUD, SPROUT, SPROUT_PIVOT_T, DROP_D, createEarthAnim,
} from './anim.js';
import { clampDt } from '../../shared/clock.js';
import { bindPointerInput } from '../../shared/input.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * 挂载地球。
 * @param root  容器元素
 */
export function mountEarth(root) {
  root.innerHTML = EARTH_SCENE;

  const $ = (s) => root.querySelector(s);
  const bobEl = $('#earthBob');
  const breathEl = $('#earthBreath');
  const sproutWrapEl = $('#earthSproutWrap');
  const sproutStemEl = $('#earthSproutStem');
  const sproutLeafLEl = $('#earthSproutLeafL');
  const sproutLeafREl = $('#earthSproutLeafR');
  const cloudBackEl = $('#earthCloudBack');
  const cloudFrontEl = $('#earthCloudFront');
  const rainEl = $('#earthRain');
  const hitEl = $('#earthHit');
  const faceEl = $('#earthFace');
  const eyeEls = [$('#earthEyeOpen'), $('#earthEyeHalf'), $('#earthEyeClosed')];

  /* ---------- 图层：模板里芽排在球体**之后**（= 画在球体之上）。
     SPROUT.layer = 0 时把它挪到 #earthBreath 的最前面 —— 即沉到球体下面。
     ⚠️ 用 DOM 顺序调 z，不是 z-index（SVG 里 z-index 不生效）。 ---------- */
  if (!SPROUT.layer) {
    breathEl.insertBefore(sproutWrapEl, breathEl.firstChild);
  }

  /* ---------- 茎：**不动** ----------
     只吃静态倾角 rot，写一次就再也不碰（所以它不在主循环里）。
     ⚠️ rot 三份都要吃 —— 只给叶子的话，叶子和茎在静态位就对不上。 */
  sproutStemEl.setAttribute('transform',
    SPROUT_PIVOT_T + `rotate(${SPROUT.rot.toFixed(3)} ${SPROUT.pivotX} ${SPROUT.pivotY})`);

  /* ---------- 动画实例（纯计算）：随机落点、悬停/按压权重、眨眼计时器都在里面 ---------- */
  const anim = createEarthAnim();

  /* 云当前用的是哪一层 —— 只在**变化**时改 DOM（切换点固定，每帧写是白费）。
     初始值与模板一致：前层可见、后层 display:none。 */
  let behindNow = false;

  /* ---------- 雨滴元素：形状是死的，落点每帧由 anim 给 ---------- */
  const dropEls = anim.drops.map(() => {
    const el = document.createElementNS(SVG_NS, 'path');
    el.setAttribute('d', DROP_D);
    el.setAttribute('fill', '#7CC3E8');
    rainEl.appendChild(el);
    return el;
  });

  /* 所有 window 级监听统一挂到它上面，destroy() 时一次清干净 */
  const ac = new AbortController();

  /* ---------- 输入：enter/exit → hover，down/up → pressed ----------
     up 挂 window：在地球上按下、移出去再松手也要清掉 pressed。
     按下时顺手把叶子的冲激时钟归零（triggerWhip）。 ---------- */
  let hovered = false, pressed = false;

  bindPointerInput(hitEl, ac, {
    onEnter: () => { hovered = true; },
    /* ⚠️ 地球这里**连带清掉 pressed**（太阳不清）—— 指针移出球体就算松手。 */
    onLeave: () => { hovered = false; pressed = false; },
    onDown: () => { pressed = true; anim.triggerWhip(); anim.triggerOrbit(); },
    onUp: () => { pressed = false; },
  });

  /* ---------- 主循环 ---------- */
  /* 上一帧算出来的全部数值（只读快照）。给探针用 ——
     ⚠️ 探针**不要**靠 `performance.now()` 反推进度：截图会把 rAF 卡住 ~300 ms，
        而 `clampDt` 上限 0.1 s，每卡一次动画时钟就丢掉 ~0.2 s，
        于是「墙钟 t」和「动画进度」会越差越远（实测后段差到 0.45 s）。
        读这个快照里的 `orbitU` 才是**动画自己的时间轴**。 */
  let lastV = null;

  function tick(_time, deltaMs) {
    const dt = clampDt(deltaMs);
    const v = anim.step(dt, { hovered, pressed });
    lastV = v;

    /* 浮动 + 左右摆：绕**球心**转，所以读起来是「站着的球在晃」而不是「原地自转」 */
    bobEl.setAttribute('transform',
      `translate(0 ${v.bobY.toFixed(3)}) rotate(${v.sway.toFixed(3)} ${CX} ${CY})`);
    /* 呼吸 / 挤压：绕球心缩放（先 translate 到球心、缩完再挪回来）。
       y 方向比 x 多 35%，所以是「上下拉长」的呼吸，不是等比膨胀 */
    breathEl.setAttribute('transform',
      `translate(${CX} ${CY}) scale(${v.breathSX.toFixed(5)} ${v.breathSY.toFixed(5)}) ` +
      `translate(${-CX} ${-CY})`);

    /* 小芽的叶：**茎不动**，只有两片叶摆。
       两份叶吃**同一份** transform —— 绕同一个圆心、同一个角度，所以中间永不裂。
       ⚠️ 圆心是**素材坐标**，外层 <g> 已经把坐标系搬到 viewBox 上了，
          所以必须先 translate(-pivot) 再 rotate，否则会绕画布外的一点转、整支被甩飞。 */
    const leafT = SPROUT_PIVOT_T + `rotate(${v.leafA.toFixed(3)} ${SPROUT.pivotX} ${SPROUT.pivotY})`;
    sproutLeafLEl.setAttribute('transform', leafT);
    sproutLeafREl.setAttribute('transform', leafT);

    /* 云：位置 + 倾角 + 沿横向的非等比拉伸。
       ⚠️ 变换顺序 = `translate(位置) rotate(倾角) scale(sx sy) translate(-素材中心)`：
          缩放轴挂在**倾角之后**，所以拉伸方向跟着云的姿态走（读作「被拉扁」）；
          圆心是素材坐标，所以末尾仍要 `translate(-cx -cy)`。
       ⚠️ 云有**两份** <image>（同一张图、同一份 transform），只有显示哪一个不同：
            `behind` = 回程弧那一段 → 用排在球体**之前**的那份（画在球体下面）。
          切换点在最左点，那一刻云离球体还有 29 px，所以**切换本身看不见**。
          用 display 而不是 opacity —— 两份是同一张图，半透明交叠会看到重影。 */
    const cloudT =
      `translate(${v.cloudX.toFixed(3)} ${v.cloudY.toFixed(3)}) ` +
      `rotate(${v.cloudRot.toFixed(3)}) ` +
      `scale(${v.cloudSX.toFixed(6)} ${v.cloudSY.toFixed(6)}) ` +
      `translate(${-CLOUD.cx} ${-CLOUD.cy})`;
    cloudFrontEl.setAttribute('transform', cloudT);
    cloudBackEl.setAttribute('transform', cloudT);
    if (v.behind !== behindNow) {
      behindNow = v.behind;
      cloudFrontEl.style.display = behindNow ? 'none' : '';
      cloudBackEl.style.display = behindNow ? '' : 'none';
    }

    /* 雨：每颗从云底落到芽顶，头尾各 15% 淡入淡出。
       下落时纵向拉长、横向略收 —— 读作「越落越快」，比匀速的点有生气。
       ⚠️ 第八轮那套「顺风倾斜」（落点横移 + 雨滴转角）随风一起删了：没有风，雨竖直落。 */
    for (let i = 0; i < dropEls.length; i++) {
      const o = v.drops[i];
      dropEls[i].setAttribute('transform',
        `translate(${o.x.toFixed(2)} ${o.y.toFixed(2)}) ` +
        `scale(${o.sx.toFixed(3)} ${o.sy.toFixed(3)})`);
      dropEls[i].setAttribute('opacity', o.op.toFixed(3));
    }

    /* 五官跟随：云走开时整张脸朝它偏一点（用户 2026-10-04 第九轮口径「大一点点」= 8 px）。
       ⚠️ 五官（两只眼 + 嘴）是**同一张图**，只能**整层平移** —— 写在外层组 `#earthFace` 上，
          三张眼图各自仍带静态 EARTH_T，两者叠加成 `translate(dx dy) · EARTH_T`。
       ⚠️ 偏移量是 **viewBox 坐标**：`#earthFace` 在 `#earthBreath` 里，
          而 #earthBreath 的呼吸缩放 ≈ 1.00，所以这里写的 (dx, dy) 就是画面上看到的位移。 */
    faceEl.setAttribute('transform',
      `translate(${v.eyeDX.toFixed(3)} ${v.eyeDY.toFixed(3)})`);

    /* 眨眼：三态眼按权重切 opacity（相邻两段权重和恒为 1，所以不会闪） */
    eyeEls[0].setAttribute('opacity', v.eyes[0].toFixed(4));
    eyeEls[1].setAttribute('opacity', v.eyes[1].toFixed(4));
    eyeEls[2].setAttribute('opacity', v.eyes[2].toFixed(4));

  }
  gsap.ticker.add(tick);

  return {
    ready: true,
    get blink() { return anim.blinkValue(); },
    /** 探针：上一帧的完整数值快照（只读；`orbitU` 是云轨道的**时间**进度 0~1） */
    get last() { return lastV; },
    /** 调试：立刻眨一次 */
    blinkNow() { anim.blinkNow(); },
    /** 调试 / 探针：立刻让云出门绕一圈（连同叶子那一下） */
    orbitNow() { anim.triggerWhip(); anim.triggerOrbit(); },
    destroy() {
      gsap.ticker.remove(tick);
      ac.abort();
      root.innerHTML = '';
    },
  };
}
