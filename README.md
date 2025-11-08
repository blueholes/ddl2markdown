# SQL DDL 转 Markdown 表格工具

一个简单易用的 Web 工具，用于将 SQL DDL（Data Definition Language）语句转换为 Markdown 格式的表格。

## 功能特性

- ✅ 解析 SQL CREATE TABLE 语句（支持单个或多个表）
- ✅ 提取字段名、数据类型、约束信息
- ✅ 生成 Markdown 格式表格
- ✅ 实时预览转换结果
- ✅ 一键复制到剪贴板
- ✅ 支持多种数据库语法（MySQL、PostgreSQL、SQLite 等）
- ✅ 智能处理括号内的逗号（如 DECIMAL(10,2)）
- ✅ 支持常见约束（PRIMARY KEY、UNIQUE、NOT NULL、DEFAULT、AUTO_INCREMENT 等）

## 使用方法

1. 在左侧输入框中输入 SQL CREATE TABLE 语句
2. 点击"转换"按钮或按 `Ctrl + Enter`
3. 右侧将显示生成的 Markdown 表格
4. 点击"复制"按钮可将结果复制到剪贴板

## 示例

输入：
```sql
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT '用户ID',
    username VARCHAR(50) NOT NULL COMMENT '用户名',
    email VARCHAR(100) UNIQUE COMMENT '邮箱',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
);

COMMENT ON COLUMN users.email IS '邮箱（PostgreSQL 示例）';
```

输出：
```markdown
## users

| 字段名 | 类型 | 键类型 | 非空 | 默认值 | 说明 |
|--------|------|--------|------|--------|------|
| id | INT | PRIMARY KEY | 是 | - | 用户ID |
| username | VARCHAR(50) | - | 是 | - | 用户名 |
| email | VARCHAR(100) | UNIQUE | 否 | - | 邮箱（PostgreSQL 示例） |
| created_at | TIMESTAMP | - | 否 | CURRENT_TIMESTAMP | 创建时间 |
```

## 文件说明

- `index.html` - 主页面
- `style.css` - 样式文件
- `ddl2markdown.js` - DDL 解析和转换核心逻辑
- `app.js` - 应用程序主逻辑和交互

## 本地运行

直接在浏览器中打开 `index.html` 文件即可使用，无需任何服务器或构建步骤。

## 浏览器支持

支持所有现代浏览器（Chrome、Firefox、Safari、Edge 等）。

