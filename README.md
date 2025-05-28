
# Concurrent AI Programming Assistant

## Background

Large Language Models (LLMs) like Gemini and Claude are increasingly used to assist developers in modifying code. However, a common bottleneck is that these models typically process modification requests for one file or a set of files serially. Even if a single prompt requests changes to multiple files, the developer often waits for the AI to complete all modifications before seeing results. This can lead to significant waiting times and reduced efficiency.

The **Concurrent AI Programming Assistant** is a web-based IDE designed to address this challenge. It employs a two-tier AI strategy:

1.  **Level 1 AI (Global Analysis - Manual Step):** A powerful AI (e.g., Claude-4-opus or a capable Gemini model) is used by the user to perform a global analysis of the codebase. The user provides the AI with the project structure, relevant file contents, and their high-level requirements. The AI's role is to identify all necessary modifications across multiple files and output these instructions in a specific, structured format, including a suggested number of concurrent operations.
2.  **Level 2 AI (File-Specific Execution - Automated by this App):** The user pastes the structured output from the Level 1 AI into this application. The application then parses these instructions and makes concurrent API calls to a specified Gemini model (e.g., `gemini-2.5-flash-preview-05-20` by default, configurable by the user) to execute the specific code modifications for each file in parallel.

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
    *   Makes parallel API calls to the configured Gemini model based on the parsed instructions and suggested thread count.
*   **In-Memory File Updates:** Applies the modifications received from the Level 2 AI to the in-browser representation of your files.
*   **Configurable Settings:**
    *   **API Key:** For authenticating with the Gemini API.
    *   **API URL:** Customizable endpoint, typically a proxy for the Gemini API.
    *   **Gemini Model Name:** Specify the Gemini model to be used for Level 2 AI modifications (defaults to `gemini-2.5-flash-preview-05-20`).
    *   **Ignored Folders:** Specify folders (e.g., `.git`, `node_modules`, `dist`) to:
        *   Exclude from the Level 1 AI prompt content.
        *   Display as collapsed by default in the file tree.
        *   Skip during Level 2 AI modification processing.
*   **Real-time Status Bar:** Provides feedback on current operations, progress, and errors.
*   **Path Auto-Correction:** Attempts to correct file paths from L1 AI output if they don't include the root project folder name.

## Workflow

1.  **Setup API Configuration (Settings Panel):**
    *   Enter your **Gemini API Key**.
    *   Enter the **Gemini API URL** (this is typically a proxy URL, e.g., `https://api-proxy.me/gemini`).
    *   Optionally, set the **Gemini Model Name** if you want to use a model different from the default (`gemini-2.5-flash-preview-05-20`).
    *   Optionally, customize the list of **Ignored Folders** (comma-separated, e.g., `.git,node_modules`).
2.  **Upload Project:**
    *   Click the "Upload Project Folder" button.
    *   Select the root folder of the project you want to modify. The application will read the files and build a file tree.
3.  **Prepare Level 1 AI Prompt (Level 1 Panel - Step 1):**
    *   In the "Your Requirements" textarea, describe the high-level changes you want the AI to make (e.g., "Refactor all API call functions to use async/await," "Change the primary color theme to dark blue").
    *   Click the "Prepare/Refresh L1 Prompt Template" button.
    *   The large textarea below will be populated with a structured prompt. This prompt includes the project structure, a list of relevant files, your requirements, and detailed instructions on the expected output format for the Level 1 AI.
    *   Review this generated prompt. You can edit it further if needed.
4.  **Use External Level 1 AI (Manual Step):**
    *   Click the "Copy L1 Prompt" button.
    *   Paste this copied prompt into your chosen powerful LLM (e.g., Claude, a highly capable Gemini interface).
    *   Obtain the structured response from this AI. **It is crucial that the AI adheres strictly to the output format specified in the prompt.**
5.  **Process Level 1 AI Output (Level 1 Panel - Step 2):**
    *   Paste the entire structured output you received from your Level 1 AI into the "Paste Level 1 AI Output Here" textarea.
    *   Click the "Execute Modifications (Calls Level 2 AI)" button.
6.  **Concurrent Execution & File Updates:**
    *   The application will:
        *   Parse the Level 1 AI's output.
        *   Identify the suggested number of concurrent threads.
        *   For each file modification instruction:
            *   Construct a specific prompt for the Level 2 Gemini API (using the configured model name).
            *   Call the Gemini API concurrently for all files.
        *   Receive the modified code from Gemini.
        *   Update the corresponding files in its in-memory representation of your project.
7.  **Review Changes:**
    *   The file tree and editor panel will reflect the modified files.
    *   If a file is modified or deleted, its content in the editor panel will update if it's currently selected.
    *   **Note:** Currently, all changes are in-memory. This tool does not automatically save changes back to your local file system.

## Technical Details

*   **Frontend:** React (v19) with TypeScript, styled using Tailwind CSS.
*   **AI Integration:**
    *   **Level 1 (Analysis):** User-managed. The application helps generate the prompt, but the user interacts with their chosen LLM externally.
    *   **Level 2 (Modification):** Google Gemini API. The specific model is configurable by the user (defaults to `gemini-2.5-flash-preview-05-20`). Calls are made via `fetch` to a user-configured (proxy) URL.
*   **Core Logic:**
    *   In-memory file system representation.
    *   Parsing of structured text outputs from both AI levels.
    *   Concurrent API request management using `Promise.all` with batching for controlled concurrency.
*   **Bundling/Serving:** Uses ES Modules directly imported in `index.html` via an import map, suitable for modern browsers and simple local server setups.

## Key Files & Structure

*   `index.html`: Main HTML entry point, includes Tailwind CSS CDN and import map.
*   `index.tsx`: React application root initialization.
*   `App.tsx`: The main application component, handles state management, core workflow logic, and interactions between different panels.
*   **`components/`**: Contains all React UI components:
    *   `SettingsPanel.tsx`: For API key, URL, Gemini Model Name, and ignored folders configuration.
    *   `FileTreePanel.tsx`: Displays the project's file and folder structure.
    *   `EditorPanel.tsx`: Shows the content of the selected file (text or image).
    *   `Level1Panel.tsx`: Manages the two-step AI interaction workflow.
    *   `StatusBar.tsx`: Displays the current application status and messages.
    *   `Button.tsx`: A generic button component.
*   **`services/`**:
    *   `fileParserService.ts`: Logic for parsing the structured text output from Level 1 AI and Level 2 AI.
    *   `geminiService.ts`: Handles constructing prompts for and calling the Level 2 Gemini API.
*   `types.ts`: TypeScript type definitions used throughout the application.
*   `constants.tsx`: Application-wide constants, including API defaults (like the default Gemini model name), prompt templates, and SVG icons.

## How to Run

1.  **Prerequisites:** A modern web browser that supports ES Modules and `fetch`.
2.  **Serving the Files:**
    *   Since the application uses ES modules, you need to serve the files via a local HTTP server.
    *   You can use simple tools like:
        *   `npx serve .` (if you have Node.js/npm installed)
        *   Python's `python -m http.server` (for Python 3)
        *   VS Code's "Live Server" extension.
    *   Serve from the root directory where `index.html` is located.
3.  **Access the Application:** Open your web browser and navigate to the local address provided by your HTTP server (e.g., `http://localhost:3000` or `http://localhost:8000`).
4.  **API Configuration:**
    *   Upon loading, go to the **Settings Panel**.
    *   Enter a valid **Gemini API Key**. The default key is a placeholder and will not work.
    *   The **Gemini API URL** defaults to `https://api-proxy.me/gemini`. You may need to adjust this if you use a different proxy or if the Gemini API endpoint structure changes. Direct browser calls to the Gemini API are often blocked by CORS, making a proxy necessary.
    *   The **Gemini Model Name** defaults to `gemini-2.5-flash-preview-05-20`. You can change this if you prefer to use a different model for Level 2 AI modifications.

## Important Considerations

*   **API Key Security:** The API key is entered by the user and stored in the browser's component state. For local development and personal use, this is convenient. In any broader or shared deployment, API keys should be handled with much greater care (e.g., server-side proxy that injects the key).
*   **Level 1 AI Output Format:** The tool's ability to process modifications correctly is **highly dependent** on the Level 1 AI strictly adhering to the specified output format. Any deviation can lead to parsing errors.
*   **Gemini API Proxy:** The application is designed to work with a proxy for the Gemini API to avoid CORS issues. Ensure your proxy is correctly configured and accessible.
*   **In-Memory Operations:** All file uploads and modifications are currently handled in-memory within the browser session. Refreshing the page will clear the state. There is no built-in feature to save modified files back to the local disk.
*   **Error Handling:** Basic error handling is implemented, with messages displayed in the status bar and more detailed errors logged to the browser console.
*   **Experimental Nature:** This is a prototype demonstrating a concept. While functional for its described workflow, it may have limitations or bugs.

## Future Enhancements (Potential Ideas)

*   Direct "Save to Disk" or "Download Project" functionality.
*   Integration with Git for version control.
*   More sophisticated error recovery and retry mechanisms for API calls.
*   Support for other Level 2 AI models.
*   UI for visualizing diffs before applying changes.
*   Streaming responses from Level 2 AI for faster feedback.
*   User-configurable Level 2 prompt templates.
