/**
 * SVG 场景：水星角色的图层结构（唯一一份）。
 *
 * 1) 绘制顺序与 DOM 顺序一致，后声明者在上。自下而上：装饰·后 → 本体（含烘死的陨石坑 / 五官）
 *    → 装饰·前。三个都是 `#mercuryBodyWrap` 的子节点。
 *
 * 2) 本体与装饰都是 1536 画布，装饰的落点写在 anim.js 的 `DECO`，
 *    三层共用同一份 `CANVAS_T`（定义在 anim.js），无需对位修正。
 *
 * 3) 每帧写 transform 的只有两个组：
 *      #mercury          入场缩放。局部原点即画布中心，`scale` 原地生效
 *      #mercuryBodyWrap  呼吸 + 悬停 + 按压，绕球心缩放与上浮
 *
 * 4) 命中区 <circle> 放在 #mercury 之外，不随悬停移动，避免贴边 hover 抖动。
 *    圆心对准球心（非素材画布中心），半径 149 略大于球体半径 ≈146。
 *
 * `data-name` 是图层中文名（调试用），不参与渲染。
 *
 * ⚠️ 下面整块是模板字符串：注释里不能出现反引号，也不能出现裸的 ${。改完必跑 `npm run build`。
 */
import deco_fan from '../../assets/mercury/deco_fan.png';
import deco_sunglasses from '../../assets/mercury/deco_sunglasses.png';
import mercury_base from '../../assets/mercury/mercury_base.png';

import { BODY_C, CANVAS_T, DECO, ORIGIN, VIEW } from './anim.js';

const IMG = { deco_fan, deco_sunglasses, mercury_base };

/* 装饰的附加变换：摆到画布坐标 (x, y)，再绕自身画布中心缩放 k、旋转 rot。 */
const decoT = ({ x, y, k, rot }) =>
  `translate(${x} ${y}) rotate(${rot}) scale(${k}) translate(-768 -768)`;

export const SVG_SCENE = `
    <svg id="mercuryScene" viewBox="${VIEW.minX} ${VIEW.minY} ${VIEW.w} ${VIEW.h}" role="img"
         aria-label="会呼吸、可悬停的水星角色">

      <g transform="translate(${ORIGIN.x} ${ORIGIN.y})">
        <g id="mercury">

          <g id="mercuryBodyWrap">
            <g id="mercuryDecoBack" data-name="装饰·后" transform="${CANVAS_T}"></g>

            <image id="mercuryBody" data-name="本体" href="${IMG.mercury_base}" x="0" y="0" width="1536" height="1536"
                   transform="${CANVAS_T}" />

            <g id="mercuryDecoFront" data-name="装饰·前" transform="${CANVAS_T}">
              <g id="mercuryDecoFan" data-name="装饰·风扇" transform="${decoT(DECO.fan)}">
                <image href="${IMG.deco_fan}" x="0" y="0" width="1536" height="1536" />
              </g>
              <g id="mercuryDecoSunglasses" data-name="装饰·墨镜" transform="${decoT(DECO.sunglasses)}">
                <image href="${IMG.deco_sunglasses}" x="0" y="0" width="1536" height="1536" />
              </g>
            </g>
          </g>

        </g>
      </g>

      <circle id="mercuryHit" cx="${(ORIGIN.x + BODY_C.x).toFixed(1)}" cy="${(ORIGIN.y + BODY_C.y).toFixed(1)}" r="149"
              fill="transparent" style="pointer-events: all" />
    </svg>
`;
