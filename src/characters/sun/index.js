/**
 * 太阳角色：DOM 与时钟。
 *
 * 用法：
 *   const sun = mountSun(document.getElementById('sun'));
 *   sun.destroy();   // 拆 ticker / 监听 / 补间，并清掉注入的 SVG
 *
 * 职责划分：
 *   scene.js  图层结构（静态，14 张原图）
 *   anim.js   关键帧 + 状态机 + 混合器（纯逻辑）
 *   本文件     写回 DOM 属性、输入绑定、视线跟随、逐帧时钟
 *
 * 三个视线常量：RANGE 指针离中心多远算拉满 / MAX_SHIFT 瞳孔最大偏移 / SMOOTH 滤波系数（越大越跟手）。
 * 逐帧时钟走 gsap.ticker，视线补间走 gsap.quickTo。
 */
import gsap from 'gsap';
import { SVG_SCENE } from './scene.js';
import { DEG, SUN, createMixer, FX, RING_TILT, ringTiltK } from './anim.js';
import { clampDt } from '../../shared/clock.js';
import { approach } from '../../shared/approach.js';
import { bindPointerInput } from '../../shared/input.js';

/* 视线跟随总开关。
   关掉后眼睛不跟指针，只保留呼吸 / 眨眼 / 点击点头 / 装饰摆动。
   补间、监听、三个参数都保留，只是把写进 #look 的位移乘 0 —— 改回 true 即完全复原。
   也可逐实例覆盖：mountSun(root, { look: true })。 */
export const LOOK_FOLLOW = false;

/* 入场：页面加载时的一次性**镜头级**效果，不是角色状态 ——
   所以写在 index.js 而不是 anim.js（anim.js 每帧输出角色状态，入场叠在它外面、结束后不参与）。
   缩放写在 #sun 上（其局部原点就是太阳中心，所以是原地放大）；星环前后两层 / #crownGroup /
   发夹都是它的子节点，会自动跟着弹入。
   `prefers-reduced-motion: reduce` 时直接跳到终态（见 mountSun 里的 REDUCED）。 */
export const INTRO = {
  dur: 0.62,         // 秒
  fromScale: 0.62,   // 起始缩放（相对静止姿态）
  dy: 34,            // 起始下移（Sun 局部单位）
};

/** back-out：末段会冲过 1 再落回来（峰值约 1.10），读起来是「弹一下站住」 */
function introEase(u) {
  if (u >= 1) return 1;
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
}

export function mountSun(root, { look = LOOK_FOLLOW, glow = FX.sparkGlow, intro = true } = {}) {
  if (!root) throw new Error('mountSun: 缺少挂载容器');

  root.innerHTML = SVG_SCENE;

  /* 所有 window 级监听统一挂到它上面，destroy() 时一次清干净 */
  const ac = new AbortController();
  const mixer = createMixer();

  /* 写回 DOM：每帧写绝对値，不叠乘 */
  const $ = (s) => root.querySelector(s);
  const sunEl = $('#sun');
  const sceneEl = $('#scene');
  /* 星环拆成前后两层：两半共用同一份 transform 字符串，切分线（clip rect 的 y）跟着 ring.y 走。
     详见 scene.js <defs> 的注释。 */
  const ringImgBackEl = $('#ringImgBack');
  const ringImgFrontEl = $('#ringImgFront');
  const ringClipBackRectEl = $('#ringClipBackRect');
  const ringClipFrontRectEl = $('#ringClipFrontRect');
  const sparkGlowGroupEl = $('#sparkGlowGroup');
  const crownGroupEl = $('#crownGroup');
  const leafWrapEl = $('#leafWrap');
  const flowerWrapEl = $('#flowerWrap');
  const lookNodEl = $('#lookNod');
  const byId = {};
  ['catFace', 'mouthRound', 'mouthFlat', 'eyeClosed', 'eyeDot'].forEach((id) => { byId[id] = $('#' + id); });

  /* [id, 节点 x, 节点 y, 旋转°, originX×1536, originY×1536]
     x/y 是**烘死的绝对坐标**，与 scene.js 里皇冠的 `scale` **绑死**：皇冠一改缩放，
     四颗星的位置必须重算，否则会脱开。
     现值对应 crownScale = 0.115，由 `_draft/sun-tuner.html` 的 `sparkPlacements()` 算出；
     重算脚本 `_draft/_verify-handoff.mjs`（用 0.10 复现旧值、0.115 复现新值做双向自检）。 */
  const SPARKS = [
    ['spark1', -169.1432, -128.1489, -43.0005,  255.4982, 537.9994],
    ['spark2', -102.2584, -198.0677, -43.0005, 1095.5059, 489.9994],
    ['spark3', -118.4153, -182.7645, -43.0005,  902.0006, 491.5046],
    ['spark4', -145.1534, -156.8888, -43.0005,  578.5037, 497.4950],
  ];
  SPARKS.forEach(([id]) => { byId[id] = $('#' + id); });
  const RING_OX = 0.5146 * 1536, RING_OY = 0.5244 * 1536;
  /* 装饰的旋转支点 = 它们在 Sun 坐标系里的枢轴（**与 scene.js 里各层的静态落点不是一回事**）：
       CROWN_P   皇冠中心
       FLOWER_P  花盘内容中心（圆盘绕中心转最自然）
       LEAF_P    叶的**梗根**（不是叶片中心）—— 梗根在花背后，所以叶子看着是从花背后长出来再摆
     花与叶的支点相距 17 个单位、且都在花盘背后，所以分开摆也不会看出断开。 */
  const CROWN_P = [-98, -134], FLOWER_P = [65, -61.5], LEAF_P = [73, -46];

  /* 每颗星光的**径向单位向量** = 星心 − 皇冠中心（配合星光迸射）。
     皇冠的摇摆绕 CROWN_P 转，所以这个方向在 #crownGroup 的局部坐标系里固定，
     可跟 SPARKS 一起烘死，不用每帧算。 */
  const SPARK_DIR = SPARKS.map(([, x, y]) => {
    const dx = x - CROWN_P[0], dy = y - CROWN_P[1];
    const n = Math.hypot(dx, dy) || 1;
    return [dx / n, dy / n];
  });

  /* 星光 glow 开关：滤镜写在 scene.js 的 <defs> 里（静态），这里只决定要不要把它挂到
     #sparkGlowGroup 上 —— 摘掉属性 = 完全不过滤镜，连 GPU 开销都省。
     可逐实例覆盖：mountSun(root, { glow: false })。 */
  const GLOW_FILTER = 'url(#sparkGlow)';
  function setGlow(on) {
    if (on) sparkGlowGroupEl.setAttribute('filter', GLOW_FILTER);
    else sparkGlowGroupEl.removeAttribute('filter');
  }
  setGlow(glow);

  function apply(v) {
    /* 入场：只在 introT < INTRO.dur 期间生效，结束后 ik 恒为 1、idy 恒为 0，
       画面逐位回到没有入场时的样子。 */
    const ie = introEase(introT / INTRO.dur);
    const ik = INTRO.fromScale + (1 - INTRO.fromScale) * ie;
    const idy = (1 - ie) * INTRO.dy;
    if (ie < 1) sceneEl.style.opacity = ie.toFixed(3);
    else if (sceneEl.style.opacity) sceneEl.style.opacity = '';

    sunEl.setAttribute('transform',
      `translate(0 ${(v['sun.y'] - SUN.y + idy).toFixed(4)}) ` +
      `scale(${(v['sun.sx'] * ik).toFixed(6)} ${(v['sun.sy'] * ik).toFixed(6)})`);

    /* 顺序：translate → scale(sx sy) → rotate(rot) → translate(−O)。
       scale 放在 rotate **外面**（星环 3D 侧转时需要）：非等比压缩的轴固定在画面方向，
       环内图案照转，才读得出「斜着转的环」；反过来写压缩轴会跟着环转，看着像总有个方向在挤它。
       sx/sy 只在侧转期间不等，平时相等，所以这个顺序对旧画面无影响。
       环拆成前后两层后**必须吃同一份字符串** —— 差一个字节接缝就会裂开，所以算一次写两遍。 */
    const ringTf =
      `translate(${v['ring.x'].toFixed(4)} ${v['ring.y'].toFixed(4)}) ` +
      `scale(${v['ring.sx'].toFixed(6)} ${v['ring.sy'].toFixed(6)}) ` +
      `rotate(${(v['ring.rot'] * DEG).toFixed(4)}) ` +
      `translate(${-RING_OX} ${-RING_OY})`;
    ringImgBackEl.setAttribute('transform', ringTf);
    ringImgFrontEl.setAttribute('transform', ringTf);

    /* 切分线 = 过**环心**的屏幕水平线，但**只在侧转时生效**。
       环心在 #sun 局部坐标里就是 (ring.x, ring.y) —— 变换的第一个 translate 把局部原点
       （= 内孔圆心 O）映射到那里。必须用环心而不是固定 y：点击时 ring.y 摆 ±16，
       线不跟着走的话接缝相对椭圆长轴会偏 16/230 ≈ 7%。
       切分线**不能常驻**环心：静止时环是正圆贴在外圈，没有深度可读，切一半只会读成
       「太阳把环啃了一口」；真正的读法只在侧转时成立。所以按侧转量 k 把线往上「停」：
       k=1 落在环心，k=0 停到环外（= 整环归前半层 = 和没分层一样）。
       前后归属跟 RING_TILT.squash 的符号绑定：squash ≤ 1 = 俯视 → 上半是远侧；
       改成 > 1 或负向侧转时这里自动对调。 */
    const seam = v['ring.y'] - (1 - ringTiltK(v['ring.sx'], v['ring.sy'], v['ring.s'])) * RING_TILT.seamPark;
    const upIsFar = RING_TILT.squash <= 1;
    /* 两个 rect 的跨度必须**各自覆盖整环**，不能只给 1000：
       切分线会被停到环上方 −900，此时前半层矩形若只有 1000 高，下边界就停在
       seam + 1000 = 106，环的下半截（到 +250）直接被裁掉。
       所以前半层从 seam 铺到 +SPAN，后半层从 −SPAN 铺到 seam。 */
    const SPAN = 2000;
    ringClipBackRectEl.setAttribute('y', upIsFar ? -SPAN : seam);
    ringClipBackRectEl.setAttribute('height', upIsFar ? SPAN + seam : SPAN);
    ringClipFrontRectEl.setAttribute('y', upIsFar ? seam : -SPAN);
    ringClipFrontRectEl.setAttribute('height', upIsFar ? SPAN : SPAN + seam);

    /* 装饰的滞后摇摆：各自绕自己的支点转（花与叶**分别驱动**）。
       这三个角度单位是「度」—— ring.rot 是从旧实现搬来的弧度，别混。
       星光在 #crownGroup 里，自动跟着皇冠一起摆。
       花/叶写在各自的包装组上，组内 <image> 保留静态落点 —— 「改位置动 image、改摇摆动 group」。 */
    crownGroupEl.setAttribute('transform',
      `translate(${CROWN_P[0]} ${CROWN_P[1]}) rotate(${v['crown.rot'].toFixed(4)}) ` +
      `translate(${-CROWN_P[0]} ${-CROWN_P[1]})`);
    flowerWrapEl.setAttribute('transform',
      `translate(${FLOWER_P[0]} ${FLOWER_P[1]}) rotate(${v['flower.rot'].toFixed(4)}) ` +
      `translate(${-FLOWER_P[0]} ${-FLOWER_P[1]})`);
    leafWrapEl.setAttribute('transform',
      `translate(${LEAF_P[0]} ${LEAF_P[1]}) rotate(${v['leaf.rot'].toFixed(4)}) ` +
      `translate(${-LEAF_P[0]} ${-LEAF_P[1]})`);

    /* 点击时的上下点头：写在 #lookNod 上（在 #look 外面），与视线补间互不干扰 ——
       点头不会被 quickTo 的 0.18s 阻尼吃掉 */
    lookNodEl.setAttribute('transform', `translate(0 ${v['look.y'].toFixed(3)})`);

    /* 星光径向迸射：`sparkN.d` 是**沿「星心 − 皇冠中心」方向**的位移（0 → SPARK_PUSH），
       位移加在 translate 上，烘死的 (x, y) 不动 —— 皇冠缩放那条约束不受影响。 */
    SPARKS.forEach(([id, x, y, rot, ox, oy], i) => {
      const g = byId[id];
      const d = v[id + '.d'] || 0;
      const [ux, uy] = SPARK_DIR[i];
      g.setAttribute('transform',
        `translate(${(x + ux * d).toFixed(4)} ${(y + uy * d).toFixed(4)}) rotate(${rot}) ` +
        `scale(${v[id + '.s'].toFixed(6)}) translate(${-ox} ${-oy})`);
      g.setAttribute('opacity', v[id + '.op'].toFixed(4));
    });

    byId.catFace.setAttribute('opacity', v['catFace.op'].toFixed(4));
    byId.mouthRound.setAttribute('opacity', v['mouthRound.op'].toFixed(4));
    byId.mouthFlat.setAttribute('opacity', v['mouthFlat.op'].toFixed(4));
    byId.eyeClosed.setAttribute('opacity', v['eyeClosed.op'].toFixed(4));
    byId.eyeDot.setAttribute('opacity', v['eyeDot.op'].toFixed(4));
  }

  /* 输入：enter/exit → hover，down/up → pressed。
     up 挂 window：在太阳上按下、移出去再松手也要清掉 pressed，否则会卡在 Clicked。 */
  const hit = $('#hit');
  bindPointerInput(hit, ac, {
    onEnter: () => mixer.setHover(true),
    /* 太阳这里**不清 pressed**（地球才清）—— 按住时移出太阳再松手，收尾由 window 上的 up 负责。 */
    onLeave: () => mixer.setHover(false),
    onDown: (e) => {
      mixer.setPressed(true);
      hit.setPointerCapture?.(e.pointerId);
    },
    onUp: () => mixer.setPressed(false),
    onCancel: () => mixer.setPressed(false),
    onBlur: () => {
      mixer.setPressed(false);
      tx = SUN.x; ty = SUN.y;   // 窗口失焦 → 视线目标回中位
    },
  });

  /* 视线跟随：RANGE 300 / MAX_SHIFT 42 / SMOOTH 14。
     look = false 时**不注册监听、也不写位移**，但参数与补间原样保留（见文件头 LOOK_FOLLOW）。 */
  const RANGE = 300, MAX_SHIFT = 42, SMOOTH = 14;

  const lookEl = $('#look');
  const lookToX = gsap.quickTo(lookEl, 'x', { duration: 0.18, ease: 'power2.out' });
  const lookToY = gsap.quickTo(lookEl, 'y', { duration: 0.18, ease: 'power2.out' });

  let tx = SUN.x, ty = SUN.y, sx = SUN.x, sy = SUN.y;
  const stage = root;

  if (look) {
    window.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      if (!r.width) return;
      tx = (e.clientX - r.left) / r.width * 590;
      ty = (e.clientY - r.top) / r.height * 600;
    }, { passive: true, signal: ac.signal });
  }

  /* 主循环 */

  /* 入场进度（秒）。`prefers-reduced-motion: reduce` 时按已播完处理，直接是终态 */
  const REDUCED = typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  let introT = (intro && !REDUCED) ? 0 : INTRO.dur;

  function tick(_time, deltaMs) {
    const dt = clampDt(deltaMs);
    if (introT < INTRO.dur) introT += dt;

    /* 视线平滑：指数滤波，与帧率无关 */
    sx = approach(sx, tx, SMOOTH, dt);
    sy = approach(sy, ty, SMOOTH, dt);
    const dx = sx - SUN.x, dy = sy - SUN.y;
    const d = Math.hypot(dx, dy);
    let lx = 0, ly = 0;
    if (d > 0.001) {
      const s = Math.min(MAX_SHIFT, MAX_SHIFT * d / RANGE);
      lx = dx / d * s; ly = dy / d * s;
    }

    const v = mixer.step(dt);

    /* 点击时**视线回中**（表情改由 anim.js 的 look.y 点头轨道驱动）。
       gaze 由 Clicked 权重连续推出，所以进出点击态时视线平滑收回/放开，不是"啪"地跳回中间。
       look = false 时 gaze 恒为 0 —— 补间照常跑、目标恒为中位，重新打开开关不会跳一下。 */
    const gaze = look ? 1 - mixer.weight('Clicked') : 0;
    lookToX(lx * gaze); lookToY(ly * gaze);

    apply(v);
  }
  gsap.ticker.add(tick);

  /* 首帧：立刻写一次静止姿态，别等到第一个 ticker 回调才出现 */
  apply(mixer.values);

  return {
    ready: true,
    /** 视线跟随是否开启（见文件头 LOOK_FOLLOW）。关掉后眼睛不跟指针，其余行为不变 */
    look,
    /** 星光 glow 是否开启（见 anim.js 的 FX.sparkGlow） */
    glow,
    get state() { return mixer.state; },
    get weights() { return mixer.weights; },
    get times() { return mixer.times; },
    get inputs() { return mixer.inputs; },
    get values() { return mixer.values; },
    /** 手动把视线指向画板坐标上的某点 */
    lookAt(x, y) { tx = x; ty = y; },
    /** 开关星光 glow —— 不重建场景，只挂/摘 #sparkGlowGroup 上的 filter */
    setGlow,
    /**
     * 把一组值**直接写进 DOM**（绕过混合器）。
     * 逐帧截图脚本靠它回放 Node 侧算出的真值 —— 走这里而不是在脚本里重抄一遍 apply()，
     * 是为了避免变换写法两边漂移。
     */
    applyValues(v) { apply(v); },
    destroy() {
      gsap.ticker.remove(tick);
      ac.abort();
      gsap.killTweensOf(lookEl);
      root.innerHTML = '';
    },
  };
}
