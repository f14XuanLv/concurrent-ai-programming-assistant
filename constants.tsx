
import React from 'react';

export const DEFAULT_GEMINI_MODEL_NAME = "gemini-2.5-flash-preview-05-20"; 
export const DEFAULT_USER_API_URL = "https://generativelanguage.googleapis.com"; // For user-provided keys

export const LEVEL_1_PROMPT_TEMPLATE_PLACEHOLDERS = {
  FILE_TREE: "{文件树内容}",
  UPLOADED_FILES_LIST: "{上传的文件列表}",
  USER_REQUIREMENTS: "{用户需求描述}",
};

export const LEVEL_1_PROMPT_TEMPLATE = `你是一个资深的代码架构师，请分析以下项目并给出精确的修改方案。

=====PROJECT-STRUCTURE=====
${LEVEL_1_PROMPT_TEMPLATE_PLACEHOLDERS.FILE_TREE}
=====END-PROJECT-STRUCTURE=====

=====UPLOADED-FILES=====
${LEVEL_1_PROMPT_TEMPLATE_PLACEHOLDERS.UPLOADED_FILES_LIST}
=====END-UPLOADED-FILES=====

=====REQUIREMENTS=====
${LEVEL_1_PROMPT_TEMPLATE_PLACEHOLDERS.USER_REQUIREMENTS}
=====END-REQUIREMENTS=====

=====OUTPUT-FORMAT=====
请严格按照以下格式输出修改方案，每个文件的修改都要明确标注：

THREAD_COUNT: {建议的并发线程数}

FILE_MODIFICATIONS_START

FILE: {文件路径}
OPERATION: {CREATE|UPDATE|DELETE}
DESCRIPTION: {总体修改描述}
CONTEXT_MODIFICATIONS_START
{使用上下文标记的修改片段，支持多个修改点、代码段位置调整、代码段删除、插入新代码段}
CONTEXT_MODIFICATIONS_END
FILE_END

{重复上述格式为每个需要修改的文件}

FILE_MODIFICATIONS_END
=====END-OUTPUT-FORMAT=====

重要规则：
1. 仔细分析文件依赖关系，确保修改的一致性
2. 建议合理的并发线程数（通常4-8个）
3. 严格遵循输出格式，便于正则表达式解析
4. The {文件路径} in "FILE: {文件路径}" MUST be an exact match to a file path listed in the "=====UPLOADED-FILES=====" section or derivable from "=====PROJECT-STRUCTURE=====". This includes any leading project folder name if one was uploaded (e.g., "my-project/src/file.js", not just "src/file.js").
5. 使用上下文标记进行精确定位，支持多种修改类型：

**修改标记：**
\`\`\`
修改描述：简要描述一下要被修改的代码

原始代码上下文
// 以下是被修改后的代码片段

修改后的代码内容

// 以上是被修改后的代码片段
原始代码上下文
\`\`\`

**位置调整标记：**
\`\`\`
位置调整描述：简要描述一下要被调整位置的代码

原始代码上下文
// 以下是需要被调整位置的代码片段
需要被调整位置的的代码内容
// 以上是需要被调整位置的代码片段
原始代码上下文

// 被调整位置的代码需要被插入的位置如下
原始代码上下文
// 在这里插入需要被调整位置的的代码
原始代码上下文
\`\`\`

**插入新代码标记：**
\`\`\`
插入描述：简要描述一下新增的代码

// 新代码需要被插入的位置如下
原始代码上下文
// 在这里插入新代码
原始代码上下文
\`\`\`

**删除代码标记：**
\`\`\`
删除描述：简要描述一下要被删除的代码段，是什么函数或者类等

// 需要被删除的代码位置如下
原始代码上下文
// 删除这部分代码
原始代码上下文
\`\`\`

7. 特别注意语言特性要求：
   - C++: 函数声明必须在调用之前，类成员函数定义位置
   - Python: import语句位置，函数定义顺序
   - JavaScript: 变量提升，函数声明位置
   - Java: 类结构，方法修饰符顺序
`;

export const LEVEL_2_PROMPT_TEMPLATE_HEADER = `请根据以下修改片段对文件进行精确修改，输出完整的修改后文件内容。

=====FILE-INFO=====
文件路径: {filePath}
操作类型: {operationType}
修改描述: {description}
=====END-FILE-INFO=====
`;

export const LEVEL_2_PROMPT_ORIGINAL_CONTENT_SECTION = `
=====ORIGINAL-CONTENT=====
{originalContent}
=====END-ORIGINAL-CONTENT=====
`;

export const LEVEL_2_PROMPT_MODIFICATION_DETAILS_SECTION = `
=====MODIFICATION-DETAILS=====
{modificationDetails}
=====END-MODIFICATION-DETAILS=====
`;

export const LEVEL_2_PROMPT_FOOTER = `
=====OUTPUT-FORMAT=====
请输出完整的修改后文件内容，格式如下：

MODIFIED_FILE_START
{完整的修改后文件内容}
MODIFIED_FILE_END
=====END-OUTPUT-FORMAT=====

注意：
1. 确保修改的精确性，只改动指定部分
2. 保持代码格式和缩进一致
3. 输出完整文件内容，不要省略任何部分
`;

export const FolderIconSVG: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.442-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
  </svg>
);

export const FileIconSVG: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
  </svg>
);

export const LoadingSpinner: React.FC = () => (
  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" role="status" aria-label="Loading">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);