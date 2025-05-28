# Concurrent AI Programming Assistant

## Background

Large Language Models (LLMs) like Gemini and Claude are increasingly used to assist developers in modifying code. However, a common bottleneck is that these models typically process modification requests for one file or a set of files serially.

The **Concurrent AI Programming Assistant** is a web-based IDE designed to address this challenge. It employs a two-tier AI strategy:

1.  **Level 1 AI (Global Analysis - Manual Step):** A powerful AI (e.g., Claude-4-opus or a capable Gemini model) is used by the user to perform a global analysis of the codebase. The user provides the AI with the project structure, relevant file contents, and their high-level requirements. The AI's role is to identify all necessary modifications across multiple files and output these instructions in a specific, structured format.
2.  **Level 2 AI (File-Specific Execution - Automated by this App):** The user pastes the structured output from the Level 1 AI into this application. The application then parses these instructions and triggers Level 2 AI calls based on the following modes:
    *   **Mode 1: Using Deployer's Credentials (via Backend Proxy - Default)**
        *   **Condition:** The "Your Gemini API Key" field in the app's settings panel is left *empty*.
        *   **Action:** The client-side app sends modification details (prompt, model name) to a **backend proxy function** (e.g., `/api/gemini` hosted on Vercel).
        *   **Proxy Behavior:** This proxy securely uses the deployer's `GEMINI_API_KEY` (and optionally `GEMINI_API_URL`) set as server-side environment variables to make the actual call to the configured Gemini model.
    *   **Mode 2: Using User's Credentials (Direct Client-Side Call)**
        *   **Condition:** The user *enters their own Gemini API Key* in the app's settings panel.
        *   **Action:** The application makes calls **directly from the browser** to the Gemini API using the user's provided API key and the configured model. An optional API URL can also be specified by the user in settings.

This approach aims to significantly speed up applying AI-suggested changes by parallelizing individual file modifications, while offering flexibility and security in how API keys are managed.

## Features

*   **Project Upload:** Upload an entire project folder.
*   **Interactive File Tree & Viewer:** Navigate structure, view text files, render images.
*   **Level 1 Prompt Helper:** Assists in generating a structured prompt for your chosen Level 1 AI.
*   **Level 1 Output Processing:** Parses structured output from your Level 1 AI.
*   **Dual-Mode Level 2 AI Execution:**
    *   **Backend Proxy (Default):** Client sends modification details to `/api/gemini`. Proxy uses deployer-configured `GEMINI_API_KEY` and optionally `GEMINI_API_URL`.
    *   **Client-Side Direct (Optional):** If user provides their API key and optional API URL in settings, calls are made directly from the browser.
    *   Parallel execution based on Level 1 AI's suggested thread count.
*   **In-Memory File Updates:** Applies modifications from Level 2 AI to the in-browser files.
*   **Configurable Settings:**
    *   **Your Gemini API Key (L2 AI):** Optional. If provided, L2 AI calls are made client-side.
    *   **Your Gemini API URL (L2 AI):** Optional. Used with your API key for client-side calls. Defaults to `https://generativelanguage.googleapis.com`.
    *   **Gemini Model Name (L2 AI):** Specify the model for L2 AI calls (used in both modes).
    *   **Ignored Folders:** Exclude from L1 prompt, collapse in tree, skip L2 modifications.
*   **Real-time Status Bar:** Feedback on operations, progress, errors.
*   **Path Auto-Correction:** Attempts to correct file paths from L1 AI output.

## Workflow

1.  **Setup AI Configuration (Settings Panel):**
    *   To use **Mode 1 (Backend Proxy - Default)**: Leave "Your Gemini API Key" blank. The app will use the deployer-configured proxy.
    *   To use **Mode 2 (Client-Side Direct)**: Provide "Your Gemini API Key" and optionally "Your Gemini API URL".
    *   Set the **Gemini Model Name** (for L2 AI calls).
    *   Optionally, customize **Ignored Folders**.
2.  **Upload Project:** Click "Upload Project Folder".
3.  **Prepare Level 1 AI Prompt (Level 1 Panel - Step 1):**
    *   Describe requirements.
    *   Click "Prepare/Refresh L1 Prompt Template".
    *   Review and edit.
4.  **Use External Level 1 AI (Manual Step):**
    *   Copy L1 prompt.
    *   Paste into your chosen LLM and get the structured response.
5.  **Process Level 1 AI Output (Level 1 Panel - Step 2):**
    *   Paste AI's output.
    *   Click "Execute Modifications". This will trigger L2 AI calls.
6.  **Concurrent Execution & File Updates:** Files are updated in-memory.
7.  **Review Changes.**

## Technical Details

*   **Frontend:** React (v19) with TypeScript, Tailwind CSS.
*   **Backend Proxy (for Level 2 AI - Default Mode):** Vercel Serverless Function (e.g., `api/gemini.ts`).
    *   Handles the deployer's `GEMINI_API_KEY` and optionally `GEMINI_API_URL` securely.
    *   Uses `@google/genai` SDK to call the Gemini API.
*   **AI Integration:**
    *   **Level 1 (Analysis):** User-managed.
    *   **Level 2 (Modification):**
        *   Client-side direct calls if user API key provided.
        *   Via the backend proxy (default) if no user API key provided.
*   **Environment Variables (for Deployers on Vercel - for Backend Proxy Mode):**
    *   `GEMINI_API_KEY`: (Required for Backend Proxy L2 AI) Your Google Gemini API Key.
    *   `GEMINI_API_URL`: (Optional for Backend Proxy L2 AI) A custom API endpoint for Gemini. If not set, defaults to Google's production endpoint.
    *   These are set in Vercel project settings for the serverless functions, **NOT prefixed with `VITE_`**. The backend proxy (`api/gemini.ts`) reads these via `process.env`.
*   **Bundling/Serving:** Client-side with ES Modules/Vite. Serverless functions handled by Vercel.

## How to Run (Local Development)

**Using Vite & Vercel CLI (Recommended for Full Functionality, including Backend Proxy)**
1.  Install Node.js.
2.  Install Vercel CLI: `npm install -g vercel`.
3.  Run `npm install` (if a `package.json` with dependencies like `react`, `tailwindcss` is present, or install them manually).
4.  **Local Environment Variables (for Backend Proxy):**
    *   Create a `.env.local` file in the project root (this file is usually gitignored).
    *   To test the backend proxy mode, add the deployer's Gemini API key and optionally URL:
        *   `GEMINI_API_KEY=your_actual_gemini_api_key_for_proxy`
        *   `GEMINI_API_URL=your_optional_custom_api_url_for_proxy` (If not set, defaults to Google's endpoint)
    *   The Vercel CLI (`vercel dev`) will pick up these variables for the local serverless function environment.
5.  Run `vercel dev` in the project directory. This will serve the frontend and run the `api/gemini.ts` function locally.
6.  Access the URL provided by `vercel dev` (e.g., `http://localhost:3000`).
7.  In the app's settings panel, you can leave "Your Gemini API Key" blank to test the proxy, or fill it in to test direct client-side calls.

**Simpler Frontend-Only Serving (Backend Proxy will not work)**
1.  Serve frontend files with Vite: `npm install -g vite` then `vite`.
2.  If you don't provide "Your Gemini API Key" in settings, L2 AI calls will fail as they would attempt to reach `/api/gemini` which isn't running in this mode. You must provide your own key for client-side calls.

## Deployment

### Vercel (Recommended for Backend Proxy Functionality)

1.  **Push to Git.**
2.  **Import to Vercel.**
    *   **Framework Preset:** Select "Vite" (or "Other" and configure build command `vite build`).
    *   **Output Directory:** Vercel usually detects this for Vite (`dist`).
    *   Vercel will automatically detect and deploy the serverless function in the `api` directory.
3.  **Configure Environment Variables on Vercel (for Backend Proxy):**
    *   In Vercel project settings -> "Environment Variables".
    *   Add your **server-side** Gemini API key and optional URL for the proxy:
        *   Name: `GEMINI_API_KEY`, Value: Your_Actual_Google_Gemini_API_Key_For_Proxy_Mode
        *   Name: `GEMINI_API_URL`, Value: Your_Optional_Custom_API_URL_For_Proxy (If not set, uses Google's default)
    *   **Do NOT prefix with `VITE_`**, as these keys are for the backend proxy.
4.  **Deploy.**
5.  End-users of your deployed app can optionally use their own API key via the settings panel for client-side calls.

## Important Considerations

*   **API Key Security:**
    *   **Backend Proxy Mode:** The deployer's `GEMINI_API_KEY` (and `GEMINI_API_URL`) are securely stored as server-side environment variables on Vercel.
    *   **Client-Side Mode:** If a user enters their API key in the settings, that key is used in their browser and is subject to client-side exposure risks for that user's session. Users should be aware of this if they use their own keys.
*   **Level 1 AI Output Format:** Strict adherence is crucial.
*   **In-Memory Operations:** Refreshing clears data.
*   **Proxy Function:** The `/api/gemini` function is essential for the default L2 AI mode.

## Future Enhancements (Potential Ideas)

*   Save/Download project.
*   Git integration.
*   Diff visualization.
*   Authentication/Authorization for the proxy endpoint if the app is public.