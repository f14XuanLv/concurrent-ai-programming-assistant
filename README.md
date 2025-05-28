
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
        2.  If user field is empty, a deployer-provided key (attempted via `process.env.API_KEY`, e.g., from Vercel environment variable `API_KEY`) is used. *Note: See "Important Considerations" regarding client-side `process.env` access on Vercel for static sites.*
        3.  If neither is available, the user is prompted upon execution.
    *   **API URL:**
        1.  A deployer-provided URL (attempted via `process.env.API_URL`, e.g., from Vercel environment variable `API_URL`) takes highest priority. If detected and used, the API URL input in Settings is hidden. *Note: See "Important Considerations" regarding client-side `process.env` access.*
        2.  If no deployer URL is detected, the user can enter a custom URL in Settings.
        3.  If neither of the above, defaults to `https://generativelanguage.googleapis.com`.
        4.  **Note:** The `@google/genai` SDK primarily uses standard Google API endpoints. Custom API URLs might have limited or no effect on where the SDK sends requests.
    *   **Gemini Model Name:** Specify the Gemini model for Level 2 AI (defaults to `gemini-2.5-flash-preview-05-20`).
    *   **Ignored Folders:** Specify folders to exclude from L1 prompt, collapse in tree, and skip for L2 modifications.
*   **Real-time Status Bar:** Provides feedback on current operations, progress, and errors.
*   **Path Auto-Correction:** Attempts to correct file paths from L1 AI output.

## Workflow

1.  **Setup API Configuration (Settings Panel):**
    *   **Gemini API Key:** You can enter your API key here. If you leave this blank, the application will attempt to use an API key provided by the deployer (if configured via an `API_KEY` environment variable and accessible to the client-side - see "Deployment to Vercel" notes).
    *   **Gemini API URL:**
        *   If the deployer has configured an `API_URL` environment variable (and it's accessible client-side), this field may be hidden, and the deployer's URL will be used.
        *   Otherwise, this field is visible. You can enter your own API URL, or leave it blank to use the default.
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
    *   **Level 2 (Modification):** Google Gemini API via `@google/genai` SDK. Model configurable (defaults to `gemini-2.5-flash-preview-05-20`).
*   **Environment Variables (for Deployers - see Vercel notes for client-side access):**
    *   `API_KEY`: Deployer can set a global API key.
    *   `API_URL`: Deployer can set a global API URL (but see SDK note above).
*   **Core Logic:** In-memory file system, structured text parsing, concurrent API calls.
*   **Bundling/Serving:** ES Modules via import map.

## How to Run (Local Development)

**Option 1: Simple HTTP Server (Matches Current Setup)**
1.  **Prerequisites:** A modern web browser.
2.  **Serve Files:** Use any local HTTP server from the project's root directory.
    *   Example with Node.js: `npx serve .`
    *   Example with Python 3: `python -m http.server`
    *   Using an extension like VS Code's "Live Server".
3.  **Access:** Open the local URL (e.g., `http://localhost:3000` or `http://localhost:8000`).
4.  **API Config:** Configure API settings in the app's Settings Panel. `process.env` variables for `API_KEY` or `API_URL` will generally not be populated by simple HTTP servers; rely on user input in the app.

**Option 2: Using Vite (Recommended for Enhanced Development)**
Vite can provide a more robust development experience with features like Hot Module Replacement (HMR) and optimized builds.
1.  **Prerequisites:** Node.js and npm/yarn/pnpm installed.
2.  **Install & Run Vite:**
    *   If you don't have Vite installed globally: `npm install -g vite` (or use `npx vite`).
    *   Navigate to the project directory in your terminal.
    *   Run `vite`.
    *   Vite will serve `index.html` and handle dependencies.
3.  **Environment Variables with Vite:**
    *   Vite uses `.env` files for managing environment variables locally. Create a file named `.env` in the project root.
    *   Variables intended to be exposed on the client-side **must** be prefixed with `VITE_`. For example:
        ```env
        VITE_API_KEY=your_gemini_api_key_for_local_dev
        VITE_API_URL=your_optional_api_url_for_local_dev
        ```
    *   To use these variables in your application code, you would access them via `import.meta.env.VITE_API_KEY` and `import.meta.env.VITE_API_URL`. This means you would need to modify `App.tsx` where `DEPLOYER_API_KEY` and `DEPLOYER_API_URL` are defined, changing from `process.env.API_KEY` to `import.meta.env.VITE_API_KEY` (and similarly for the URL) if you want Vite to manage these for local development.
4.  **Access:** Vite will provide a local URL, typically `http://localhost:5173`.
5.  **API Configuration (Settings Panel):** If not using Vite's environment variables, or if they are not set up, you can still configure the API key and URL through the app's Settings Panel.

## Deployment

### Vercel (Recommended)

This application can be easily deployed as a static site on Vercel.

1.  **Push to Git:** Ensure your project is a Git repository and pushed to a provider like GitHub, GitLab, or Bitbucket.
2.  **Import to Vercel:**
    *   Sign up or log in to [Vercel](https://vercel.com).
    *   Click "Add New..." -> "Project".
    *   Import your Git repository.
    *   Vercel typically auto-detects static sites. For this project's simple HTML/JS/CSS structure:
        *   **Framework Preset:** Select "Other".
        *   **Build Command:** Leave empty (since no build step is currently integrated for Vercel).
        *   **Output Directory:** Not applicable if no build step.
        *   **Install Command:** Can be left empty.
3.  **Configure Environment Variables on Vercel:**
    *   In your Vercel project dashboard, go to "Settings" -> "Environment Variables".
    *   Add the following variables (these are the names the application *attempts* to read via `process.env`):
        *   `API_KEY`: Your Google Gemini API Key.
        *   `API_URL`: (Optional) Your custom API URL/proxy for Gemini.
    *   **Crucial Note on Client-Side Access for Static Deployments:**
        *   When deploying this application as a simple static site on Vercel (i.e., Vercel just serves your existing HTML/JS files without a Vercel-integrated build step like Vite or Next.js), the environment variables (`API_KEY`, `API_URL`) you set in the Vercel UI are **NOT automatically available** in your client-side JavaScript as `process.env.API_KEY` or `process.env.API_URL`.
        *   As a result, the application's attempt to read these (e.g., `const DEPLOYER_API_KEY = process.env.API_KEY;`) will likely find them `undefined` in the browser.
        *   **The application will then gracefully fall back** to requiring the user to enter the API key and URL (if applicable) in the Settings Panel.
        *   To make these variables reliably available to the client-side code directly from Vercel's environment settings:
            *   **Recommended Solution (Integrate Vite with Vercel Build):**
                1.  Set Vercel's Build Command to `vite build` (assuming you have Vite set up in your project).
                2.  In Vercel, define your environment variables with the `VITE_` prefix (e.g., `VITE_API_KEY`, `VITE_API_URL`).
                3.  Modify `App.tsx` to read these as `import.meta.env.VITE_API_KEY` and `import.meta.env.VITE_API_URL`. Vite will handle embedding these during the build process that Vercel runs.
4.  **Deploy:** Click the "Deploy" button.

## Important Considerations

*   **API Key Security:** User-entered keys are stored in browser state during the session. For deployer keys (via environment variables like `API_KEY` on Vercel):
    *   Their secure exposure and accessibility to the client-side depend heavily on the deployment platform and build tooling.
    *   **For the current static Vercel setup (no Vite build step in Vercel):** `API_KEY` set in Vercel UI will NOT be directly readable by the client-side `process.env`. The app relies on user input as a fallback.
    *   **With Vite integrated into Vercel's build:** `VITE_API_KEY` set in Vercel UI would be securely embedded by Vite during the build.
*   **Level 1 AI Output Format:** Strict adherence to the output format by the Level 1 AI is crucial.
*   **CORS Issues & SDK:** The `@google/genai` SDK handles communication with Google's servers.
*   **In-Memory Operations:** All changes are in-memory. Refreshing the page will clear uploaded files and changes.
*   **Environment Variable Precedence:** The app prioritizes user-inputted API keys. If empty, it tries to use deployer-set keys (which, as noted, might not be available client-side in a simple static deployment).

## Future Enhancements (Potential Ideas)

*   Save/Download project.
*   Git integration.
*   Diff visualization.
*   User-configurable Level 2 prompt templates.
