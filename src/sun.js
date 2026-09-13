/**
 * 太阳角色组件：把 Rive 运行时和 `rive/scene.rml` 编出来的 `.riv` 接起来，
 * 并在宿主侧实现「眼睛跟随鼠标」（写 view model 的 lookX / lookY）。
 */
import { Rive, RuntimeLoader, Layout, Fit, Alignment } from '@rive-app/canvas';
import wasmUrl from '@rive-app/canvas/rive.wasm?url';
import rivUrl from '../rive/build/rive.riv?url';

// 不指定的话运行时会去 unpkg.com 拉 wasm（官方文档写明了这个默认行为）。
// 自托管要求文件版本与 npm 包版本一致，不一致会在运行时崩。
RuntimeLoader.setWasmUrl(wasmUrl);
RuntimeLoader.awaitInstance().catch(() => {}); // 尽早开始下载 + 编译

// 以下常量与 rive/scene.rml 对齐
const ARTBOARD = { w: 590, h: 600 };  // Artboard 尺寸
const SUN = { x: 295, y: 324 };       // Sun 节点在画板上的位置
const STATE_MACHINE = 'State Machine 1';

// 视线跟随参数
const RANGE = 300;      // 触发距离（画板像素）
const MAX_SHIFT = 42;   // 最大偏移（Look 节点局部单位 ≈ 屏幕 10px）
const SMOOTH = 14;      // 平滑系数，k = 1 - exp(-14 * dt)，帧率无关

/**
 * 把太阳挂到 canvas 上。
 *
 * @param {HTMLCanvasElement} canvas
 * @param {{ debug?: (state: object) => void }} [options]
 * @returns {{ rive: Rive|null, ready: boolean, lookAt(x:number,y:number):void, destroy():void }}
 */
export function mountSun(canvas, { debug } = {}) {
  let rive = null;
  let lookX = null;
  let lookY = null;
  let ready = false;
  let raf = 0;
  let last = 0;
  let fps = 0;
  let frames = 0;
  let fpsAt = 0;
  let error = '';

  // 指针目标 / 平滑后的指针（都在画板坐标系里）
  let tx = SUN.x, ty = SUN.y;
  let sx = SUN.x, sy = SUN.y;

  const onPointerMove = (e) => {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    tx = (e.clientX - r.left) / r.width * ARTBOARD.w;
    ty = (e.clientY - r.top) / r.height * ARTBOARD.h;
  };

  // 指针离开窗口 → 视线慢慢回到中位
  const onBlur = () => { tx = SUN.x; ty = SUN.y; };

  const onResize = () => { rive?.resizeDrawingSurfaceToCanvas(); };

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('blur', onBlur);
  window.addEventListener('resize', onResize);

  function tick(now) {
    raf = requestAnimationFrame(tick);

    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    let lx = 0, ly = 0;
    if (ready) {
      // 指数平滑：k 与帧率无关，60Hz / 120Hz 手感一致
      const k = 1 - Math.exp(-SMOOTH * dt);
      sx += (tx - sx) * k;
      sy += (ty - sy) * k;

      const dx = sx - SUN.x;
      const dy = sy - SUN.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.001) {
        // 越远偏得越多，到 RANGE 封顶；方向取单位向量，眼睛朝指针那侧偏过去
        const s = Math.min(MAX_SHIFT, MAX_SHIFT * d / RANGE);
        lx = dx / d * s;
        ly = dy / d * s;
      }

      // 写 view model；运行时下一帧 advance 时才作用到画面
      lookX.value = lx;
      lookY.value = ly;
    }

    frames++;
    if (now - fpsAt >= 500) {
      fps = Math.round(frames * 1000 / (now - fpsAt));
      frames = 0;
      fpsAt = now;
    }

    debug?.({ ready, lx, ly, sx, sy, fps, error });
  }

  rive = new Rive({
    src: rivUrl,
    canvas,
    autoplay: true,
    // 注意用单数 stateMachine：复数 stateMachines 已废弃，控制台会告警
    stateMachine: STATE_MACHINE,
    autoBind: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),

    onLoad() {
      rive.resizeDrawingSurfaceToCanvas();
      const vmi = rive.viewModelInstance;
      if (!vmi) {
        error = 'viewModelInstance 为空';
        return;
      }
      lookX = vmi.number('lookX');
      lookY = vmi.number('lookY');
      if (!lookX || !lookY) {
        error = '找不到 lookX / lookY 属性';
        return;
      }
      ready = true;
    },

    onLoadError(err) {
      error = '加载失败：' + (err?.message ?? String(err));
      debug?.({ ready: false, lx: 0, ly: 0, sx, sy, fps: 0, error });
    },
  });

  last = performance.now();
  fpsAt = last;
  raf = requestAnimationFrame(tick);

  return {
    get rive() { return rive; },
    get ready() { return ready; },
    /** 手动把视线指向画板坐标上的某点（调试用） */
    lookAt(x, y) { tx = x; ty = y; },
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onResize);
      rive?.cleanup();
      rive = null;
    },
  };
}
