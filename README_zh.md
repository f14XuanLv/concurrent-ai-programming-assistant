
# 并发 AI 编程助手

## 背景

大型语言模型（LLM），如 Gemini 和 Claude，越来越多地被用于协助开发人员修改代码。然而，一个常见的瓶颈是这些模型通常按顺序处理对单个文件或一组文件的修改请求。即使单个提示请求更改多个文件，开发人员也常常需要等待 AI 完成所有修改后才能看到结果。这可能导致大量的等待时间和效率降低。

**并发 AI 编程助手**是一个基于 Web 的 IDE，旨在应对这一挑战。它采用两级 AI 策略：

1.  **一级 AI（全局分析 - 手动步骤）：** 用户使用一个强大的人工智能（例如 Claude-4-opus 或功能强大的 Gemini 模型）对代码库进行全局分析。用户向 AI 提供项目结构、相关文件内容及其高级需求。AI 的作用是识别跨多个文件所有必要的修改，并以特定的结构化格式输出这些指令，包括建议的并发操作数。
2.  **二级 AI（文件特定执行 - 由本应用自动执行）：** 用户将一级 AI 的结构化输出粘贴到此应用程序中。然后，应用程序解析这些指令，并对指定的 Gemini 模型（默认为 `gemini-2.5-flash-preview-05-20`，用户可配置）进行并发 API 调用，以并行执行每个文件的特定代码修改。本应用使用 `@google/genai` SDK 执行这些调用。

这种方法旨在通过并行化单个文件修改的执行，显著加快将 AI 建议的更改应用于代码库的过程。

## 功能特性

*   **项目上传：** 直接在浏览器中上传整个项目文件夹。
*   **交互式文件树：** 查看和导航项目的目录结构。
*   **文件内容查看器：**
    *   显示基于文本的文件内容。
    *   直接在编辑器面板中渲染常见的图像类型（PNG、JPEG、GIF、SVG）。
*   **一级 AI 提示助手：**
    *   协助为用户选择的一级 AI 生成结构化提示。
    *   自动包含项目的文件树和上传文件列表。
    *   提供一个模板，供用户添加其特定的修改需求。
*   **一级 AI 输出处理：**
    *   解析来自一级 AI 的结构化输出（包含线程数和每个文件的详细修改指令）。
*   **并发二级 AI 执行：**
    *   根据解析的指令和建议的线程数，使用 `@google/genai` SDK 对配置的 Gemini 模型进行并行 API 调用。
*   **内存中文件更新：** 将从二级 AI 收到的修改应用于浏览器内的文件表示。
*   **可配置设置（含优先级）：**
    *   **API 密钥：**
        1.  用户输入的密钥（在“设置”面板中）具有最高优先级。
        2.  如果用户字段为空，则尝试使用部署者提供的密钥（通过 `process.env.API_KEY`，例如来自 Vercel 环境变量 `API_KEY`）。*注意：关于在 Vercel 静态站点上客户端 `process.env` 的访问，请参阅“重要注意事项”。*
        3.  如果两者都不可用，则在执行时提示用户。
    *   **API URL：**
        1.  部署者提供的 URL（通过 `process.env.API_URL`，例如来自 Vercel 环境变量 `API_URL`）具有最高优先级。如果检测到并使用，则“设置”中的 API URL 输入字段将被隐藏。*注意：关于客户端 `process.env` 访问，请参阅相关说明。*
        2.  如果没有检测到部署者 URL，用户可以在“设置”中输入自定义 URL。
        3.  如果以上两者均未设置，则默认为 `https://generativelanguage.googleapis.com`。
        4.  **注意：** `@google/genai` SDK 主要使用标准的 Google API 端点。自定义 API URL 可能对 SDK 发送请求的目标位置影响有限或无效。
    *   **Gemini 模型名称：** 指定用于二级 AI 修改的 Gemini 模型（默认为 `gemini-2.5-flash-preview-05-20`）。
    *   **忽略的文件夹：** 指定要从一级提示中排除、在树中折叠显示并在二级修改中跳过的文件夹。
*   **实时状态栏：** 提供有关当前操作、进度和错误的反馈。
*   **路径自动修正：** 如果一级 AI 输出的文件路径不包含根项目文件夹名称，则尝试修正它们。

## 工作流程

1.  **设置 API 配置（设置面板）：**
    *   **Gemini API 密钥：** 您可以在此处输入您的 API 密钥。如果您将此字段留空，应用程序将尝试使用部署者提供的 API 密钥（如果通过 `API_KEY` 环境变量配置并且客户端可访问 - 请参阅“部署到 Vercel”部分的说明）。
    *   **Gemini API URL：**
        *   如果部署者已配置 `API_URL` 环境变量（并且客户端可访问），则此字段可能被隐藏，并使用部署者的 URL。
        *   否则，此字段可见。您可以输入自己的 API URL，或将其留空以使用默认值。
        *   **重要 SDK 说明：** 本应用使用 `@google/genai` SDK, 该 SDK 通常管理其自己的 API 端点。此处输入的自定义 URL 可能不会改变 SDK 的目标端点。
    *   可选地，设置 **Gemini 模型名称**。
    *   可选地，自定义**忽略的文件夹**列表。
2.  **上传项目：** 点击“上传项目文件夹”按钮。
3.  **准备一级 AI 提示（一级面板 - 步骤 1）：**
    *   在“您的需求”文本区域中描述您的高级需求。
    *   点击“准备/刷新一级提示模板”按钮。
    *   查看并编辑生成的提示。
4.  **使用外部一级 AI（手动步骤）：**
    *   复制一级提示。
    *   将其粘贴到您选择的强大 LLM 中，并获取结构化响应。
5.  **处理一级 AI 输出（一级面板 - 步骤 2）：**
    *   粘贴 AI 的输出。
    *   点击“执行修改（调用二级 AI）”按钮。
6.  **并发执行和文件更新：** 应用会处理指令，并使用对 Gemini API 的并发 SDK 调用在内存中更新文件。
7.  **审查更改：** 在编辑器中查看更新后的文件。更改在内存中。

## 技术细节

*   **前端：** React (v19) 与 TypeScript，使用 Tailwind CSS 进行样式设计。
*   **AI 集成：**
    *   **一级（分析）：** 用户管理。
    *   **二级（修改）：** Google Gemini API，通过 `@google/genai` SDK。模型可配置（默认为 `gemini-2.5-flash-preview-05-20`）。
*   **环境变量（针对部署者 - 关于客户端访问，请参阅 Vercel 说明）：**
    *   `API_KEY`: 部署者可以设置全局 API 密钥。
    *   `API_URL`: 部署者可以设置全局 API URL（但请参阅上面的 SDK 说明）。
*   **核心逻辑：** 内存中的文件系统表示、结构化文本解析、并发 API 调用。
*   **打包/服务：** 直接在 `index.html` 中通过导入映射表（import map）导入 ES 模块。

## 如何运行 (本地开发)

**选项 1: 简单 HTTP 服务器 (匹配当前设置)**
1.  **先决条件:** 现代 Web 浏览器。
2.  **提供文件服务:** 在项目根目录使用任何本地 HTTP 服务器。
    *   Node.js 示例: `npx serve .`
    *   Python 3 示例: `python -m http.server`
    *   使用 VS Code 的 "Live Server" 等插件。
3.  **访问:** 打开本地服务器提供的 URL (例如, `http://localhost:3000` 或 `http://localhost:8000`)。
4.  **API 配置:** 在应用的“设置”面板中配置 API。简单的 HTTP 服务器通常不会填充 `API_KEY` 或 `API_URL` 的 `process.env` 变量；依赖用户在应用内输入。

**选项 2: 使用 Vite (推荐用于增强开发体验)**
Vite 可以提供更强大的开发体验，例如热模块替换 (HMR) 和优化构建。
1.  **先决条件:** 安装 Node.js 和 npm/yarn/pnpm。
2.  **安装并运行 Vite:**
    *   如果尚未全局安装 Vite: `npm install -g vite` (或使用 `npx vite`)。
    *   在终端中导航到项目目录。
    *   运行 `vite`。
    *   Vite 将服务 `index.html` 并处理依赖关系。
3.  **Vite 的环境变量:**
    *   Vite 使用 `.env` 文件在本地管理环境变量。在项目根目录创建一个名为 `.env` 的文件。
    *   打算在客户端公开的变量**必须**以 `VITE_` 为前缀。例如:
        ```env
        VITE_API_KEY=your_gemini_api_key_for_local_dev
        VITE_API_URL=your_optional_api_url_for_local_dev
        ```
    *   要在应用程序代码中使用这些变量，您需要通过 `import.meta.env.VITE_API_KEY` 和 `import.meta.env.VITE_API_URL` 来访问它们。这意味着，如果您希望 Vite 在本地开发中管理这些变量，则需要修改 `App.tsx` 中定义 `DEPLOYER_API_KEY` 和 `DEPLOYER_API_URL` 的地方，将 `process.env.API_KEY` 更改为 `import.meta.env.VITE_API_KEY` (URL 也类似)。
4.  **访问:** Vite 将提供一个本地 URL，通常是 `http://localhost:5173`。
5.  **API 配置 (设置面板):** 如果不使用 Vite 的环境变量，或者它们没有设置，您仍然可以通过应用的“设置”面板配置 API 密钥和 URL。

## 部署

### Vercel (推荐)

此应用程序可以轻松地作为静态站点部署在 Vercel 上。

1.  **推送到 Git:** 确保您的项目是一个 Git 仓库，并已推送到 GitHub, GitLab, 或 Bitbucket 等提供商。
2.  **导入到 Vercel:**
    *   注册或登录 [Vercel](https://vercel.com)。
    *   点击 "Add New..." -> "Project"。
    *   导入您的 Git 仓库。
    *   Vercel 通常会自动检测静态站点。对于此项目的简单 HTML/JS/CSS 结构:
        *   **Framework Preset (框架预设):** 选择 "Other"。
        *   **Build Command (构建命令):** 留空 (因为当前没有为 Vercel 集成构建步骤)。
        *   **Output Directory (输出目录):** 如果没有构建步骤，则不适用。
        *   **Install Command (安装命令):** 可以留空。
3.  **在 Vercel 上配置环境变量:**
    *   在您的 Vercel 项目仪表板中，转到 "Settings" -> "Environment Variables"。
    *   添加以下变量 (这些是应用程序 *尝试* 通过 `process.env` 读取的名称):
        *   `API_KEY`: 您的 Google Gemini API 密钥。
        *   `API_URL`: (可选) 您用于 Gemini 的自定义 API URL/代理。
    *   **关于静态部署中客户端访问的关键说明:**
        *   当您将此应用程序作为简单的静态站点部署到 Vercel 时 (即 Vercel 仅提供您现有的 HTML/JS 文件，而没有在 Vercel 中集成诸如 Vite 或 Next.js 之类的构建步骤)，您在 Vercel UI 中设置的环境变量 (`API_KEY`, `API_URL`) **不会自动**作为 `process.env.API_KEY` 或 `process.env.API_URL` 在您的客户端 JavaScript 中可用。
        *   因此，应用程序尝试读取这些变量 (例如 `const DEPLOYER_API_KEY = process.env.API_KEY;`) 在浏览器中很可能会发现它们是 `undefined`。
        *   **然后，应用程序将优雅地回退**到要求用户在“设置”面板中输入 API 密钥和 URL (如果适用)。
        *   要使这些变量能够直接从 Vercel 的环境设置中可靠地提供给客户端代码：
            *   **推荐方案 (将 Vite 与 Vercel 构建集成):**
                1.  将 Vercel 的构建命令设置为 `vite build` (假设您的项目中已设置 Vite)。
                2.  在 Vercel 中，使用 `VITE_` 前缀定义您的环境变量 (例如 `VITE_API_KEY`, `VITE_API_URL`)。
                3.  修改 `App.tsx` 以读取 `import.meta.env.VITE_API_KEY` 和 `import.meta.env.VITE_API_URL`。Vercel 运行时，Vite 将处理在构建过程中嵌入这些变量。
4.  **部署:** 点击 "Deploy" 按钮。

## 重要注意事项

*   **API 密钥安全：** 用户输入的密钥在会话期间存储在浏览器状态中。对于部署者密钥（通过环境变量，如 Vercel 上的 `API_KEY`）：
    *   它们能否安全地暴露给客户端并被客户端访问，在很大程度上取决于部署平台和构建工具。
    *   **对于当前的 Vercel 静态部署 (没有在 Vercel 中使用 Vite 构建步骤):** 在 Vercel UI 中设置的 `API_KEY` 将**不会**被客户端的 `process.env` 直接读取。应用程序依赖用户输入作为后备。
    *   **如果将 Vite 集成到 Vercel 的构建中:** 在 Vercel UI 中设置的 `VITE_API_KEY` 将在构建期间由 Vite 安全地嵌入。
*   **一级 AI 输出格式：** 一级 AI 严格遵守指定的输出格式至关重要。
*   **CORS 问题与 SDK：** `@google/genai` SDK 负责与 Google 服务器的通信。
*   **内存操作：** 所有文件上传和修改当前都在浏览器会话的内存中处理。刷新页面将清除上传的文件和更改。
*   **环境变量优先级:** 应用优先使用用户输入的 API 密钥。如果为空，则尝试使用部署者设置的密钥 (如前所述，在简单的静态部署中，这些密钥可能无法在客户端使用)。

## 未来增强（潜在想法）

*   直接“保存到磁盘”或“下载项目”功能。
*   与 Git 集成以进行版本控制。
*   更复杂的 API 调用错误恢复和重试机制。
*   在应用更改前可视化差异的 UI。
*   用户可配置的二级提示模板。
