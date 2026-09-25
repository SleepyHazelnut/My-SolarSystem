/**
 * SVG 场景：月球角色的图层结构（唯一一份）。
 *
 * 1) **绘制顺序是反的**（后声明 = 最上层）。自下而上：本体 → 睡帽。
 *    ⚠️ 两张素材**各自独立构图**（球那张撑满画布、帽子那张在画布中间），不是同一张合成图的两半 ——
 *    所以「共用 MOON_T 就自动对齐」是错的，照原样叠起来帽子落在球心附近。落位差由 `CAP_FIT` 补。
 *
 * 2) 五官（闭着的笑眼 + 腮红）**不是图层**，烘在本体图上 —— 所以月球不眨眼、不换表情。
 *
 * 3) 每帧写绝对值的只有两个组，缩放都**绕球心**：
 *      #moonBob   translate(dx dy) translate(CX CY) scale(sx sy) translate(-CX -CY)
 *      #moonCap   rotate(capRot CX CY)                ← 睡帽自己再晃一点
 *    #moonCap 外面套一层**静态**对位组 `CAP_FIT`（垫在 #moonBob 与 #moonCap 之间），
 *    它在 #moonBob 坐标系里做位移 / 旋转 / 缩放，所以不跟着 capRot 一起转。
 *    ⚠️ 本体与帽子必须**一起**缩（帽子挂在 #moonBob 里），否则呼吸时帽檐和头顶会错开一条缝。
 *    ⚠️ 不能省掉那对 `translate(CX CY) … translate(-CX -CY)` —— 直接写 scale 是绕 viewBox
 *    左上角缩，球会一边放大一边往左上跑。
 *
 * 4) 命中区 <circle id="hit"> 放在 #moon **外面**：不跟着呼吸上下动，否则贴边 hover 会抖。
 *
 * 素材 2 张 PNG，未重绘、未转矢量，都在 `src/assets/moon/`。
 * `data-name` 是给 `_draft/character-tuner.html` 读的**中文图层名**，不参与渲染。
 *
 * ⚠️ 下面整块是**模板字符串**：注释里不能出现反引号（会提前截断 → rollup 报 "Expected a semicolon"），
 * 也不能出现裸的 ${。改完**必跑 `npm run build`**。
 */
import moon_base from '../../assets/moon/moon_base.png';
import nightcap from '../../assets/moon/nightcap.png';

import { CX, CY, MOON_T, VIEW_H, VIEW_W } from './anim.js';

export const IMG = { moon_base, nightcap };

/* 睡帽的对位修正（**静态**，不是动画）。
   两张素材各自独立构图，共用 MOON_T 叠起来帽子会落在球心附近。
   这几个数是**人眼在 `_draft/character-tuner.html` 里调出来的**（左右 −53 / 上下 −44 /
   大小 1.15 / 角度 −13°）—— 算法算不出来，别再试图反解；要再调就回调试页拖。
   支点 = 球心 (CX, CY)，与调试页一致。
   写成**位移 → 旋转 → 缩放**：位移在最外层 = 在 #moonBob 坐标系里平移，
   不跟着 #moonCap 自己的 capRot 一起转。 */
export const CAP_FIT =
  `translate(-53 -44) rotate(-13 ${CX} ${CY}) ` +
  `translate(${CX} ${CY}) scale(1.15) translate(${-CX} ${-CY})`;

export const SVG_SCENE = `
    <svg id="moonScene" viewBox="0 0 ${VIEW_W} ${VIEW_H}" role="img"
         aria-label="会呼吸、可悬停的月球角色">

      <g id="moon">
        <g id="moonBob">
          <image id="moonBody" data-name="本体" href="${IMG.moon_base}" x="0" y="0" width="1072" height="1108"
                 transform="${MOON_T}" />

          <!-- 睡帽：最外层是对位修正（静态，见 CAP_FIT），内层 #moonCap 的支点写在球心，
               让它在头上「晃」而不是「转」（transform 由 index.js 每帧写）。
               组内的 <image> 保留 MOON_T，与本体那份逐字节相同 —— 两张图才会一直贴着。 -->
          <g transform="${CAP_FIT}">
            <g id="moonCap" data-name="睡帽">
              <image href="${IMG.nightcap}" x="0" y="0" width="1072" height="1108"
                     transform="${MOON_T}" />
            </g>
          </g>
        </g>
      </g>

      <!-- 命中区：圆 r=130（= 球体半径）放在球心。放在 #moon 组外面，不随呼吸移动。 -->
      <circle id="hit" cx="${CX}" cy="${CY}" r="130" fill="transparent" style="pointer-events: all" />
    </svg>
`;
