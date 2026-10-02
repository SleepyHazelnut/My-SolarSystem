/**
 * 角色注册表 + `[data-character]` 自动挂载。
 *
 * 加一个星球三步：写角色模块、在 `main.js` 里 `registerCharacter` 一行、
 * 在 HTML 里放一个 `<div class="stage" data-character="<名字>"></div>`。
 * 标称尺寸写在 register 那一行；**怎么排、窄屏怎么缩**是 `style.css` 的事，
 * 这里只把尺寸换算成整行的比例交出去。
 *
 * 注册重名直接抛错；未注册的名字只 warn 并跳过，其余角色照常显示。
 */

/* 行内视觉间距（标称 px）：相邻角色墨迹边缘之间的距离。 */
const VISUAL_GAP = 60;

const REGISTRY = new Map();

export function registerCharacter(name, mount, meta = {}) {
  if (REGISTRY.has(name)) throw new Error(`角色重名：${name}`);
  REGISTRY.set(name, { mount, meta });
}

/** 读一条注册项的标称尺寸。`pad` = 两侧透明边宽；缺 `ink` 时按整幅 viewBox 算。 */
function metrics({ viewBox = [], stageWidth = 0, ink = 0 } = {}) {
  const [w = 0, h = 0] = viewBox;
  const inkW = w ? stageWidth * (ink || w) / w : stageWidth;
  return {
    stageWidth,
    pad: (stageWidth - inkW) / 2,
    height: w ? stageWidth * h / w : 0,
  };
}

/** 把一行角色的标称尺寸换算成 CSS 变量。
 *  分母 = 视觉总宽 = Σ墨迹宽 + 角色数 × `VISUAL_GAP`：
 *    · `--stage-w-pct`      舞台宽 / 视觉总宽
 *    · `--stage-margin-pct` 透明边扣掉 `VISUAL_GAP/2`
 *    · `--row-ar`（根元素） 视觉总宽 / 最高舞台 —— 给 `.hero` 当 `aspect-ratio` */
function applyRow(targets) {
  const rows = targets.map(({ entry }) => metrics(entry.meta));
  const span = rows.reduce((s, r) => s + r.stageWidth - 2 * r.pad, 0) + rows.length * VISUAL_GAP;
  const tall = Math.max(...rows.map(r => r.height));

  targets.forEach(({ el, name, entry }, i) => {
    const { viewBox } = entry.meta || {};
    el.classList.add(`${name}-stage`);
    if (viewBox) el.style.aspectRatio = `${viewBox[0]} / ${viewBox[1]}`;
    el.style.setProperty('--stage-w-pct', (rows[i].stageWidth / span * 100).toFixed(4) + '%');
    el.style.setProperty('--stage-margin-pct', ((VISUAL_GAP / 2 - rows[i].pad) / span * 100).toFixed(4) + '%');
  });

  if (tall) document.documentElement.style.setProperty('--row-ar', (span / tall).toFixed(4));
}

/**
 * 挂载 `scope` 下所有 `[data-character]`。
 * @returns `[{ name, instance }, …]` —— 顺序即 DOM 顺序
 */
export function mountAll(scope = document) {
  const targets = [];
  for (const el of scope.querySelectorAll('[data-character]')) {
    const name = el.dataset.character;
    const entry = REGISTRY.get(name);
    if (!entry) {
      console.warn(`[registry] 未注册的角色「${name}」，跳过`);
      continue;
    }
    targets.push({ el, name, entry });
  }

  applyRow(targets);
  return targets.map(({ name, el, entry }) => ({ name, instance: entry.mount(el) }));
}
