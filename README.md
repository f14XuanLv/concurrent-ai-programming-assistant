# Concurrent AI Programming Assistant

## Background

Large Language Models (LLMs) like Gemini and Claude are increasingly used to assist developers in modifying code. However, a common bottleneck is that these models typically process modification requests for one file or a set of files serially. Even if a single prompt requests changes to multiple files, the developer often waits for the AI to complete all modifications before seeing results. This can lead to significant waiting times and reduced efficiency.

The **Concurrent AI Programming Assistant** is a web-based IDE designed to address this challenge. It employs a two-tier AI strategy:

1.  **Level 1 AI (Global Analysis - Manual Step):** A powerful AI (e.g., Claude-4-opus or a capable Gemini model) is used by the user to perform a global analysis of the codebase. The user provides the AI with the project structure, relevant file contents, and their high-level requirements. The AI's role is to identify all necessary modifications across multiple files and output these instructions in a specific, structured format, including a suggested number of concurrent operations.
2.  **Level 2 AI (File-Specific Execution - Automated by this App):** The user pastes the structured output from the Level 1 AI into this application. The application then parses these instructions and makes concurrent API calls to a specified Gemini model (e.g., `gemini-2.5-flash-preview-05-20` by default, configurable by the user) to execute the specific code modifications for each file in parallel. This application uses the `@google/genai` SDK for these calls.

This approach aims to significantly speed up the process of applying AI-suggested changes to a codebase by parallelizing the execution of individual file modifications.

## Features

*   **Project Upload:** Upload an entire project folder directly into the browser.
*   **Interactive File Tree:** View and navigate your project's directory structure.
*   **File Content Viewer:**
    *   Display text-based file contents.
    *   Render common image types (PNG, JPEG, GIF, SVG) directly in the editor panel.
*   **Level 1 Prompt Helper:**
    *   Assists in generating a structured prompt for your chosen Level 1 AI.
    *   Automatically includes the project's file tree and a list of uploaded files.
    *   Provides a template for you to add your specific modification requirements.
*   **Level 1 Output Processing:**
    *   Parses the structured output (containing thread count and detailed modification instructions for each file) from your Level 1 AI.
*   **Concurrent Level 2 AI Execution:**
    *   Makes parallel API calls to the configured Gemini model using the `@google/genai` SDK, based on the parsed instructions and suggested thread count.
*   **In-Memory File Updates:** Applies the modifications received from the Level 2 AI to the in-browser representation of your files.
*   **Configurable Settings with Hierarchy:**
    *   **API Key:**
        1.  User-entered key (in Settings Panel) takes highest priority.
        2.  If user field is empty, a deployer-provided key is used. For Vercel + Vite builds, this means `VITE_API_KEY` set in Vercel UI and accessed via `import.meta.env.VITE_API_KEY`.
    *   **API URL:**
        1.  A deployer-provided URL (e.g., `VITE_API_URL` for Vercel + Vite builds) takes highest priority. If detected and used, the API URL input in Settings is hidden.
        2.  If no deployer URL is detected, the user can enter a custom URL in Settings.
        3.  If neither of the above, defaults to `https://generativelanguage.googleapis.com`.
        4.  **Note:** The `@google/genai` SDK primarily uses standard Google API endpoints. Custom API URLs might have limited or no effect on where the SDK sends requests.
    *   **Gemini Model Name:** Specify the Gemini model for Level 2 AI (defaults to `gemini-2.5-flash-preview-05-20`).
    *   **Ignored Folders:** Specify folders to exclude from L1 prompt, collapse in tree, and skip for L2 modifications.
*   **Real-time Status Bar:** Provides feedback on current operations, progress, and errors.
*   **Path Auto-Correction:** Attempts to correct file paths from L1 AI output.

## Workflow

1.  **Setup API Configuration (Settings Panel):**
    *   **Gemini API Key:** You can enter your API key here. If you leave this blank, the application will attempt to use an API key provided by the deployer (e.g., `VITE_API_KEY` if deployed on Vercel with a Vite build, or set in your local `.env.local` file for Vite development).
    *   **Gemini API URL:**
        *   If the deployer has configured an environment variable (e.g., `VITE_API_URL`), this field may be hidden.
        *   Otherwise, you can enter your own API URL, or leave it blank for the default.
        *   **Important SDK Note:** The `@google/genai` SDK typically manages its own API endpoints.
    *   Optionally, set the **Gemini Model Name**.
    *   Optionally, customize **Ignored Folders**.
2.  **Upload Project:** Click "Upload Project Folder".
3.  **Prepare Level 1 AI Prompt (Level 1 Panel - Step 1):**
    *   Describe your requirements.
    *   Click "Prepare/Refresh L1 Prompt Template".
    *   Review and edit the generated prompt.
4.  **Use External Level 1 AI (Manual Step):**
    *   Copy the L1 prompt.
    *   Paste into your chosen powerful LLM and get the structured response.
5.  **Process Level 1 AI Output (Level 1 Panel - Step 2):**
    *   Paste the AI's output.
    *   Click "Execute Modifications (Calls Level 2 AI)".
6.  **Concurrent Execution & File Updates:** The app processes instructions and updates files in-memory using concurrent calls to the Gemini API via the SDK.
7.  **Review Changes:** View updated files in the editor. Changes are in-memory.

## Technical Details

*   **Frontend:** React (v19) with TypeScript, Tailwind CSS.
*   **AI Integration:**
    *   **Level 1 (Analysis):** User-managed.
    *   **Level 2 (Modification):** Google Gemini API via `@google/genai` SDK. Model configurable (defaults to `gemini-2.5-flash-preview-05-20`).
*   **Environment Variables (for Deployers):**
    *   For Vercel deployments using Vite build (recommended):
        *   `VITE_API_KEY`: Deployer can set a global API key. App reads via `import.meta.env.VITE_API_KEY`.
        *   `VITE_API_URL`: Deployer can set a global API URL. App reads via `import.meta.env.VITE_API_URL`.
*   **Core Logic:** In-memory file system, structured text parsing, concurrent API calls.
*   **Bundling/Serving:** ES Modules via import map (for basic local serving) or Vite (for development and Vercel builds).

## How to Run (Local Development)

**Option 1: Simple HTTP Server (Basic)**
1.  Serve files with any local HTTP server (e.g., `npx serve .`).
2.  Access via `http://localhost:PORT`. API keys must be entered in settings.

**Option 2: Using Vite (Recommended for Enhanced Development)**
1.  Install Node.js.
2.  Run `npm install` (if `package.json` with Vite as a dev dependency is added) or `npm install -g vite`.
3.  Run `vite` in the project directory.
4.  **Local Environment Variables with Vite:**
    *   An example file `.env.local` is provided in the project root.
    *   You can copy it to `.env` or use it as is.
    *   Edit this file to add your `VITE_API_KEY=your_local_api_key` and `VITE_API_URL=your_local_api_url` (optional).
    *   The application (`App.tsx`) is configured to read these via `import.meta.env`.
5.  Access: Vite provides a URL (e.g., `http://localhost:5173`).

## Deployment

### Vercel (Recommended with Vite Build)

1.  **Push to Git.**
2.  **Import to Vercel.**
    *   **Framework Preset:** Select "Vite" (or "Other" and configure build command).
    *   **Build Command:** Ensure it's `vite build` or `npm run build` (if your `package.json` has `vite build` as the build script). The provided Vercel build log confirms `vite build` is being used.
    *   **Output Directory:** Vercel usually detects this correctly for Vite (`dist`).
3.  **Configure Environment Variables on Vercel:**
    *   In Vercel project settings -> "Environment Variables".
    *   **CRITICAL:** Add your environment variables with the `VITE_` prefix:
        *   `VITE_API_KEY`: Your Google Gemini API Key.
        *   `VITE_API_URL`: (Optional) Your custom API URL/proxy for Gemini.
    *   The application (`App.tsx`) is now configured to read these `VITE_` prefixed variables from `import.meta.env`. This is the correct way for Vite builds on Vercel.
4.  **Deploy.**

## Important Considerations

*   **API Key Security:** User-entered keys are in browser state. Deployer keys (`VITE_API_KEY` on Vercel) are embedded during the Vite build process if configured correctly. For local development, ensure your `.env` or `.env.local` file is in your `.gitignore`.
*   **Level 1 AI Output Format:** Strict adherence is crucial.
*   **In-Memory Operations:** Refreshing clears data.

## Future Enhancements (Potential Ideas)

*   Save/Download project.
*   Git integration.
*   Diff visualization.