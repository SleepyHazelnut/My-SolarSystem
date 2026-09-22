/**
 * 地球角色：DOM 与时钟。
 *
 * 用法：
 *   const earth = mountEarth(document.getElementById('earth'));
 *   earth.destroy();   // 拆 ticker / 监听，并清掉注入的 SVG
 *
 * 职责划分（与太阳同一套）：
 *   scene.js  图层结构（静态，10 张原图）
 *   anim.js   几何落点 + 动画参数 + 每帧数值计算（纯逻辑，不碰 DOM）
 *   本文件     把数值写回 DOM 属性、绑定输入、跑逐帧时钟
 *
 * 地球**没有状态机**：呼吸 / 摆动 / 眨眼 / 雨 / 云漂都是程序化正弦，
 * 只有一条「松手触发」的时间线 —— 四个通道同时起跑、各自收：
 *   球体回弹 0.8 s / 叶片轻弹 0.12 + 1.25 s /
 *   云 4.4 环绕（起跳弹叠在头上、蓄力叠在尾上）+ 0.45 到家释放 = 4.85 s / 开心表情 5.65 s。
 * ⚠️ 云的 4.4 s 是**纯环绕**，与 `HAPPY.swingDur` 对齐的是它；
 * 弹跳**不占额外时间** —— 起跳弹与出行同帧起跑、尾段蓄力、到家那一帧立刻释放（见 anim.js 的 ORBIT）。
 * ⚠️ 触发点是**松手**（pointerup）不是按下 —— 按下只做轻微压缩当预备，见下面 `bindPointerInput`。
 * 所以这一层不做混合，只做「取数 → 写属性」。
 */
import gsap from 'gsap';
import { EARTH_SCENE } from './scene.js';
import {
  CX, CY, CLOUD, SPROUT, SPROUT_PIVOT_T, FACE_C, DROP_D, createEarthAnim,
} from './anim.js';
import { clampDt } from '../../shared/clock.js';
import { INTRO, createIntro } from '../../shared/intro.js';
import { bindPointerInput } from '../../shared/input.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/* 入场：形状（`dur` / `fromScale` / `dy`）与曲线在 `shared/intro.js`，与太阳**同一组**；
   地球只多一个 `INTRO_DELAY` —— 太阳先弹入、地球晚 0.15 s 跟上，并排读作级联。

   作用点与太阳不同，别照抄：太阳写在 `#sun` 上 —— 它的父组已经 `translate(SUN.x SUN.y)`，
   局部原点就是太阳中心，所以 `scale` 天然是原地放大。地球的 `#earthBob` 直接坐在 viewBox
   原点上，`scale` 会绕画布左上角放大（整颗球被甩出去），所以必须自己补一对
   `translate(CX CY) … translate(-CX -CY)` 把缩放支点搬回球心。

   缩放 / 下移 / 淡入都写在 `#earthBob` 上 —— 云、雨、芽、球体、五官都是它的子节点，
   会自动跟着弹入。命中区 `#earthHit` 在 `#earthBob` **外面**，不跟着缩（否则贴边 hover 会抖）。
   `prefers-reduced-motion: reduce` 时直接跳到终态（见 mountEarth 里的 REDUCED）。 */
export { INTRO };
const INTRO_DELAY = 0.15;   // 秒 —— 比太阳晚起跑多久

/**
 * 挂载地球。
 * @param root  容器元素
 * @param intro 是否播入场（`false` = 直接是终态，给逐帧截图脚本用）
 */
export function mountEarth(root, { intro = true } = {}) {
  if (!root) throw new Error('mountEarth: 缺少挂载容器');

  root.innerHTML = EARTH_SCENE;

  const $ = (s) => root.querySelector(s);
  const sceneEl = $('#earthScene');
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
  /* 「整颗球跟着歪」的两个空壳组（球体 / 小芽）。云的前层夹在它们中间，所以拆成两组 ——
     每帧必须吃**同一份** transform，否则球歪了芽没歪，芽就「掉」在球外面。 */
  const tiltBallEl = $('#earthTiltBall');
  const tiltSproutEl = $('#earthTiltSprout');
  /* 三态眼按名字对上 —— eyeWeights() 返回 [open, half, closed]，这里不靠数组下标，
     免得将来挪了 DOM 顺序或改了权重顺序就静默错位。 */
  const eyeEls = {
    open: $('#earthEyeOpen'),
    half: $('#earthEyeHalf'),
    closed: $('#earthEyeClosed'),
  };
  const happyEl = $('#earthFaceHappy');

  /* 图层：模板里芽排在球体**之后**（= 球上）。SPROUT.layer = 0 时挪到 #earthBreath
     最前面 —— 即沉到球体下面。用 DOM 顺序调 z，不是 z-index（SVG 里 z-index 不生效）。 */
  if (!SPROUT.layer) {
    breathEl.insertBefore(sproutWrapEl, breathEl.firstChild);
  }

  /* 茎**不动**：只吃静态倾角 rot，写一次就再也不碰（所以不在主循环里）。
     rot 三份都要吃 —— 只给叶子的话，叶子和茎在静态位就对不上。 */
  sproutStemEl.setAttribute('transform',
    SPROUT_PIVOT_T + `rotate(${SPROUT.rot.toFixed(3)} ${SPROUT.pivotX} ${SPROUT.pivotY})`);

  /* 动画实例（纯计算）：随机落点、悬停/按压权重、眨眼计时器都在里面 */
  const anim = createEarthAnim();

  /* 云当前用的是哪一层 —— 只在**变化**时改 DOM（切换点固定，每帧写是白费）。
     初始值与模板一致：前层可见、后层 display:none。 */
  let behindNow = false;

  /* 雨滴元素：形状是死的，落点每帧由 anim 给 */
  const dropEls = anim.drops.map(() => {
    const el = document.createElementNS(SVG_NS, 'path');
    el.setAttribute('d', DROP_D);
    el.setAttribute('fill', '#7CC3E8');
    rainEl.appendChild(el);
    return el;
  });

  /* 所有 window 级监听统一挂到它上面，destroy() 时一次清干净 */
  const ac = new AbortController();

  /* 输入：enter/exit → hover，down/up → pressed。
     ⚠️ **按下只做预备，结果全在松手**（用户 2026-10-05 给的五阶段表）：
       · 按下 → 只有「轻微压缩」（`EARTH.pressRate` 决定多快压到位，≈90 ms 读满）。
         **不切表情、不启动云** —— 否则所有效果同时炸开，按下那一下没有预备感；
       · 松手 → 球体回弹 + 叶片轻弹 + 云出门 + 开心交叉淡入（四个 `trigger*` 一起）。
     `up` 挂 window：在地球上按下、移出去再松手也要清掉 pressed。
     ⚠️ 指针中途移出球体（`onLeave`）会把 `pressed` 清掉 → 那次松手**不触发**，
     读作「取消」；所以 `onUp` 里要先看一眼 `pressed` 还在不在。 */
  let hovered = false, pressed = false;

  /* 「松手」那一套 —— 触发点与探针共用，免得两处漂移 */
  const release = () => {
    anim.triggerRelease();     // 球体回弹
    anim.triggerWhip();        // 叶片延迟一点再摆（延迟在 anim 里，见 EARTH.whipDelay）
    anim.triggerOrbit();       // 云出门绕一圈（与表情同时起、同时收）
    anim.triggerHappy();       // 开心表情交叉淡入
  };

  bindPointerInput(hitEl, ac, {
    onEnter: () => { hovered = true; },
    /* 地球这里**连带清掉 pressed**（太阳不清）—— 指针移出球体就算松手，且不触发结果。 */
    onLeave: () => { hovered = false; pressed = false; },
    onDown: () => { pressed = true; },
    onUp: () => {
      if (!pressed) return;      // 已经移出过球体 = 取消，不触发
      pressed = false;
      release();
    },
    /* ⚠️ 这两条太阳也有，地球当初漏了 —— 少了它们，按下后**窗口失焦**（Alt+Tab）或触摸被
       `pointercancel` 接管时 `pressed` 会永久停在 true，球卡在压扁 14% 的状态
       （`onLeave` 在这种情况下不一定触发），要等下一次成功的「按下 + 松手」才复位。 */
    onCancel: () => { pressed = false; },
    onBlur: () => { pressed = false; },
  });

  /* 上一帧算出的全部数值（只读快照），给探针用。
     探针**不要**靠 `performance.now()` 反推进度：截图会把 rAF 卡住 ~300 ms，而
     `clampDt` 上限 0.1 s，每卡一次动画时钟就丢 ~0.2 s，墙钟与动画进度会越差越远。
     读快照里的 `orbitU` 才是动画自己的时间轴。 */
  let lastV = null;

  /* 入场进度（见 shared/intro.js）。`prefers-reduced-motion: reduce` 时按已播完处理，直接是终态。
     `INTRO_DELAY` 用**负的起始进度**实现：延迟期间 `easeOutBack` 返回 0 →
     地球停在「缩到 0.62 + 下移 34 + 完全透明」，到点才开始弹。 */
  const REDUCED = typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  const introFx = createIntro({ delay: INTRO_DELAY, enabled: intro && !REDUCED });

  function tick(_time, deltaMs) {
    const dt = clampDt(deltaMs);
    introFx.step(dt);
    const v = anim.step(dt, { hovered, pressed });
    lastV = v;

    /* 入场：只在没走完 `INTRO.dur` 期间生效，结束后 `k` 恒为 1、`dy` 恒为 0、opacity 清空 ——
       画面逐位回到没有入场时的样子（`introTf` 也退化成空串，字符串与入场前逐字节相同）。 */
    const iv = introFx.current();
    const ik = iv.k, idy = iv.dy;
    if (iv.opacity === null) { if (sceneEl.style.opacity) sceneEl.style.opacity = ''; }
    else sceneEl.style.opacity = iv.opacity;

    /* 浮动 + 左右摆：绕**球心**转，所以读作「站着的球在晃」而不是原地自转。
       入场的缩放叠在同一条 transform 上 —— 支点要自己搬回球心（见 INTRO 的注释）。 */
    const introTf = ik === 1 ? ''
      : `translate(${CX} ${CY}) scale(${ik.toFixed(6)}) translate(${-CX} ${-CY}) `;
    bobEl.setAttribute('transform',
      `translate(0 ${(v.bobY + idy).toFixed(3)}) ` + introTf +
      `rotate(${v.sway.toFixed(3)} ${CX} ${CY})`);
    /* 呼吸 / 挤压：绕球心缩放（先 translate 到球心、缩完再挪回来）。
       y 比 x 多 35%，所以是上下拉长的呼吸，不是等比膨胀 */
    breathEl.setAttribute('transform',
      `translate(${CX} ${CY}) scale(${v.breathSX.toFixed(5)} ${v.breathSY.toFixed(5)}) ` +
      `translate(${-CX} ${-CY})`);

    /* 叶：**茎不动**，只有两片叶摆。两份叶吃**同一份** transform —— 绕同一圆心、同一角度，
       所以中间永不裂。圆心是**素材坐标**，外层 <g> 已把坐标系搬到 viewBox 上，
       所以必须先 translate(-pivot) 再 rotate，否则会绕画布外一点转、整支被甩飞。 */
    const leafT = SPROUT_PIVOT_T + `rotate(${v.leafA.toFixed(3)} ${SPROUT.pivotX} ${SPROUT.pivotY})`;
    sproutLeafLEl.setAttribute('transform', leafT);
    sproutLeafREl.setAttribute('transform', leafT);

    /* 云：位置 + 倾角 + 沿横向的非等比拉伸。
       顺序 = `translate(位置) rotate(倾角) scale(sx sy) translate(-素材中心)`：
       缩放轴挂在**倾角之后**，拉伸方向跟着云的姿态走（读作被拉扁）；圆心是素材坐标，末尾仍要 translate(-cx -cy)。
       云有**两份** <image>（同一张图、同一份 transform），只有显示哪一个不同：
       `behind` = 回程弧那段 → 用排在球体**之前**的那份（画在球下）。
       切换点在最左点，那一刻云离球体还有 29 px，所以切换本身看不见。
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
       下落时纵向拉长、横向略收 —— 读作越落越快。雨竖直落，不带风。
       ⚠️ `#earthRain` 挂在 `#earthBreath` **外面**（用户 2026-10-06：「雨就不用有呼吸了」）
       —— 雨不跟着呼吸一张一缩、也不跟着点击压扁，只跟着 `#earthBob` 浮动 / 摆动。
       所以这里写的就是画面上看到的位置，不需要按呼吸倍率反算。 */
    for (let i = 0; i < dropEls.length; i++) {
      const o = v.drops[i];
      dropEls[i].setAttribute('transform',
        `translate(${o.x.toFixed(2)} ${o.y.toFixed(2)}) ` +
        `scale(${o.sx.toFixed(3)} ${o.sy.toFixed(3)})`);
      dropEls[i].setAttribute('opacity', o.op.toFixed(3));
    }

    /* 表情：点击变「开心」（时间线在 anim.js 的 HAPPY 那段）。
       ① **交叉淡入**：三态眼 × (1−happyW)、开心图 × happyW。
       ② **点头**：整层 `#earthFace` 平移 (happyDX, happyDY) + 倾斜 happyRot —— 走的是 anim.js
          里 `HAPPY_PATH` 那张表（**用户自己在演示台演的**，见那边注释）**加同相的倾角**。
          开心图和三态眼都在这个组里，所以两层一起动，交叉淡入期间不会出现
          「一张脸在动、另一张不动」。
          位移量是 **viewBox 坐标**：#earthFace 在 #earthBreath 里，而呼吸缩放 ≈ 1.00，
          所以这里写的 (dx, dy) 就是画面上看到的位移。
          倾斜支点用 `FACE_C`（脸的中心，viewBox 坐标）—— 支点放球心会额外把脸平推，
          把轨迹搅乱。`rotate` 正角 = 顺时针，与 anim.js 的 happyRot 同向。
       ③ **整颗球跟着歪**：球体与小芽绕**球心**转 ballRot（= 同一个 happyRot 的 tiltK 份）——
          大陆、云纹、轮廓一起动，读作「真实点头」。
          ⚠️ 五官**不在**这两个组里：它自己已经有同角度的倾斜，再进组会多吃一次绕球心的弧位移
          （脸离球心 43 px，9° 就是 7 px），把用户演的位移顶偏。 */
    faceEl.setAttribute('transform',
      `translate(${v.happyDX.toFixed(3)} ${v.happyDY.toFixed(3)}) ` +
      `rotate(${v.happyRot.toFixed(4)} ${FACE_C.x.toFixed(2)} ${FACE_C.y.toFixed(2)})`);
    const tiltT = `rotate(${v.ballRot.toFixed(4)} ${CX} ${CY})`;
    tiltBallEl.setAttribute('transform', tiltT);
    tiltSproutEl.setAttribute('transform', tiltT);

    /* 眨眼：三态眼按权重切 opacity（相邻两段权重和恒为 1，所以不会闪）。
       开心表情期间整层乘 (1−happyW) 淡出 —— 开心图自带眼睛，此时不该再眨原来的眼。 */
    const [wOpen, wHalf, wClosed] = v.eyes;
    const k = 1 - v.happyW;
    eyeEls.open.setAttribute('opacity', (wOpen * k).toFixed(4));
    eyeEls.half.setAttribute('opacity', (wHalf * k).toFixed(4));
    eyeEls.closed.setAttribute('opacity', (wClosed * k).toFixed(4));
    happyEl.setAttribute('opacity', v.happyW.toFixed(4));

  }
  gsap.ticker.add(tick);
  /* 首帧：立刻按入场的**起始姿态**写一次（起始缩放 + 下移 + opacity 0）。
     不写的话会先以**满尺寸、不透明**画一帧，再跳到 0.62 —— 闪一下。 */
  tick(0, 0);

  return {
    ready: true,
    /** 是否播了入场（`prefers-reduced-motion: reduce` 或 `mountEarth(root, { intro: false })` 时为 false） */
    intro: introFx.playing,
    get blink() { return anim.blinkValue(); },
    /** 探针：上一帧的完整数值快照（只读；`orbitU` 是云轨道的**时间**进度 0~1） */
    get last() { return lastV; },
    /** 立刻眨一次 */
    blinkNow() { anim.blinkNow(); },
    /** 立刻让云出门绕一圈（连同叶子那一下） */
    orbitNow() { anim.triggerWhip(); anim.triggerOrbit(); },
    /** 立刻走一遍**完整的一次松手**（回弹 + 叶轻弹 + 云出门 + 开心淡入）—— 探针用。
        ⚠️ 探针别只调 `happyNow()`：那样脸会动、云和叶不动，录出来的不是产品会播的东西。 */
    releaseNow() { release(); },
    /** 立刻变「开心」表情（交叉淡入 + 左右摆 + 缓缓退回） */
    happyNow() { anim.triggerHappy(); },
    destroy() {
      gsap.ticker.remove(tick);
      ac.abort();
      root.innerHTML = '';
    },
  };
}
