/**
 * SVG 场景：地球角色的图层结构（唯一一份）。
 *
 * 1) 绘制顺序与 DOM 顺序一致，后声明者在上。自下而上：本体（含烘死的云 / 嘴 / 腮红）
 *    → 三态眼 → 花环 → 花环上的两片叶 → 落叶。
 *    · 本体与眼睛不拆前后层：`#earthEyes` 是 `#earthBodyWrap` 的子节点，
 *      本体缩放 / 上浮时眼睛随之移动，不会与烘死的嘴错开。
 *    · 云烘在本体边缘上，不是独立图层。再加一层时排在本体之后，并给它 `data-name`。
 *    · 落叶挂在 `#earthBodyWrap` 上，随呼吸一起动；花环叶跟花环同层。
 *
 * 2) 本体、三态眼、花环与两片花环叶都是 1536 画布，且后三者是从本体 / 花环上原样抠出来的
 *    —— 内容已在画布上的正确位置，所以都共用 `CANVAS_T`（定义在 anim.js），
 *    花环与花环叶再加同一份 `FLOWER_T`，无需任何对位修正。
 *    落叶是设定图 3 切出的小图，落在 `#earthLeaves` 组里（组原点 = 球心），颗心即 `<g>` 原点。
 *
 * 3) 每帧写 transform 的只有这几个组：
 *      #earth          入场缩放。局部原点即画布中心，`scale` 原地生效
 *      #earthBodyWrap  呼吸 + 悬停 + 按压，绕球心缩放与上浮
 *      #earthLeafA / #earthLeafB  绕各自叶根的旋转（index.js 写，局部单位）
 *      #earthLeaves 里的每颗 `<g>`  落叶绕球心弧线滑落与自转（index.js 写）
 *
 * 4) 命中区 <circle id="hit"> 放在 #earth 之外，不随悬停移动，避免贴边 hover 抖动。
 *    圆心对准球心（非素材画布中心），半径 172 略大于球体半径 ≈170，云边不算命中。
 *
 * `data-name` 是图层中文名（调试用），不参与渲染。
 *
 * ⚠️ 下面整块是模板字符串：注释里不能出现反引号，也不能出现裸的 ${。改完必跑 `npm run build`。
 */
import earth_base from '../../assets/earth/earth_base.png';
import earth_flower from '../../assets/earth/earth_flower.png';
import earth_leaf_a from '../../assets/earth/earth_leaf_a.png';
import earth_leaf_b from '../../assets/earth/earth_leaf_b.png';
import eye_closed from '../../assets/earth/eye_closed.png';
import eye_half from '../../assets/earth/eye_half.png';
import eye_open from '../../assets/earth/eye_open.png';
import leaf1 from '../../assets/earth/leaf/leaf1.png';
import leaf2 from '../../assets/earth/leaf/leaf2.png';
import leaf3 from '../../assets/earth/leaf/leaf3.png';
import leaf4 from '../../assets/earth/leaf/leaf4.png';
import leaf5 from '../../assets/earth/leaf/leaf5.png';
import leaf6 from '../../assets/earth/leaf/leaf6.png';
import leaf7 from '../../assets/earth/leaf/leaf7.png';

import { BODY_C, CANVAS_T, FLOWER_T, LEAF_PTS, ORIGIN, VIEW } from './anim.js';

const IMG = {
  earth_base, earth_flower, earth_leaf_a, earth_leaf_b, eye_closed, eye_half, eye_open,
  leaf1, leaf2, leaf3, leaf4, leaf5, leaf6, leaf7,
};

/* 飘落物：每颗一个 `<g data-name>`，初始 transform 是落位，逐帧由 `index.js` 改写。
   图在 `<g>` 里居中（x/y 取负半宽高），自转与缩放绕颗心。 */
const parts = (pts, label) => pts
  .map(([name, x, y, w, h], i) =>
    `<g data-name="${label}${i + 1}" transform="translate(${x} ${y})">`
    + `<image href="${IMG[name]}" x="${(-w / 2).toFixed(2)}" y="${(-h / 2).toFixed(2)}"`
    + ` width="${w.toFixed(2)}" height="${h.toFixed(2)}" /></g>`)
  .join('\n                ');

export const SVG_SCENE = `
    <svg id="earthScene" viewBox="${VIEW.minX} ${VIEW.minY} ${VIEW.w} ${VIEW.h}" role="img"
         aria-label="会呼吸、会随机眨眼、可悬停的地球角色">

      <g transform="translate(${ORIGIN.x} ${ORIGIN.y})">
        <g id="earth">

          <g id="earthBodyWrap">
            <image id="earthBody" data-name="本体" href="${IMG.earth_base}" x="0" y="0" width="1536" height="1536"
                   transform="${CANVAS_T}" />

            <!-- 三态眼：各一层，靠 opacity 交叉淡入，初始为「睁」。
                 与本体同一画布、同一变换，位置即脸上原位置。 -->
            <g id="earthEyes" data-name="眼睛" transform="${CANVAS_T}">
              <image id="earthEyeClosed" data-name="眼睛·闭" href="${IMG.eye_closed}" x="0" y="0" width="1536" height="1536"
                     opacity="0" />
              <image id="earthEyeHalf" data-name="眼睛·半闭" href="${IMG.eye_half}" x="0" y="0" width="1536" height="1536"
                     opacity="0" />
              <image id="earthEyeOpen" data-name="眼睛·睁" href="${IMG.eye_open}" x="0" y="0" width="1536" height="1536"
                     opacity="1" />
            </g>

            <!-- 花环：画布坐标下的偏移与缩放见 anim.js 的 FLOWER。 -->
            <image id="earthFlower" data-name="花环" href="${IMG.earth_flower}" x="0" y="0" width="1536" height="1536"
                   transform="${CANVAS_T} ${FLOWER_T}" />

            <!-- 花环上的两片叶：从花环上原样抠出，与花环同一变换。
                 外层 g 的 transform 逐帧由 index.js 改写（绕各自叶根旋转，局部单位）。 -->
            <g id="earthLeafA" data-name="花环叶A">
              <g transform="${CANVAS_T} ${FLOWER_T}">
                <image href="${IMG.earth_leaf_a}" x="0" y="0" width="1536" height="1536" />
              </g>
            </g>
            <g id="earthLeafB" data-name="花环叶B">
              <g transform="${CANVAS_T} ${FLOWER_T}">
                <image href="${IMG.earth_leaf_b}" x="0" y="0" width="1536" height="1536" />
              </g>
            </g>

            <!-- 落叶：最上层，逐颗淡入淡出并绕球心弧线滑落。位置见 anim.js 的 LEAF_PTS。 -->
            <g id="earthLeaves" data-name="落叶" transform="translate(${BODY_C.x} ${BODY_C.y})">
                ${parts(LEAF_PTS, '落叶')}
            </g>
          </g>

        </g>
      </g>

      <!-- 命中区：在 #earth 组外，不随悬停移动。圆心对准球心（BODY_C 为球心相对素材画布中心的偏移）。 -->
      <circle id="earthHit" cx="${(ORIGIN.x + BODY_C.x).toFixed(1)}" cy="${(ORIGIN.y + BODY_C.y).toFixed(1)}" r="172"
              fill="transparent" style="pointer-events: all" />
    </svg>
`;
