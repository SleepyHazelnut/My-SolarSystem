/**
 * SVG 场景：太阳角色的图层结构（唯一一份）。
 *
 * 1) **绘制顺序是反的**（SVG 后声明 = 最上层）。自下而上：光圈 → 本体（含烘死的嘴与腮红）→ 眼睛
 *    · 光圈画在**本体之上**：花瓣压在球体边缘上，缝里透出本体。反过来（光圈在下）
 *      花瓣会被本体挡住大半，只剩短短一截。
 *    · 眼睛排最后 = 最上层，三张眼图靠 opacity 交叉淡入（相邻两态权重和恒为 1）。
 *    · 嘴与腮红**不是图层** —— 烘在本体图上。
 *
 * 2) 两层素材都是 1536 画布、内容以画布中心 (768,768) 为心，共用同一份
 *    `scale(K) translate(-768 -768)`，天然同心。K 与两个支点都在 anim.js。
 *
 * 3) 每帧写绝对值的只有三个组，都**绕画布中心**（= #sun 的局部原点）：
 *      #sunBodyWrap   translate(0 dy)                  ← **只有悬停抬升**，本体不缩放、不呼吸
 *      #sunRays       scale(K) rotate(rot) scale(s) translate(-768 -768)   ← 呼吸 + 摇摆在这层
 *      #sunEyes       opacity 三选一（静态变换，见 anim.js 的 EYE_T）
 *    ⚠️ 眼睛挂在 #sunBodyWrap **里面**：悬停上浮时眼睛跟着本体一起走，
 *    否则眼与本体上烘死的嘴会错开。
 *
 * 4) 命中区 <circle id="hit"> 故意放在 #sun **外面**：不跟着悬停上下动，否则贴边 hover 会抖。
 *
 * 素材 5 张 PNG，未重绘、未转矢量：
 *   本体 / 光圈在 `src/assets/sun/`；三态眼在 `src/assets/eye/`，**与地球共用**。
 *
 * `data-name` 是给 `_draft/character-tuner.html`（配饰图层调试页）读的**中文图层名**，
 * 不参与渲染。新角色照着写，调试页自动就能显示中文。
 *
 * 下面整块是**模板字符串**：注释里不能出现反引号（会提前截断 → rollup 报 "Expected a semicolon"），
 * 也不能出现裸的 ${（会被当插值求值）。改完**必跑 `npm run build`**。
 */
import eye_closed from '../../assets/eye/eye_closed.png';
import eye_half from '../../assets/eye/eye_half.png';
import eye_open from '../../assets/eye/eye_open.png';
import sun_base from '../../assets/sun/sun_base.png';
import sun_rays from '../../assets/sun/sun_rays.png';

import { EYE_T, K, SUN } from './anim.js';

export const IMG = { eye_closed, eye_half, eye_open, sun_base, sun_rays };

/* 光圈的对位修正（**静态**，不是动画）。
   是**人眼在 `_draft/character-tuner.html` 里调出来的**（左右 −14 / 上下 −25 / 大小 1.15 / 角度 5°）。
   支点 = #sun 的局部原点 = 太阳中心，所以这里不出现 `translate(P) … translate(-P)` 那对 ——
   调试页算出来的支点就是 (0, 0)，写出来会被约掉。
   ⚠️ 改完**必须回头查 viewBox 装不装得下**（`_draft/_fit-check.mjs` 量可见内容的真实包围盒）：
   加这几个数之后光圈外缘超出原 viewBox 左 49.6 / 上 42.9 单位、被裁成平口，
   于是 viewBox 从 `0 0 590 600` 放到 `-56 -52 680 664`，舞台按同比例加宽到 415px
   （屏幕上球体仍是 243px）。**viewBox 不再以 SUN 为中心**，它以「本体 + 放大后的光圈」
   的合体剪影为中心，所以左上的余量比右下小一点，这是有意的。要再调就回调试页拖。 */
export const RAYS_FIT = 'translate(-14 -25) rotate(5) scale(1.15)';

export const SVG_SCENE = `
    <svg id="scene" viewBox="-56 -52 680 664" role="img"
         aria-label="光圈会呼吸、会随机眨眼、可悬停的太阳角色">

      <g transform="translate(${SUN.x} ${SUN.y})">
        <g id="sun">

          <g id="sunBodyWrap">
            <image id="sunBody" data-name="本体" href="${IMG.sun_base}" x="0" y="0" width="1536" height="1536"
                   transform="scale(${K}) translate(-768 -768)" />

            <!-- 眼睛：静态变换把 2048 画布的公共眼图摆到本体脸上（推导见 anim.js 的 EYE_T）。
                 三态各一层、靠 opacity 交叉淡入；初始是「睁」。 -->
            <g id="sunEyes" data-name="眼睛" transform="${EYE_T}">
              <image id="eyeClosed" data-name="眼睛·闭" href="${IMG.eye_closed}" x="0" y="0" width="2048" height="2048"
                     opacity="0" />
              <image id="eyeHalf" data-name="眼睛·半闭" href="${IMG.eye_half}" x="0" y="0" width="2048" height="2048"
                     opacity="0" />
              <image id="eyeOpen" data-name="眼睛·睁" href="${IMG.eye_open}" x="0" y="0" width="2048" height="2048"
                     opacity="1" />
            </g>
          </g>

          <!-- 光圈：排在最后 = 最上层。花瓣压住本体的边缘，缝里透出本体。
               最外层是**静态**的对位修正（见 RAYS_FIT）：写在 #sun 坐标系里，
               而 #sun 的局部原点就是太阳中心 → 缩放 / 旋转天然原地，不需要补支点。
               内层变换顺序 scale(K) → rotate(rot) → scale(rs) → translate(-768 -768)：
               rotate 必须夹在两次 scale **中间** —— 写最前面会绕 viewBox 原点转，整圈花瓣飞出去。
               两次 scale 都绕画布中心（translate 之后原点就在那儿），所以缩放与旋转同心。 -->
          <g transform="${RAYS_FIT}">
            <image id="sunRays" data-name="光圈" href="${IMG.sun_rays}" x="0" y="0" width="1536" height="1536"
                   transform="scale(${K}) translate(-768 -768)" />
          </g>

        </g>
      </g>

      <!-- 命中区：圆 r=150（直径 300）放在太阳中心。放在 #sun 组外面，不随悬停移动（避免贴边抖动）。
           比本体半径（199.5）小一圈 —— 和改前一样，只认球心那块，花瓣尖上不算命中。 -->
      <circle id="hit" cx="${SUN.x}" cy="${SUN.y}" r="150" fill="transparent" style="pointer-events: all" />
    </svg>
`;
