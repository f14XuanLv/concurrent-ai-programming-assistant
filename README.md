
# Concurrent AI Programming Assistant

## Background

Large Language Models (LLMs) like Gemini and Claude are increasingly used to assist developers in modifying code. However, a common bottleneck is that these models typically process modification requests for one file or a set of files serially. Even if a single prompt requests changes to multiple files, the developer often waits for the AI to complete all modifications before seeing results. This can lead to significant waiting times and reduced efficiency.

The **Concurrent AI Programming Assistant** is a web-based IDE designed to address this challenge. It employs a two-tier AI strategy:

1.  **Level 1 AI (Global Analysis - Manual Step):** A powerful AI (e.g., Claude-4-opus or a capable Gemini model) is used by the user to perform a global analysis of the codebase. The user provides the AI with the project structure, relevant file contents, and their high-level requirements. The AI's role is to identify all necessary modifications across multiple files and output these instructions in a specific, structured format, including a suggested number of concurrent operations.
2.  **Level 2 AI (File-Specific Execution - Automated by this App):** The user pastes the structured output from the Level 1 AI into this application. The application then parses these instructions and makes concurrent API calls to a specified Gemini model (e.g., `gemini-2.5-flash-preview-04-17` by default, configurable by the user) to execute the specific code modifications for each file in parallel. This application uses the `@google/genai` SDK for these calls.

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
        2.  If user field is empty, a deployer-provided key (via `API_KEY` environment variable, e.g., in Vercel) is used silently.
        3.  If neither is available, the user is prompted upon execution.
    *   **API URL:**
        1.  A deployer-provided URL (via `API_URL` environment variable) takes highest priority. If set, the API URL input in Settings is hidden.
        2.  If no deployer URL, the user can enter a custom URL in Settings.
        3.  If neither of the above, defaults to `https://generativelanguage.googleapis.com`.
        4.  **Note:** The `@google/genai` SDK primarily uses standard Google API endpoints. Custom API URLs might have limited or no effect on where the SDK sends requests.
    *   **Gemini Model Name:** Specify the Gemini model for Level 2 AI (defaults to `gemini-2.5-flash-preview-04-17`).
    *   **Ignored Folders:** Specify folders to exclude from L1 prompt, collapse in tree, and skip for L2 modifications.
*   **Real-time Status Bar:** Provides feedback on current operations, progress, and errors.
*   **Path Auto-Correction:** Attempts to correct file paths from L1 AI output.

## Workflow

1.  **Setup API Configuration (Settings Panel):**
    *   **Gemini API Key:** You can enter your API key here. If you leave this blank, the application will attempt to use an API key provided by the deployer (if configured via an `API_KEY` environment variable). If neither is available, you'll be prompted when trying to execute modifications.
    *   **Gemini API URL:**
        *   If the deployer has configured an `API_URL` environment variable, this field will be hidden, and the deployer's URL will be used.
        *   Otherwise, this field is visible. You can enter your own API URL, or leave it blank to use the default (`https://generativelanguage.googleapis.com`).
        *   **Important SDK Note:** The application uses the `@google/genai` SDK, which typically manages its own API endpoints. Custom URLs entered here might not alter the SDK's target endpoint.
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
    *   **Level 2 (Modification):** Google Gemini API via `@google/genai` SDK. Model configurable (defaults to `gemini-2.5-flash-preview-04-17`).
*   **Environment Variables (for Deployers):**
    *   `API_KEY`: Deployer can set a global API key.
    *   `API_URL`: Deployer can set a global API URL (but see SDK note above).
*   **Core Logic:** In-memory file system, structured text parsing, concurrent API calls.
*   **Bundling/Serving:** ES Modules via import map.

## Key Files & Structure

*   `index.html`, `index.tsx`, `App.tsx`
*   **`components/`**: `SettingsPanel.tsx`, `FileTreePanel.tsx`, `EditorPanel.tsx`, `Level1Panel.tsx`, `StatusBar.tsx`, `Button.tsx`
*   **`services/`**: `fileParserService.ts`, `geminiService.ts` (uses `@google/genai` SDK)
*   `types.ts`, `constants.tsx`

## How to Run

1.  **Prerequisites:** Modern web browser.
2.  **Serve the Files:** Use a local HTTP server (e.g., `npx serve .`, Python's `http.server`, VS Code Live Server).
3.  **Access:** Open the local address (e.g., `http://localhost:3000`).
4.  **API Configuration (Settings Panel):**
    *   Enter your **Gemini API Key** or rely on a deployer-set key.
    *   The **Gemini API URL** field might be hidden if set by the deployer. If visible, you can customize it, but be aware of SDK behavior.
    *   Confirm/Set **Gemini Model Name**.

## Important Considerations

*   **API Key Security:** User-entered keys are in browser state. Deployer keys (via ENV vars) are not directly exposed to the end-user's browser UI if the user field is empty.
*   **Level 1 AI Output Format:** Strict adherence to the output format by the Level 1 AI is crucial.
*   **CORS Issues & SDK:** The `@google/genai` SDK handles communication with Google's servers. If you were previously using a custom proxy URL to bypass CORS for manual `fetch` calls, this proxy might not be compatible with the SDK's direct communication unless it transparently proxies the official Google API endpoints. The SDK itself generally doesn't require special CORS handling when used correctly.
*   **In-Memory Operations:** All changes are in-memory. No auto-save to disk.
*   **Environment Variable Exposure:** If deploying, ensure `API_KEY` and `API_URL` environment variables are correctly exposed to the application build or runtime if you intend for the deployer configuration to work. For Vercel static deployments, this usually involves prefixing (e.g., `NEXT_PUBLIC_`) or other build-time injection methods, which are outside the scope of this simple app structure. The app attempts to read `process.env.API_KEY` and `process.env.API_URL`; if these are undefined in the browser, the feature will silently be inactive.

## Future Enhancements (Potential Ideas)

*   Save/Download project.
*   Git integration.
*   Diff visualization.
*   User-configurable Level 2 prompt templates.
