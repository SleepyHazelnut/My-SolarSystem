/**
 * SVG 场景：地球角色的图层结构（唯一一份）。
 *
 * 几何数字**不写在这里** —— 从 `anim.js` import，那个文件是地球的唯一数字源，
 * 模板落点与主循环算出的落点因此天然一致。
 *
 * 四条约束：
 *
 * 1) SVG 绘制顺序是**反的**（后声明 = 更上层）。实际顺序：
 *      雨 → 云(后层) → 球体 → 云(前层) → 腮红 → 三态五官（闭 → 半闭 → 睁）→ 开心表情 → 小芽
 *    · 云是**两份 <image>**（同一 href，浏览器只解码一次），靠显示哪一个换图层：
 *      `#earthCloudBack` 排在球体前（画在球下，回程弧那段），
 *      `#earthCloudFront` 排在球体后（画在球上，出门弧 + 环绕那段）。
 *      两份每帧吃**同一份** transform，index.js 按 `behind` 切显示。
 *    · 雨排在云**前**（画在云下）：起点落在云体内部，靠云挡住上半程，
 *      才读作「从云里落下来」。
 *    · 雨留在**后层**：落点会压到球顶（299 > 280），排前层会被画在球面上。
 *    · 雨**不在呼吸组里**（在 `#earthBob` 下、`#earthBreath` 之前）—— 雨不该跟着呼吸
 *      一张一缩、也不该跟着点击压扁。见下面 DOM 里那段注释。
 *    · 三态眼按「闭 → 半闭 → 睁」排，三层都吃 EARTH_T、与球体对齐，靠 opacity 切换。
 *    · 开心表情排在最后（= 最上层），**也吃 EARTH_T** —— 它是自己拼的（2048 画布，
 *      见 anim.js 那段），和三态眼落点逐像素对齐。它排在 #earthFace **里面**：
 *      整层弹的时候它和三态眼一起动，交叉淡入不会错位。
 *    · `#earthTiltBall` / `#earthTiltSprout` 是**两个空壳组**，只为「点击变开心时整颗球跟着歪」
 *      而存在（每帧吃同一份 `ballRot`）。它们不改绘制顺序，但把「球体」和「小芽」拆成了
 *      两个不相邻的子树 —— 云的前层必须夹在中间，所以不能合成一个组。
 *
 * 2) 「与地球绑定」靠 **DOM 层级**，不靠每帧手算地球变换：
 *      `#earthBob`（浮动 + 左右摆） ⊃ `#earthBreath`（呼吸 + 点击压扁）
 *    云、芽、球体、五官都在呼吸组里，自动跟着地球走。
 *    只有两个故意在外面：
 *      · `#earthHit` —— 不该跟着呼吸上下动，否则贴边 hover 会抖；
 *      · `#earthRain` —— 不该有呼吸（也不该被点击压扁），只跟浮动 / 摆动。
 *
 * 3) 模板里只写静态落点（球体变换、芽的包装组 translate/scale）。浮动 / 呼吸 / 挤压 /
 *    叶摆 / 云漂 + 环绕 / 雨落 / 眨眼 / 表情全由 index.js 每帧写绝对值，
 *    这里**不要**再套静态 transform，否则与每帧写的叠乘。
 *    唯一例外是 `#earthFace`：三张眼图 + 开心图各带静态变换，表情的点头（平移 + 倾斜）写在组上，两者叠加。
 *
 * 4) 模板串里的注释**不能出现反引号或裸 `${`**。改完**必跑 `npm run build`**。
 *
 * 10 张 PNG：8 张直接复用原设计稿（未重绘、未转矢量）——
 *   `src/assets/earth/` 里 earth_base / eye_open · eye_half · eye_closed /
 *   sprout_stem · sprout_leaf_l · sprout_leaf_r / cloud；
 *   另加两张**自己从底图里抠出来的**（都落在 2048 画布上，与球体逐像素对齐）：
 *   · `face_happy.png`：眼睛取自 `星球素材/表情/微笑.png` 的 ^^ 弯月眼、嘴取自
 *     `星球素材/表情/开心.png` 的张嘴，逐件补角后按 eye_open 的实测中心落位（`_draft/_face-build.py`）；
 *   · `blush.png`：两颊腮红，原先是 `earth_base` 的一部分 → 抠出来才能跟着五官一起动
 *     （`_draft/_blush-build.py`，底图上那两块已补掉）。
 */
import { CX, CY, VIEW_W, VIEW_H, EARTH_T, SPROUT } from './anim.js';

import earth_base from '../../assets/earth/earth_base.png';
import eye_open from '../../assets/earth/eye_open.png';
import eye_half from '../../assets/earth/eye_half.png';
import eye_closed from '../../assets/earth/eye_closed.png';
import face_happy from '../../assets/earth/face_happy.png';
import blush from '../../assets/earth/blush.png';
import sprout_stem from '../../assets/earth/sprout_stem.png';
import sprout_leaf_l from '../../assets/earth/sprout_leaf_l.png';
import sprout_leaf_r from '../../assets/earth/sprout_leaf_r.png';
import cloud from '../../assets/earth/cloud.png';

export const IMG = {
  earth_base, eye_open, eye_half, eye_closed, face_happy, blush,
  sprout_stem, sprout_leaf_l, sprout_leaf_r,
  cloud,
};

export const EARTH_SCENE = `
    <svg id="earthScene" viewBox="0 0 ${VIEW_W} ${VIEW_H}" role="img"
         aria-label="会呼吸、会眨眼、可悬停、点击会变开心表情的地球角色">

      <!-- 球体 + 三态五官 + 开心表情，都吃 EARTH_T 所以完全对齐。
           三态顺序：闭 → 半闭 → 睁（后声明 = 更上层）。
           芽排在球体之后（= 之上）；整个 #earthBreath 一起呼吸、#earthBob 一起浮动，
           所以芽和球是绑在一起动的。 -->
      <g id="earthBob">
        <!-- 雨：**故意在 #earthBreath 外面**（用户 2026-10-06：「雨就不用有呼吸了」）。
             放在呼吸组里会被那一层 scale(breathSX breathSY) 乘一遍 —— 雨滴的纵向间距随呼吸
             一张一缩，读作「雨也在呼吸」；点击时还会跟着压扁 14%（雨柱被压缩，
             雨滴间距挤在一起）。
             留在 #earthBob 里 = 仍跟着浮动 / 左右摆走（落点相对云不变）；
             排在 #earthBreath **之前** = 画在球体与云之下，z 序与原来一致
             （雨滴的落点会压到球顶 299 > 280，排前层会被画在球面上）。 -->
        <g id="earthRain"></g>

        <g id="earthBreath">

          <!-- 后层云：只在**回程弧**那段用这一份。
               整组放在 #earthBob ⊃ #earthBreath 里 = 和地球绑定，跟着浮动 / 摆动 /
               呼吸 / 点击压扁一起动；位置仍由 index.js 每帧重写，但写的是相对地球的位置。
               本组必须排在球体**之前**（画在球下）。 -->
          <g id="earthSkyBack">
            <image id="earthCloudBack" href="${IMG.cloud}" x="0" y="0" width="2048" height="2048"
                   style="display: none" />
          </g>

          <!-- 球体。外面那层 #earthTiltBall 是**点击变开心时「整颗球跟着歪」**的旋转组
               （绕球心，角度 = ballRot）—— 大陆、云纹、轮廓一起动，才读作「真实点头」。
               五官**不在**这个组里（它自己已经吃了同角度的倾斜，见 index.js）。
               ⚠️ 两个倾斜组（这里 + 小芽那个）每帧必须吃**同一份** transform，
               否则球歪了、芽没歪，芽就「掉」在球外面。 -->
          <g id="earthTiltBall">
            <image id="earthBase" href="${IMG.earth_base}" x="0" y="0" width="2048" height="2048"
                   transform="${EARTH_T}" />
          </g>

          <!-- 前层云：排在球体**之后** = 画在球上（出门弧 + 环绕那两段），
               但排在五官与芽**之前** —— 脸和芽不该被云盖住。
               两份云每帧吃**同一份** transform，只有显示哪一个不同。 -->
          <image id="earthCloudFront" href="${IMG.cloud}" x="0" y="0" width="2048" height="2048" />

          <!-- 五官整层包在一个可写组里：点击变「开心」时 index.js 给这个组写「平移 + 倾斜」
               （左点点头、右点点头）。开心图和三态眼都在**这个组里面** —— 整层一起动，
               交叉淡入不会错位。
               三张眼图与开心图各吃**同一份**静态 EARTH_T（与球体对齐），组的变换再叠在上面：
               p ↦ translate(dx dy) · rotate(a FACE_C) · T(p)。 -->
          <g id="earthFace">
            <!-- 腮红：**必须在这一层**。原先它是 earth_base 的一部分，
                 于是脸动的时候眼和嘴走了、腮红留在原地，整张脸散架。
                 现在从底图抠成独立素材（_draft/_blush-build.py），跟着组一起动。
                 它是**恒定可见**的（不参与眨眼 / 交叉淡入）→ 排最下面，
                 三态眼和开心图都画在它上面。 -->
            <image id="earthBlush" href="${IMG.blush}" x="0" y="0" width="2048" height="2048"
                   transform="${EARTH_T}" />
            <image id="earthEyeClosed" href="${IMG.eye_closed}" x="0" y="0" width="2048" height="2048"
                   opacity="0" transform="${EARTH_T}" />
            <image id="earthEyeHalf" href="${IMG.eye_half}" x="0" y="0" width="2048" height="2048"
                   opacity="0" transform="${EARTH_T}" />
            <image id="earthEyeOpen" href="${IMG.eye_open}" x="0" y="0" width="2048" height="2048"
                   opacity="1" transform="${EARTH_T}" />
            <!-- 开心表情：排在最后 = 最上层。初始 opacity 0（看不见），
                 点击后 index.js 把三态眼乘 (1−happyW)、这一张乘 happyW 做交叉淡入。
                 ⚠️ 它吃**和三态眼同一份** EARTH_T —— 这张图是自己拼的
                 （_draft/_face-build.py：微笑的 ^^ 眼 + 开心的张嘴，逐件补角后落回 2048 画布），
                 眼睛 / 嘴的位置与朝向都与 eye_open 对齐，切过去不会「眼睛动一下」。 -->
            <image id="earthFaceHappy" href="${IMG.face_happy}" x="0" y="0" width="2048" height="2048"
                   opacity="0" transform="${EARTH_T}" />
          </g>
          <!-- 小芽：排在球体**之后** = 画在球上。
               三份同一画布导出，直接叠就对位；茎的 transform 写一次静态的，叶每帧写摆动的。
               layer=0 时 index.js 会把这个组挪到球体之前。
               外面那层 #earthTiltSprout 与球体吃**同一份** ballRot（芽长在球上，球歪它必须歪）。 -->
          <g id="earthTiltSprout">
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
      </g>

      <!-- 命中区：跟着球体大小走 -->
      <circle id="earthHit" cx="${CX}" cy="${CY}" r="132"
              fill="transparent" style="pointer-events: all" />
    </svg>
`;
