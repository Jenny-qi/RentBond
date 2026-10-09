# RentBond Logo 使用包

2026-09-29；按用户最新选择，以第一版“曲线双块”为正式制作方向。两部分相互契合且边界清楚，表达租客与房东在共同规则下各自保有权益。此包取代三分格版作为当前推荐上传素材，旧文件保留。无箭头、无渐变。原始生成图仅作为设计参考，本目录SVG为重绘母版，所有正式导出来自同一母版几何。

## 上传与选用

| 用途 | 文件 | 尺寸/规格 |
| --- | --- | --- |
| 比赛首选 | contest-square-1024.png | 1024×1024，不透明米白背景；另附512与2048 PNG |
| 比赛兼容格式 | contest-square-1024.jpg / .webp | 同尺寸；均小于3MB |
| 项目横幅 | project-cover-1200.png / .jpg / .webp | 1200×630 |
| 透明竖版 | logo-stacked-color-1024.png / -512.png | 1024/512正方形 |
| 透明横版 | logo-horizontal-color-1200.png | 1200×320 |
| 单色横版 | logo-horizontal-mono-1200.png / logo-horizontal-white-1200.png | 深色用于浅底；白色用于深底 |
| 透明图标 | icon-color、icon-mono、icon-white对应PNG | 16、32、64、128、256、512正方形 |
| 应用图标 | app-icon-180.png / -192.png / -512.png | 带米白背景；180用于Apple touch，192/512用于PWA常见尺寸 |
| 网站标签 | favicon.ico | 内含16/32/48/64/128/256图层 |
| 可缩放源文件 | 本目录SVG | 图形及字标均为路径，不依赖字体，无外链 |

官方仅要求JPG/JPEG/PNG/WEBP且≤3MB；未见固定像素或比例要求。这里的1024方图和1200×630横图是交付选择，不冒充官方规定。SVG、ICO是工程资产，不直接用于该图片上传栏。

## 规范

- 炭灰 #35343E；暖金 #D8CDAF；底色 #FAF8F0。
- 图形400×400单位；外角半径88，内端圆角16；中部以平滑贝塞尔曲线分界。避免拉伸变形。
- 四周至少留图标宽度的1/8空白；16/32像素只用独立图标，不加字标。
- 浅底用彩色或炭灰版，深底用白色版。两色区分双方，不固定映射可领/待处理等业务状态。
- 字标以本机Avenir Next Demi Bold排版转为轮廓；不分发字体文件。图形由几何路径重绘，尚未进行商标近似检索。

## 制作与检查

使用内置imagegen精修参考，提示重点：保留第一版双块及曲线分界、无箭头、统一外角、改善小尺寸间隙、去渐变、减轻字标、准确RentBond.文字。正式SVG采用几何重绘及CoreText字形轮廓；PNG/JPG/WebP由Sharp渲染，ICO由Pillow封装。已目视检查preview，并检查全部栅格的尺寸、透明度及文件大小；manifest.json记录精确数据。未替换C的网页资源，未上传或提交代码。

官方规格来源：[Consumer Products & Payments](https://hackathon.monad.xyz/tracks/consumer-payments)，2026-09-29已登录核查：JPG/JPEG/PNG/WEBP，最大3MB。未规定像素大小。当前未上传，不能声称已通过平台文件校验。

## 2026-10-06 配色统一

当前推荐使用此低饱和灰金版。金色#D8CDAF参考页面主按钮#EEE1BB调整为更灰、更克制的品牌色；深色采用页面背景基色#35343E。on-dark系列使用页面文字色#FCF9F7搭配灰金，适合深色页面，PNG/SVG背景透明。图形和字标路径未改变。通过编辑现有SVG并重新渲染制作，旧配色保留；未替换页面代码。

## 最新试装同步版 · 2026-10-06

本包已同步首页试装的收窄曲线。on-dark深底系列将白色改为暖灰白#DED9D3；浅底系列保持灰紫#35343E与灰金#D8CDAF。navbar-mark.svg与页面当前使用文件完全一致，400×400无额外边距，建议29px显示。page-preview.png是本地实际页面截图；small-size-check.png按24/29/32px展示。不透明比赛首选contest-square-1024.png；项目横图project-cover-1200.png。SVG/ICO为工程用途，不用于比赛图片上传栏。
