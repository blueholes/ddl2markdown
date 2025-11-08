/**
 * SQL DDL 转 Markdown 表格转换器
 */
class DDL2Markdown {
    constructor() {
        this.fieldRegex = /(\w+)\s+([\w\(\)]+(?:\s*\([^)]+\))?)\s*(.*?)(?:,|$)/gi;
        this.constraintKeywords = [
            'PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE', 'NOT NULL', 'NULL',
            'AUTO_INCREMENT', 'AUTOINCREMENT', 'DEFAULT', 'CHECK',
            'REFERENCES', 'ON DELETE', 'ON UPDATE'
        ];
    }

    /**
     * 解析 SQL DDL 语句
     */
    parseDDL(sql) {
        sql = sql.trim();
        
        // 移除注释
        sql = sql.replace(/--.*$/gm, '');
        sql = sql.replace(/\/\*[\s\S]*?\*\//g, '');
        
        // 提取表名
        const tableMatch = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|")?(\w+)(?:`|")?/i);
        if (!tableMatch) {
            throw new Error('无法找到 CREATE TABLE 语句');
        }
        const tableName = tableMatch[1];

        // 提取字段定义部分
        const fieldsMatch = sql.match(/\(([\s\S]*)\)/);
        if (!fieldsMatch) {
            throw new Error('无法找到表字段定义');
        }
        const fieldsContent = fieldsMatch[1];

        // 解析字段
        const fields = this.parseFields(fieldsContent);

        return {
            tableName,
            fields
        };
    }

    /**
     * 解析字段定义
     */
    parseFields(fieldsContent) {
        const fields = [];
        // 更智能地分割字段：考虑括号内的逗号
        const fieldStrings = this.splitFields(fieldsContent);
        
        for (let fieldStr of fieldStrings) {
            fieldStr = fieldStr.trim();
            
            // 跳过空字符串
            if (!fieldStr) {
                continue;
            }
            
            // 跳过约束定义（如 PRIMARY KEY (id)）
            if (fieldStr.match(/^(PRIMARY KEY|FOREIGN KEY|UNIQUE|CHECK)\s*\(/i)) {
                continue;
            }

            const field = this.parseField(fieldStr);
            if (field) {
                fields.push(field);
            }
        }

        return fields;
    }

    /**
     * 智能分割字段定义，考虑括号内的逗号
     */
    splitFields(content) {
        const fields = [];
        let current = '';
        let depth = 0;
        
        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            
            if (char === '(') {
                depth++;
                current += char;
            } else if (char === ')') {
                depth--;
                current += char;
            } else if (char === ',' && depth === 0) {
                // 只有在括号深度为0时才分割
                fields.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        // 添加最后一个字段
        if (current.trim()) {
            fields.push(current);
        }
        
        return fields;
    }

    /**
     * 解析单个字段
     */
    parseField(fieldStr) {
        // 移除引号
        fieldStr = fieldStr.replace(/`|"/g, '');
        
        // 匹配字段名、类型和约束
        // 字段名: \w+
        // 类型: \w+ 后跟可选的 (参数)
        // 约束: 剩余部分
        const match = fieldStr.match(/^(\w+)\s+(\w+(?:\([^)]*\))?)\s*(.*)$/i);
        if (!match) {
            return null;
        }

        const name = match[1].trim();
        const type = match[2].trim();
        const constraints = match[3] ? match[3].trim() : '';

        // 解析约束
        const parsedConstraints = this.parseConstraints(constraints);

        return {
            name,
            type: this.normalizeType(type),
            constraints: parsedConstraints,
            raw: fieldStr
        };
    }

    /**
     * 解析约束
     */
    parseConstraints(constraintsStr) {
        const constraints = {
            nullable: true,
            primaryKey: false,
            unique: false,
            autoIncrement: false,
            default: null,
            comment: null,
            other: []
        };

        if (!constraintsStr) {
            return constraints;
        }

        const upperStr = constraintsStr.toUpperCase();

        // NOT NULL
        if (upperStr.includes('NOT NULL')) {
            constraints.nullable = false;
        }

        // PRIMARY KEY
        if (upperStr.includes('PRIMARY KEY')) {
            constraints.primaryKey = true;
            constraints.nullable = false;
        }

        // UNIQUE
        if (upperStr.includes('UNIQUE')) {
            constraints.unique = true;
        }

        // AUTO_INCREMENT / AUTOINCREMENT
        if (upperStr.includes('AUTO_INCREMENT') || upperStr.includes('AUTOINCREMENT')) {
            constraints.autoIncrement = true;
        }

        // DEFAULT - 支持字符串、数字、函数调用等
        const defaultRegex = /DEFAULT\s+(.+?)(?:\s+(?:COMMENT|ON\s+UPDATE|NOT\s+NULL|NULL|UNIQUE|PRIMARY|AUTO_INCREMENT|AUTOINCREMENT)|$)/i;
        const defaultMatch = constraintsStr.match(defaultRegex);
        if (defaultMatch) {
            let defaultValue = defaultMatch[1].trim();
            // 移除尾随的逗号
            defaultValue = defaultValue.replace(/,\s*$/, '').trim();
            
            // 如果值以引号开始，完整提取引号内容
            if ((defaultValue.startsWith("'") && defaultValue.endsWith("'")) ||
                (defaultValue.startsWith('"') && defaultValue.endsWith('"'))) {
                constraints.default = defaultValue;
            } else {
                // 对于函数调用或数字，提取到第一个空格或逗号之前（但保留 CURRENT_TIMESTAMP 这样的多词函数）
                // 处理 CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP 的情况
                if (defaultValue.toUpperCase().includes('ON UPDATE')) {
                    defaultValue = defaultValue.split(/ON\s+UPDATE/i)[0].trim();
                }
                constraints.default = defaultValue;
            }
        }

        // COMMENT '...'
        const commentMatch = constraintsStr.match(/COMMENT\s+(?:'([^']*(?:''[^']*)*)'|"([^"\\\n]*)")/i);
        if (commentMatch) {
            const raw = commentMatch[1] != null ? commentMatch[1] : (commentMatch[2] || '');
            constraints.comment = raw.replace(/''/g, "'");
        }

        return constraints;
    }

    /**
     * 标准化数据类型
     */
    normalizeType(type) {
        // 提取基础类型和参数
        const match = type.match(/^(\w+)(\([^)]*\))?/i);
        if (!match) {
            return type.toUpperCase();
        }

        const baseType = match[1].toUpperCase();
        const params = match[2] || ''; // 保留原始参数格式（包括大小写）
        
        // 标准化常见类型
        const typeMap = {
            'INT': 'INT',
            'INTEGER': 'INT',
            'BIGINT': 'BIGINT',
            'SMALLINT': 'SMALLINT',
            'TINYINT': 'TINYINT',
            'VARCHAR': 'VARCHAR',
            'CHAR': 'CHAR',
            'TEXT': 'TEXT',
            'LONGTEXT': 'LONGTEXT',
            'MEDIUMTEXT': 'MEDIUMTEXT',
            'DATETIME': 'DATETIME',
            'TIMESTAMP': 'TIMESTAMP',
            'DATE': 'DATE',
            'TIME': 'TIME',
            'DECIMAL': 'DECIMAL',
            'NUMERIC': 'NUMERIC',
            'FLOAT': 'FLOAT',
            'DOUBLE': 'DOUBLE',
            'BOOLEAN': 'BOOLEAN',
            'BOOL': 'BOOLEAN',
            'BLOB': 'BLOB',
            'JSON': 'JSON',
            'ENUM': 'ENUM'
        };

        const normalized = typeMap[baseType] || baseType;
        return normalized + params;
    }

    /**
     * 生成 Markdown 表格
     */
    generateMarkdown(parsed) {
        const { tableName, fields } = parsed;
        
        let markdown = `## ${tableName}\n\n`;
        markdown += `| 字段名 | 类型 | 键类型 | 非空 | 默认值 | 说明 |\n`;
        markdown += `|--------|------|--------|------|--------|------|\n`;

        for (const field of fields) {
            // 键类型优先级：PRIMARY KEY > UNIQUE，否则为 '-'
            const keyType = field.constraints.primaryKey
                ? 'PRIMARY KEY'
                : (field.constraints.unique ? 'UNIQUE' : '-');

            // 非空：是/否（PRIMARY KEY 默认非空）
            const notNull = field.constraints.nullable ? '否' : '是';

            // 默认值
            const defaultValue = field.constraints.default ? field.constraints.default : '-';

            const comment = field.constraints.comment ? field.constraints.comment : '';
            markdown += `| ${field.name} | ${field.type} | ${keyType} | ${notNull} | ${defaultValue} | ${comment} |\n`;
        }

        return markdown;
    }

    /**
     * 解析多个表的 DDL 语句
     */
    parseMultipleDDL(sql) {
        sql = sql.trim();
        
        // 移除注释
        sql = sql.replace(/--.*$/gm, '');
        sql = sql.replace(/\/\*[\s\S]*?\*\//g, '');
        
        // 分割多个 CREATE TABLE 语句
        const tables = [];
        const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|")?(\w+)(?:`|")?\s*\(/gi;
        let match;
        
        while ((match = createTableRegex.exec(sql)) !== null) {
            // 找到匹配的表定义开始位置
            const tableStart = match.index;
            const tableName = match[1];
            
            // 找到对应的右括号（考虑嵌套括号）
            let depth = 0;
            let tableEnd = tableStart;
            let inString = false;
            let stringChar = '';
            
            for (let i = tableStart; i < sql.length; i++) {
                const char = sql[i];
                const prevChar = i > 0 ? sql[i - 1] : '';
                
                // 处理字符串
                if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
                    if (!inString) {
                        inString = true;
                        stringChar = char;
                    } else if (char === stringChar) {
                        inString = false;
                        stringChar = '';
                    }
                }
                
                if (!inString) {
                    if (char === '(') {
                        depth++;
                    } else if (char === ')') {
                        depth--;
                        if (depth === 0) {
                            // 找到匹配的右括号，查找分号或下一个 CREATE TABLE
                            tableEnd = i + 1;
                            // 跳过可能的分号
                            while (tableEnd < sql.length && (sql[tableEnd] === ';' || /\s/.test(sql[tableEnd]))) {
                                tableEnd++;
                            }
                            break;
                        }
                    }
                }
            }
            
            // 提取表定义
            const tableSQL = sql.substring(tableStart, tableEnd);
            try {
                const parsed = this.parseDDL(tableSQL);
                tables.push(parsed);
            } catch (error) {
                // 跳过无法解析的表
                console.warn(`无法解析表 ${tableName}: ${error.message}`);
            }
        }
        
        if (tables.length === 0) {
            throw new Error('未找到任何 CREATE TABLE 语句');
        }
        
        return tables;
    }

    /**
     * 生成多个表的 Markdown
     */
    generateMultipleMarkdown(tables) {
        let markdown = '';
        for (let i = 0; i < tables.length; i++) {
            markdown += this.generateMarkdown(tables[i]);
            if (i < tables.length - 1) {
                markdown += '\n\n';
            }
        }
        return markdown;
    }

    /**
     * 解析并应用 PostgreSQL COMMENT ON 语法到已解析的表结构
     * - COMMENT ON COLUMN table.column IS '...';
     * - COMMENT ON TABLE table IS '...';
     */
    applyPostgresComments(sql, tables) {
        if (!tables || tables.length === 0) return tables;

        const tableByName = new Map();
        for (const tbl of tables) {
            // 使用不区分大小写的键
            tableByName.set(tbl.tableName.toLowerCase(), tbl);
        }

        // 列注释
        const colRegex = /COMMENT\s+ON\s+COLUMN\s+((?:"[^"]+"|\w+)\.)?(?:"([^"]+)"|(\w+))\.(?:"([^"]+)"|(\w+))\s+IS\s+'((?:''|[^'])*)'\s*;/gi;
        let m;
        while ((m = colRegex.exec(sql)) !== null) {
            // const schema = m[1] ? m[1].slice(0, -1) : null; // 未使用
            const tableName = (m[2] || m[3] || '').replace(/"/g, '');
            const columnName = (m[4] || m[5] || '').replace(/"/g, '');
            const commentRaw = m[6] || '';
            const comment = commentRaw.replace(/''/g, "'");

            const tbl = tableByName.get(tableName.toLowerCase());
            if (!tbl) continue;
            const col = tbl.fields.find(f => f.name.toLowerCase() === columnName.toLowerCase());
            if (col) {
                if (!col.constraints) col.constraints = {};
                col.constraints.comment = comment;
            }
        }

        // 表注释（当前未输出，但保留到对象上，便于未来扩展）
        const tblRegex = /COMMENT\s+ON\s+TABLE\s+((?:"[^"]+"|\w+)\.)?(?:"([^"]+)"|(\w+))\s+IS\s+'((?:''|[^'])*)'\s*;/gi;
        while ((m = tblRegex.exec(sql)) !== null) {
            const tableName = (m[2] || m[3] || '').replace(/"/g, '');
            const commentRaw = m[4] || '';
            const comment = commentRaw.replace(/''/g, "'");
            const tbl = tableByName.get(tableName.toLowerCase());
            if (tbl) {
                tbl.tableComment = comment;
            }
        }

        return tables;
    }

    /**
     * 转换主方法（支持单个或多个表）
     */
    convert(sql) {
        try {
            // 尝试解析多个表
            let tables = this.parseMultipleDDL(sql);
            tables = this.applyPostgresComments(sql, tables);
            if (tables.length === 1) {
                return this.generateMarkdown(tables[0]);
            } else {
                return this.generateMultipleMarkdown(tables);
            }
        } catch (error) {
            // 如果多个表解析失败，尝试单个表
            try {
                const parsed = this.parseDDL(sql);
                // 也尝试应用 Postgres 注释
                const tables = this.applyPostgresComments(sql, [parsed]);
                const enriched = tables[0] || parsed;
                return this.generateMarkdown(enriched);
            } catch (singleError) {
                throw new Error(`转换失败: ${error.message}`);
            }
        }
    }
}

