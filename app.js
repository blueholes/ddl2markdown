/**
 * 应用程序主逻辑
 */
document.addEventListener('DOMContentLoaded', function() {
    const sqlInput = document.getElementById('sqlInput');
    const markdownOutput = document.getElementById('markdownOutput');
    const convertBtn = document.getElementById('convertBtn');
    const copyBtn = document.getElementById('copyBtn');
    const clearBtn = document.getElementById('clearBtn');
    const exampleBtn = document.getElementById('exampleBtn');
    const preview = document.getElementById('preview');

    const converter = new DDL2Markdown();

    // 转换按钮点击事件
    convertBtn.addEventListener('click', function() {
        const sql = sqlInput.value.trim();
        
        if (!sql) {
            alert('请输入 SQL DDL 语句');
            return;
        }

        try {
            const markdown = converter.convert(sql);
            markdownOutput.value = markdown;
            
            // 显示预览
            showPreview(markdown);
            
            // 滚动到输出区域
            markdownOutput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (error) {
            alert(error.message);
            markdownOutput.value = '';
            preview.classList.remove('show');
        }
    });

    // 复制按钮点击事件
    copyBtn.addEventListener('click', function() {
        const markdown = markdownOutput.value;
        
        if (!markdown) {
            alert('没有可复制的内容');
            return;
        }

        markdownOutput.select();
        document.execCommand('copy');
        
        // 显示成功提示
        showSuccessMessage('已复制到剪贴板！');
    });

    // 清空按钮点击事件
    clearBtn.addEventListener('click', function() {
        sqlInput.value = '';
        markdownOutput.value = '';
        preview.classList.remove('show');
        sqlInput.focus();
    });

    // 示例按钮点击事件
    exampleBtn.addEventListener('click', function() {
        const exampleSQL = `-- MySQL 风格（包含列级 COMMENT）
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT '用户ID',
    username VARCHAR(50) NOT NULL COMMENT '用户名',
    email VARCHAR(100) UNIQUE NOT NULL COMMENT '邮箱',
    password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
    first_name VARCHAR(50) COMMENT '名',
    last_name VARCHAR(50) COMMENT '姓',
    age INT COMMENT '年龄',
    status ENUM('active', 'inactive', 'pending') DEFAULT 'pending' COMMENT '状态',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at DATETIME NULL COMMENT '删除时间'
);

-- PostgreSQL 风格（使用 COMMENT ON）
CREATE TABLE posts (
    id BIGINT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT,
    slug VARCHAR(255) UNIQUE,
    published BOOLEAN DEFAULT FALSE,
    view_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE posts IS '文章表';
COMMENT ON COLUMN posts.id IS '主键';
COMMENT ON COLUMN posts.user_id IS '作者ID';
COMMENT ON COLUMN posts.title IS '标题';
COMMENT ON COLUMN posts.content IS '正文';
COMMENT ON COLUMN posts.slug IS '唯一短链';
COMMENT ON COLUMN posts.published IS '是否发布';
COMMENT ON COLUMN posts.view_count IS '浏览量';
COMMENT ON COLUMN posts.created_at IS '创建时间';`;
        
        sqlInput.value = exampleSQL;
        sqlInput.focus();
    });

    // 显示 Markdown 预览
    function showPreview(markdown) {
        // 简单的 Markdown 表格解析和渲染
        const lines = markdown.split('\n');
        let tableHTML = '';
        let inTable = false;
        let headerProcessed = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('##')) {
                // 标题
                const title = line.replace(/^##\s*/, '');
                if (inTable) {
                    tableHTML += '</tbody></table>';
                    inTable = false;
                    headerProcessed = false;
                }
                tableHTML += `<h3>${title}</h3>`;
            } else if (line.startsWith('|')) {
                // 检查是否是分隔行
                if (line.match(/^\|[\s-:]+\|$/)) {
                    // 这是分隔行，下一行应该是表头
                    continue;
                }
                
                // 表格行
                const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
                
                if (!inTable) {
                    tableHTML += '<table><thead><tr>';
                    cells.forEach(cell => {
                        tableHTML += `<th>${cell}</th>`;
                    });
                    tableHTML += '</tr></thead><tbody>';
                    inTable = true;
                    headerProcessed = true;
                } else if (headerProcessed && cells.length > 0) {
                    // 数据行
                    tableHTML += '<tr>';
                    cells.forEach(cell => {
                        tableHTML += `<td>${cell || '-'}</td>`;
                    });
                    tableHTML += '</tr>';
                }
            }
        }
        
        if (inTable) {
            tableHTML += '</tbody></table>';
        }
        
        preview.innerHTML = tableHTML;
        preview.classList.add('show');
    }

    // 显示成功消息
    function showSuccessMessage(message) {
        // 创建或获取成功消息元素
        let successMsg = document.querySelector('.success-message');
        if (!successMsg) {
            successMsg = document.createElement('div');
            successMsg.className = 'success-message';
            document.body.appendChild(successMsg);
        }
        
        successMsg.textContent = message;
        successMsg.classList.add('show');
        
        setTimeout(() => {
            successMsg.classList.remove('show');
        }, 2000);
    }

    // 支持快捷键
    sqlInput.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            convertBtn.click();
        }
    });
});

