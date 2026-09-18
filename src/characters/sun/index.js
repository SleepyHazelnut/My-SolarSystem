/**
 * 太阳角色：SVG + GSAP 版。
 *
 * 用法：
 *   const sun = mountSun(document.getElementById('sun'), { debug: fn });
 *   sun.destroy();   // 拆 ticker / 监听 / 补间，并把注入的 SVG 清掉
 *
 * 职责划分：
 *   scene.js  图层结构（静态，14 张原图）
 *   anim.js       关键帧 + 状态机 + 混合器（纯逻辑）
 *   本文件         写回 DOM 属性、输入绑定、视线跟随、逐帧时钟
 *
 * 三个常量与旧的 Rive 版语义完全一致：
 *   RANGE      指针离太阳中心多远算「拉满」
 *   MAX_SHIFT  瞳孔最多偏移多少（artboard 单位）
 *   SMOOTH     视线指数滤波系数，越大越跟手
 * 逐帧时钟走 gsap.ticker，视线补间走 gsap.quickTo —— 这两处是 GSAP 真正擅长的。
 */
import gsap from 'gsap';
import { SVG_SCENE } from './scene.js';
import { DEG, createMixer, FX, RING_TILT, ringTiltK } from './anim.js';

/* ============================================================
   视线跟随总开关（2026-09-30 暂时关掉）
   ------------------------------------------------------------
   关掉后眼睛不再跟指针，只保留呼吸 / 眨眼 / 点击点头 / 装饰摆动。
   ⚠️ **代码全部保留** —— 补间、监听、三个参数、debug 面板都还在，
   只是把写进 #look 的位移乘 0。改回 `true` 即可完全复原，无需重写。
   也可以在挂载时逐实例覆盖：mountSun(root, { look: true })。
   ============================================================ */
export const LOOK_FOLLOW = false;

/* ============================================================
   入场（2026-09-30）
   ------------------------------------------------------------
   页面加载时角色直接以静止姿态出现，少了「登场」这一下。
   这是一次性的**镜头级**效果，不是状态 —— 所以它写在 index.js 而不是 anim.js：
   anim.js 每帧输出的是「角色状态」，入场是叠在它外面的一层，结束后完全不参与。
   ⚠️ 缩放写在 #sun 上（它的局部原点就是太阳中心，所以是原地放大不是偏移放大），
      星环前后两层 / #crownGroup / 发夹都是它的子节点，会自动跟着一起弹入。
   ⚠️ `prefers-reduced-motion: reduce` 时直接跳到终态（见 mountSun 里的 REDUCED）。
   ============================================================ */
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

export function mountSun(root, { debug, look = LOOK_FOLLOW, glow = FX.sparkGlow, intro = true } = {}) {
  if (!root) throw new Error('mountSun: 缺少挂载容器');

  root.innerHTML = SVG_SCENE;

  /* 所有 window 级监听统一挂到它上面，destroy() 时一次清干净 */
  const ac = new AbortController();
  const mixer = createMixer();

  /* ============================================================
     4. 写回 DOM（每帧写绝对値，不叠乘）
        ============================================================ */
  const $ = (s) => root.querySelector(s);
  const sunEl = $('#sun');
  const sceneEl = $('#scene');
  /* 星环拆成前后两层（2026-10-01）：两半共用同一份 transform 字符串，
     切分线（clip rect 的 y）跟着 ring.y 走。详见 scene.js <defs> 的注释。 */
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
     ⚠️ x/y 是**烘死的绝对坐标**，不是「相对皇冠的偏移」—— 所以它们和
     `scene.js` 里皇冠的 `scale` 是**绑死的**：皇冠一改缩放，四颗星的位置必须重算，
     否则会「脱开」（星光还留在原地，皇冠已经变大了）。
     现值对应 **crownScale = 0.115**，由 `_draft/sun-tuner.html` 的
     `sparkPlacements()` 算出（模型：皇冠位置 + 整组偏移 + R(冠角+星角)·(画布中心→星心)·crownScale）。
     重算脚本：`_draft/_verify-handoff.mjs`（它同时用 0.10 复现旧值、用 0.115 复现新值做双向自检）。 */
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
       FLOWER_P  花盘自身的内容中心 —— 圆盘绕中心转最自然
       LEAF_P    叶的**梗根**，不是叶片中心 —— 梗根在花背后，所以叶子看着是
                 从花背后长出来再摆，而不是绕叶片中心自转
     花与叶的支点相距 17 个单位、且都在花盘背后，所以分开摆也不会看出「断开」。 */
  const CROWN_P = [-98, -134], FLOWER_P = [65, -61.5], LEAF_P = [73, -46];

  /* 每颗星光的**径向单位向量** = 星心 − 皇冠中心（2026-09-30，配合星光迸射）。
     皇冠的摇摆就是绕 CROWN_P 转的，所以这个方向在 #crownGroup 的局部坐标系里
     是固定的，可以跟 SPARKS 一起烘死 —— 不用每帧算。 */
  const SPARK_DIR = SPARKS.map(([, x, y]) => {
    const dx = x - CROWN_P[0], dy = y - CROWN_P[1];
    const n = Math.hypot(dx, dy) || 1;
    return [dx / n, dy / n];
  });

  /* 星光 glow 开关（④）。滤镜本身写在 scene.js 的 <defs> 里（静态），
     这里只决定要不要把它挂到 #sparkGlowGroup 上 —— 摘掉属性 = 完全不过滤镜，
     连那点 GPU 开销都省了。可逐实例覆盖：mountSun(root, { glow: false })。 */
  const GLOW_FILTER = 'url(#sparkGlow)';
  function setGlow(on) {
    if (on) sparkGlowGroupEl.setAttribute('filter', GLOW_FILTER);
    else sparkGlowGroupEl.removeAttribute('filter');
  }
  setGlow(glow);

  function apply(v) {
    /* 入场：只在 introT < INTRO.dur 期间生效，结束（e === 1）后 ik 恒为 1、idy 恒为 0，
       画面逐位回到没有入场时的样子 —— 不会给后续任何一帧留下残留。 */
    const ie = introEase(introT / INTRO.dur);
    const ik = INTRO.fromScale + (1 - INTRO.fromScale) * ie;
    const idy = (1 - ie) * INTRO.dy;
    if (ie < 1) sceneEl.style.opacity = ie.toFixed(3);
    else if (sceneEl.style.opacity) sceneEl.style.opacity = '';

    sunEl.setAttribute('transform',
      `translate(0 ${(v['sun.y'] - 324 + idy).toFixed(4)}) ` +
      `scale(${(v['sun.sx'] * ik).toFixed(6)} ${(v['sun.sy'] * ik).toFixed(6)})`);

    /* ⚠️ 顺序：translate → scale(sx sy) → rotate(rot) → translate(−O)。
       scale 放在 rotate **外面**（2026-09-30 星环 3D 侧转时改的）：
       这样非等比压缩的轴固定在画面方向，环内的图案照转，才读得出「斜着转的环」。
       反过来写（rotate 在外）压缩轴会跟着环一起转，看着像「总有个方向在挤它」。
       sx/sy 不等时只有侧转期间；平时两者相等，所以这个顺序对旧画面没有任何影响。

       ⚠️ 2026-10-01 起环拆成前后两层（#ringImgBack / #ringImgFront），
          **必须吃同一份字符串** —— 两边差一个字节，接缝就会裂开一条缝。
          所以这里算一次、写两遍，别复制粘贴成两份。 */
    const ringTf =
      `translate(${v['ring.x'].toFixed(4)} ${v['ring.y'].toFixed(4)}) ` +
      `scale(${v['ring.sx'].toFixed(6)} ${v['ring.sy'].toFixed(6)}) ` +
      `rotate(${(v['ring.rot'] * DEG).toFixed(4)}) ` +
      `translate(${-RING_OX} ${-RING_OY})`;
    ringImgBackEl.setAttribute('transform', ringTf);
    ringImgFrontEl.setAttribute('transform', ringTf);

    /* 切分线 = 过**环心**的屏幕水平线，但**只在侧转时生效**。
       ------------------------------------------------------------
       环心在 #sun 局部坐标里就是 (ring.x, ring.y) —— 变换的第一个 translate
       把 local 原点（= 内孔圆心 O）映射到那里。
       ⚠️ 必须用环心而不是「固定 y」：点击时 ring.y 摆 ±16，线不跟着走的话
          接缝相对椭圆长轴会偏 16/230 ≈ 7%，环看着像被太阳"啃"了一口。
       ⚠️ 2026-10-01 修正：切分线**不能常驻**在环心。静止时环是个正圆贴在太阳
          外圈，没有深度可读，切一半只会读成「太阳把环啃了一口」。
          真正的读法只在**侧转**时成立 —— 环斜过来了，上半才是远侧、才该沉下去。
          所以按侧转量 k 把切分线往上「停」：k=1 落在环心，k=0 停到环外
          （= 整环归前半层 = 和没分层一模一样）。
       ⚠️ 前后归属跟 RING_TILT.squash 的符号绑定：squash ≤ 1 = 俯视 → 上半是远侧。
          哪天改成 > 1（仰视）或负向侧转，这里自动对调，不用改别处。 */
    const seam = v['ring.y'] - (1 - ringTiltK(v['ring.sx'], v['ring.sy'], v['ring.s'])) * RING_TILT.seamPark;
    const upIsFar = RING_TILT.squash <= 1;
    /* ⚠️ 两个 rect 的跨度必须**各自覆盖整环**，不能只给 1000。
       切分线会被停到环上方 −900，此时前半层的矩形如果只有 1000 高，
       它的下边界就停在 seam + 1000 = 106 —— 环的下半截（到 +250）直接被裁掉。
       所以前半层要从 seam 一直铺到 +SPAN，后半层从 −SPAN 铺到 seam。 */
    const SPAN = 2000;
    ringClipBackRectEl.setAttribute('y', upIsFar ? -SPAN : seam);
    ringClipBackRectEl.setAttribute('height', upIsFar ? SPAN + seam : SPAN);
    ringClipFrontRectEl.setAttribute('y', upIsFar ? seam : -SPAN);
    ringClipFrontRectEl.setAttribute('height', upIsFar ? SPAN : SPAN + seam);

    /* 装饰的滞后摇摆：各自绕自己的支点转（花与叶**分别驱动**，2026-09-30 拆开）。
       ⚠️ 这三个角度单位是「度」—— ring.rot 是从 Rive 搬来的弧度，别混。
       星光在 #crownGroup 里，所以自动跟着皇冠一起摆。
       花/叶写在各自的包装组上，组内的 <image> 保留静态落点，所以「改位置动 image、
       改摇摆动 group」这条规则对发夹同样成立。 */
    crownGroupEl.setAttribute('transform',
      `translate(${CROWN_P[0]} ${CROWN_P[1]}) rotate(${v['crown.rot'].toFixed(4)}) ` +
      `translate(${-CROWN_P[0]} ${-CROWN_P[1]})`);
    flowerWrapEl.setAttribute('transform',
      `translate(${FLOWER_P[0]} ${FLOWER_P[1]}) rotate(${v['flower.rot'].toFixed(4)}) ` +
      `translate(${-FLOWER_P[0]} ${-FLOWER_P[1]})`);
    leafWrapEl.setAttribute('transform',
      `translate(${LEAF_P[0]} ${LEAF_P[1]}) rotate(${v['leaf.rot'].toFixed(4)}) ` +
      `translate(${-LEAF_P[0]} ${-LEAF_P[1]})`);

    /* 点击时的上下点头：写在 #lookNod 上（在 #look 外面），
       所以它和视线补间互不干扰 —— 点头不会被 quickTo 的 0.18s 阻尼吃掉 */
    lookNodEl.setAttribute('transform', `translate(0 ${v['look.y'].toFixed(3)})`);

    /* 星光（2026-09-30 加径向迸射）：`sparkN.d` 是**沿「星心 − 皇冠中心」方向**的位移，
       由 anim.js 的特效层给出（0 → SPARK_PUSH）。位移加在 translate 上，
       烘死的 (x, y) 不动 —— 所以皇冠缩放那条约束（改 scale 要重算 SPARKS）不受影响。 */
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

  /* ============================================================
     5. 输入：enter/exit → hover，down/up → pressed（与 Rive 的四个 Listener 一致）
        up 挂 window：在太阳上按下、移出去再松手也要清掉 pressed，否则会卡在 Clicked
        ============================================================ */
  const hit = $('#hit');
  hit.addEventListener('pointerenter', () => { mixer.setHover(true); }, { signal: ac.signal });
  hit.addEventListener('pointerleave', () => { mixer.setHover(false); }, { signal: ac.signal });
  hit.addEventListener('pointerdown', (e) => {
    mixer.setPressed(true);
    hit.setPointerCapture?.(e.pointerId);
  }, { signal: ac.signal });
  window.addEventListener('pointerup', () => { mixer.setPressed(false); }, { signal: ac.signal });
  window.addEventListener('pointercancel', () => { mixer.setPressed(false); }, { signal: ac.signal });
  window.addEventListener('blur', () => {
    mixer.setPressed(false);
    tx = SUN.x; ty = SUN.y;   // 窗口失焦 → 视线目标回中位
  }, { signal: ac.signal });

  /* ============================================================
     6. 视线跟随：与旧的 Rive 版（旧的 sun 实现）同一套（RANGE 300 / MAX_SHIFT 42 / SMOOTH 14）
        这是 GSAP 真正擅长的部分 —— 逐帧平滑补间
        ⚠️ look = false 时**不注册监听、也不写位移**，但参数与补间原样保留（见文件头的 LOOK_FOLLOW）
        ============================================================ */
  const SUN = { x: 295, y: 324 };
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

  /* ============================================================
     7. 主循环
        ============================================================ */
  let fps = 0;

  let frames = 0, fpsAt = performance.now();

  /* 入场进度（秒）。`prefers-reduced-motion: reduce` 时按「已播完」处理，直接是终态 */
  const REDUCED = typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  let introT = (intro && !REDUCED) ? 0 : INTRO.dur;

  function tick(time, deltaMs) {
    const dt = Math.min(deltaMs / 1000, 0.1);
    if (introT < INTRO.dur) introT += dt;

    /* 视线平滑：指数滤波，与帧率无关 */
    const k = 1 - Math.exp(-SMOOTH * dt);
    sx += (tx - sx) * k;
    sy += (ty - sy) * k;
    const dx = sx - SUN.x, dy = sy - SUN.y;
    const d = Math.hypot(dx, dy);
    let lx = 0, ly = 0;
    if (d > 0.001) {
      const s = Math.min(MAX_SHIFT, MAX_SHIFT * d / RANGE);
      lx = dx / d * s; ly = dy / d * s;
    }

    const v = mixer.step(dt);

    /* 点击时**视线回中**（表情不再跟鼠标），改由 anim.js 的 look.y 点头轨道驱动。
       gaze 由 Clicked 的权重连续推出来，所以进出点击态时视线是平滑收回/放开的，
       不是"啪"地跳回中间。
       look = false（当前默认）时 gaze 恒为 0 —— 补间照常跑，只是目标恒为中位，
       所以重新打开开关时不会「啪」地跳一下，位移本来就是 0。 */
    const gaze = look ? 1 - mixer.weight('Clicked') : 0;
    lookToX(lx * gaze); lookToY(ly * gaze);

    apply(v);

    /* fps：每 500 ms 统计一次，顺手喂给 ?debug=1 的面板 */
    frames++;
    const nowMs = time * 1000;
    if (nowMs - fpsAt >= 500) {
      fps = Math.round(frames * 1000 / (nowMs - fpsAt));
      frames = 0; fpsAt = nowMs;
      debug?.({ ready: true, lx, ly, sx, sy, fps });
    }
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
    /** 手动把视线指向画板坐标上的某点（调试用，与旧的 Rive 版一致） */
    lookAt(x, y) { tx = x; ty = y; },
    /** 开关星光 glow（调试用）—— 不重建场景，只挂/摘 #sparkGlowGroup 上的 filter */
    setGlow(on) {
      if (on) sparkGlowGroupEl.setAttribute('filter', GLOW_FILTER);
      else sparkGlowGroupEl.removeAttribute('filter');
    },
    /**
     * 调试用：把一组值**直接写进 DOM**（绕过混合器）。
     * 逐帧截图脚本靠它回放 Node 侧算出来的真值 —— 走这里而不是在脚本里重抄一遍
     * apply()，是为了避免变换写法两边漂移（改了 index.js 却忘了改脚本，截图就成了假的）。
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
