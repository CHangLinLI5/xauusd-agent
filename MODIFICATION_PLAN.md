# GoldBias 品牌优化修改清单

## 需要修改的文件

### 1. 品牌名称替换
- `client/index.html` - title, favicon link
- `client/src/components/AppLayout.tsx` - Lines 63,66,204,207 (XAUUSD Agent -> GoldBias)
- `client/src/pages/Chat.tsx` - Lines 59,467,469,523,731,841
- `client/src/pages/Login.tsx` - Line 70
- `client/src/pages/Profile.tsx` - Line 543
- `client/src/pages/ChartAnalysis.tsx` - Lines 43,64,329
- `client/src/pages/AdminConfig.tsx` - Lines 131,136

### 2. 新增文件
- `client/src/pages/About.tsx` - About 页面
- `client/public/favicon.svg` - 新 Logo SVG
- `client/public/logo.svg` - Logo 文件

### 3. 路由修改
- `client/src/App.tsx` - 添加 /about 路由

### 4. 首页优化
- `client/src/pages/Home.tsx` - 添加 Slogan、今日执行清单入口
