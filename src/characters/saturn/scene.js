/**
 * SVG 场景：土星角色的图层结构（唯一一份）。
 *
 * 1) 绘制顺序与 DOM 顺序一致，后声明者在上。三层：
 *      光环后层（远侧，被本体挡住）→ 本体 → 光环前层（近侧，压在本体上）
 *    前层用 clipPath 切掉分界线上方那一半；分界直线过球心、斜率 = 光环长轴。
 *
 * 2) 本体与光环都是 1536 画布，共用 `CANVAS_T` 原位叠上去即可。
 *
 * 3) 每帧写 transform 的只有两个组：
 *      #saturn          入场缩放。局部原点即画布中心，`scale` 原地生效
 *      #saturnBodyWrap  呼吸 + 悬停 + 按压，绕球心缩放与上浮；三层都是它的子节点
 *
 * 4) 命中区 <circle id="saturnHit"> 放在 #saturn 之外，不随悬停移动，避免贴边 hover 抖动。
 *    圆心在 viewBox 中心（= 球心），半径 162 略大于球体半径 158.7。
 *
 * ⚠️ 土星**不眨眼** —— 五官烘在本体图上，没有三态眼层。
 *
 * `data-name` 是图层中文名（调试用），不参与渲染。
 *
 * ⚠️ 下面整块是模板字符串：注释里不能出现反引号，也不能出现裸的美元花括号。改完必跑 `npm run build`。
 */
import saturn_base from '../../assets/saturn/saturn_base.png';
import saturn_ring from '../../assets/saturn/saturn_ring.png';

import { BODY_C, CANVAS_T, SATURN, SEAM_B, SEAM_M, VIEW } from './anim.js';

/* 分界线上、下各取一个远点，围成「近侧」半平面（局部坐标）。 */
const SEAM_X = 1000;
const SEAM_TOP = (SEAM_B + SEAM_M * SEAM_X).toFixed(2);
const SEAM_BOT = (SEAM_B - SEAM_M * SEAM_X).toFixed(2);

export const SVG_SCENE = `
    <svg id="saturnScene" viewBox="${VIEW.minX} ${VIEW.minY} ${VIEW.w} ${VIEW.h}" role="img"
         aria-label="会呼吸、可悬停的土星角色">

      <defs>
        <clipPath id="saturnRingFrontClip">
          <polygon points="-${SEAM_X} ${SEAM_TOP} ${SEAM_X} ${SEAM_BOT} ${SEAM_X} 1000 -${SEAM_X} 1000" />
        </clipPath>
      </defs>

      <g transform="translate(${SATURN.x} ${SATURN.y})">
        <g id="saturn">

          <g id="saturnBodyWrap">
            <image id="saturnRingBack" data-name="光环后层" href="${saturn_ring}" x="0" y="0" width="1536" height="1536"
                   transform="${CANVAS_T}" />
            <image id="saturnBody" data-name="本体" href="${saturn_base}" x="0" y="0" width="1536" height="1536"
                   transform="${CANVAS_T}" />
            <g clip-path="url(#saturnRingFrontClip)">
              <image id="saturnRingFront" data-name="光环前层" href="${saturn_ring}" x="0" y="0" width="1536" height="1536"
                     transform="${CANVAS_T}" />
            </g>
          </g>

        </g>
      </g>

      <circle id="saturnHit" cx="${(SATURN.x + BODY_C.x).toFixed(1)}" cy="${(SATURN.y + BODY_C.y).toFixed(1)}" r="162"
              fill="transparent" style="pointer-events: all" />
    </svg>
`;
