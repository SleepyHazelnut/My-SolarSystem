/**
 * SVG 场景：地球角色的图层结构（唯一一份）。
 *
 * 几何数字**不写在这里** —— 从 `anim.js` import，那个文件是地球的唯一数字源，
 * 模板落点与主循环算出的落点因此天然一致。
 *
 * 四条约束：
 *
 * 1) SVG 绘制顺序是**反的**（后声明 = 更上层）。实际顺序：
 *      雨 → 云(后层) → 球体 → 云(前层) → 三态五官（闭 → 半闭 → 睁）→ 小芽
 *    · 云是**两份 <image>**（同一 href，浏览器只解码一次），靠显示哪一个换图层：
 *      `#earthCloudBack` 排在球体前（画在球下，回程弧那段），
 *      `#earthCloudFront` 排在球体后（画在球上，进场弧 + 环绕那段）。
 *      两份每帧吃**同一份** transform，index.js 按 `behind` 切显示。
 *    · 雨排在云**前**（画在云下）：起点落在云体内部，靠云挡住上半程，
 *      才读作「从云里落下来」。
 *    · 雨留在**后层**：落点会压到球顶（299 > 280），排前层会被画在球面上。
 *    · 三态眼按「闭 → 半闭 → 睁」排，三层都吃 EARTH_T、与球体对齐，靠 opacity 切换。
 *      外面套 `#earthFace`：**跟随偏移只写这一个组**。
 *
 * 2) 「与地球绑定」靠 **DOM 层级**，不靠每帧手算地球变换：
 *      `#earthBob`（浮动 + 左右摆） ⊃ `#earthBreath`（呼吸 + 点击压扁）
 *    云、雨、芽、球体、五官都在里面，自动跟着地球走。
 *    只有命中区 `#earthHit` 故意放外面：它不该跟着呼吸上下动，否则贴边 hover 会抖。
 *
 * 3) 模板里只写静态落点（球体变换、芽的包装组 translate/scale）。浮动 / 呼吸 / 挤压 /
 *    叶摆 / 云漂 + 环绕 / 雨落 / 眨眼 / 五官跟随全由 index.js 每帧写绝对值，
 *    这里**不要**再套静态 transform，否则与每帧写的叠乘。
 *    唯一例外是 `#earthFace`：三张眼图各带静态 EARTH_T，跟随平移写在组上，两者叠加。
 *
 * 4) 模板串里的注释**不能出现反引号或裸 `${`**。改完**必跑 `npm run build`**。
 *
 * 8 张 PNG 直接复用原设计稿（未重绘、未转矢量），都在 `src/assets/earth/`：
 *   earth_base / eye_open · eye_half · eye_closed / sprout_stem · sprout_leaf_l · sprout_leaf_r / cloud
 */
import { CX, CY, VIEW_W, VIEW_H, EARTH_T, SPROUT } from './anim.js';

import earth_base from '../../assets/earth/earth_base.png';
import eye_open from '../../assets/earth/eye_open.png';
import eye_half from '../../assets/earth/eye_half.png';
import eye_closed from '../../assets/earth/eye_closed.png';
import sprout_stem from '../../assets/earth/sprout_stem.png';
import sprout_leaf_l from '../../assets/earth/sprout_leaf_l.png';
import sprout_leaf_r from '../../assets/earth/sprout_leaf_r.png';
import cloud from '../../assets/earth/cloud.png';

export const IMG = {
  earth_base, eye_open, eye_half, eye_closed,
  sprout_stem, sprout_leaf_l, sprout_leaf_r,
  cloud,
};

export const EARTH_SCENE = `
    <svg id="earthScene" viewBox="0 0 ${VIEW_W} ${VIEW_H}" role="img"
         aria-label="会呼吸、会眨眼、可悬停、可点击的地球角色">

      <!-- 球体 + 三态五官，都吃 EARTH_T 所以完全对齐。
           三态顺序：闭 → 半闭 → 睁（后声明 = 更上层）。
           芽排在球体之后（= 之上）；整个 #earthBreath 一起呼吸、#earthBob 一起浮动，
           所以芽和球是绑在一起动的。 -->
      <g id="earthBob">
        <g id="earthBreath">

          <!-- 后层天空：雨 + 云（云只在**回程弧**那段用这一份）。
               整组放在 #earthBob ⊃ #earthBreath 里 = 和地球绑定，跟着浮动 / 摆动 /
               呼吸 / 点击压扁一起动；位置仍由 index.js 每帧重写，但写的是相对地球的位置。
               本组必须排在球体**之前**（画在球下）：雨的落点会压到球顶。
               雨排在云**之前**（画在云下）：起点落在云体内部，靠云挡住上半程。 -->
          <g id="earthSkyBack">
            <g id="earthRain"></g>
            <image id="earthCloudBack" href="${IMG.cloud}" x="0" y="0" width="2048" height="2048"
                   style="display: none" />
          </g>

          <image id="earthBase" href="${IMG.earth_base}" x="0" y="0" width="2048" height="2048"
                 transform="${EARTH_T}" />

          <!-- 前层云：排在球体**之后** = 画在球上（进场弧 + 环绕那两段），
               但排在五官与芽**之前** —— 脸和芽不该被云盖住。
               两份云每帧吃**同一份** transform，只有显示哪一个不同。 -->
          <image id="earthCloudFront" href="${IMG.cloud}" x="0" y="0" width="2048" height="2048" />

          <!-- 五官整层包在一个可写组里：云走开时 index.js 给这个组写一个纯平移（最多 8 px）。
               五官（两眼 + 嘴）是**同一张图**，只能整层平移。
               三张眼图各自仍吃静态 EARTH_T（与球体对齐），跟随偏移写在外层组上，
               所以两者**叠加**：p ↦ translate(dx dy) · EARTH_T(p)。 -->
          <g id="earthFace">
            <image id="earthEyeClosed" href="${IMG.eye_closed}" x="0" y="0" width="2048" height="2048"
                   opacity="0" transform="${EARTH_T}" />
            <image id="earthEyeHalf" href="${IMG.eye_half}" x="0" y="0" width="2048" height="2048"
                   opacity="0" transform="${EARTH_T}" />
            <image id="earthEyeOpen" href="${IMG.eye_open}" x="0" y="0" width="2048" height="2048"
                   opacity="1" transform="${EARTH_T}" />
          </g>
          <!-- 小芽：排在球体**之后** = 画在球上。
               三份同一画布导出，直接叠就对位；茎的 transform 写一次静态的，叶每帧写摆动的。
               layer=0 时 index.js 会把这个组挪到球体之前。 -->
          <g id="earthSproutWrap" transform="translate(${SPROUT.x} ${SPROUT.y}) scale(${SPROUT.k})">
            <g id="earthSproutStem">
              <image href="${IMG.sprout_stem}" x="0" y="0" width="2048" height="2048" />
            </g>
            <g id="earthSproutLeafL">
              <image href="${IMG.sprout_leaf_l}" x="0" y="0" width="2048" height="2048" />
            </g>
            <g id="earthSproutLeafR">
              <image href="${IMG.sprout_leaf_r}" x="0" y="0" width="2048" height="2048" />
            </g>
          </g>
        </g>
      </g>

      <!-- 命中区：跟着球体大小走 -->
      <circle id="earthHit" cx="${CX}" cy="${CY}" r="132"
              fill="transparent" style="pointer-events: all" />
    </svg>
`;
