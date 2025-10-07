# 留言板应用

一个基于Supabase和前端技术栈构建的现代化留言板应用，支持实时更新、文件上传、点赞、回复等功能。

## 功能特点

- ✅ **留言发布**：支持添加用户名和内容发布留言
- 📁 **文件上传**：支持上传图片、文档等多种类型文件
- 🔄 **实时更新**：利用Supabase的实时功能，自动更新留言列表
- 👍 **点赞功能**：支持对留言进行点赞/取消点赞
- 💬 **回复功能**：可以对留言进行回复，形成对话
- 🔍 **搜索筛选**：支持按内容、用户名搜索，以及按最新/热门排序
- 📱 **响应式设计**：适配不同屏幕尺寸的设备
- 🎨 **现代化UI**：采用简洁美观的设计风格
- 📄 **分页加载**：高效加载大量数据
- 🔒 **安全性优化**：包含输入验证、文件类型检查等安全措施

## 技术栈

- **前端**：HTML5, CSS3, JavaScript, Tailwind CSS, Font Awesome
- **后端**：Supabase (数据库 + 存储 + 实时功能)
- **部署**：静态网站托管服务 (如Vercel, Netlify, GitHub Pages等)

## 快速开始

### 1. 克隆项目

```bash
git clone https://your-repository-url.git
cd feedback-app
```

### 2. 配置Supabase

确保`config.js`文件中包含正确的Supabase连接信息：

```javascript
const config = {
    supabase: {
        url: 'YOUR_SUPABASE_PROJECT_URL',
        anonKey: 'YOUR_SUPABASE_ANON_KEY'
    },
    // ...其他配置
};
```

当前项目已配置以下信息：
- Project URL: `https://czjcvwsalxftsxomfiyf.supabase.co`
- anonKey: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6amN2d3NhbHhmdHN4b21maXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzYwMDMsImV4cCI6MjA3NTA1MjAwM30.KowEk4M6Ykl8q21DxsT9dKOgmwy0Hlg3cabD6tr3Q8k`

### 3. 运行应用

由于是静态网站，您可以直接在浏览器中打开`new_feedback.html`文件，或使用任何Web服务器托管该目录。

#### 使用VS Code Live Server

1. 安装[VS Code](https://code.visualstudio.com/)
2. 安装[Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)扩展
3. 在VS Code中打开项目文件夹
4. 右键点击`new_feedback.html`，选择"Open with Live Server"

#### 使用Python HTTP服务器

```bash
# Python 3
python -m http.server 8000

# 然后在浏览器中访问 http://localhost:8000/new_feedback.html
```

## 项目结构

```
├── new_feedback.html   # 主HTML文件
├── config.js           # 配置文件（包含Supabase连接信息）
├── utils.js            # 工具函数模块
├── supabase.service.js # Supabase服务模块
├── message.service.js  # 留言服务模块
├── README.md           # 项目说明
└── .gitignore          # Git忽略文件
```

## 功能详情

### 留言发布

- 填写用户名和留言内容
- 可选上传文件（支持图片、PDF、Word、Excel、文本文件）
- 文件大小限制：10MB
- 留言内容限制：200字符

### 留言管理

- 支持编辑和删除自己的留言
- 支持对留言进行点赞
- 支持回复留言
- 支持搜索留言（按用户名或内容）
- 支持排序（最新/热门）

### 实时功能

当有新留言、点赞或回复时，页面会自动更新，无需手动刷新。

## 自定义配置

在`config.js`文件中，您可以调整以下配置：

- `pageSize`：每页显示的留言数量
- `maxContentLength`：留言内容最大长度
- `maxFileSize`：最大文件大小
- `supportedFileTypes`：支持的文件类型

## 浏览器兼容性

该应用兼容所有现代浏览器，包括：
- Chrome (最新版本)
- Firefox (最新版本)
- Safari (最新版本)
- Edge (最新版本)

## 开发注意事项

1. **安全性**：在生产环境中，请确保正确配置Supabase的Row Level Security (RLS)策略
2. **性能优化**：对于大量数据，可能需要进一步优化分页和查询性能
3. **离线支持**：当前版本不支持离线使用，未来可以考虑添加Service Worker支持
4. **用户认证**：当前版本使用简单的用户名输入，可以扩展为完整的用户认证系统

## 许可证

MIT License

## 致谢

感谢使用本留言板应用！如有任何问题或建议，请随时提交Issue或Pull Request。
