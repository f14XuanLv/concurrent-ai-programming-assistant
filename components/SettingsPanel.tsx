
import React from 'react';

interface SettingsPanelProps {
  geminiModelName: string;
  setGeminiModelName: (modelName: string) => void;
  ignoredFolders: string;
  setIgnoredFolders: (folders: string) => void;
  userApiKey: string;
  setUserApiKey: (key: string) => void;
  userApiUrl: string;
  setUserApiUrl: (url: string) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  geminiModelName, setGeminiModelName,
  ignoredFolders, setIgnoredFolders,
  userApiKey, setUserApiKey,
  userApiUrl, setUserApiUrl,
}) => {
  return (
    <div className="p-4 bg-gray-800 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4 text-sky-400">AI Settings</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="userApiKey" className="block text-sm font-medium text-gray-300 mb-1">
            Your Gemini API Key (Optional for L2 AI)
          </label>
          <input
            type="password"
            id="userApiKey"
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-sky-500 focus:border-sky-500 text-gray-100"
            value={userApiKey}
            onChange={(e) => setUserApiKey(e.target.value)}
            placeholder="Enter your API key to use client-side calls"
          />
          <p className="text-xs text-gray-400 mt-1">If provided, L2 AI calls will be made directly from your browser. Otherwise, a backend proxy (if configured by deployer) will be used.</p>
        </div>
        <div>
          <label htmlFor="userApiUrl" className="block text-sm font-medium text-gray-300 mb-1">
            Your Gemini API URL (Optional for L2 AI)
          </label>
          <input
            type="text"
            id="userApiUrl"
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-sky-500 focus:border-sky-500 text-gray-100"
            value={userApiUrl}
            onChange={(e) => setUserApiUrl(e.target.value)}
            placeholder="e.g., https://generativelanguage.googleapis.com"
            disabled={!userApiKey} // Only enable if userApiKey is being entered
          />
           <p className="text-xs text-gray-400 mt-1">Default: https://generativelanguage.googleapis.com. Relevant if providing your API key.</p>
        </div>
        <div>
          <label htmlFor="geminiModelName" className="block text-sm font-medium text-gray-300 mb-1">
            Gemini Model Name (for Level 2 AI)
          </label>
          <input
            type="text"
            id="geminiModelName"
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-sky-500 focus:border-sky-500 text-gray-100"
            value={geminiModelName}
            onChange={(e) => setGeminiModelName(e.target.value)}
            placeholder="e.g., gemini-2.5-flash-preview-04-17"
          />
           <p className="text-xs text-gray-400 mt-1">This model will be used for L2 AI calls (either client-side or via backend proxy).</p>
        </div>
        <div>
          <label htmlFor="ignoredFolders" className="block text-sm font-medium text-gray-300 mb-1">
            Ignored Folders (comma-separated)
          </label>
          <input
            type="text"
            id="ignoredFolders"
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-sky-500 focus:border-sky-500 text-gray-100"
            value={ignoredFolders}
            onChange={(e) => setIgnoredFolders(e.target.value)}
            placeholder="e.g., .git,node_modules,dist"
          />
           <p className="text-xs text-gray-400 mt-1">These folders will be collapsed by default in the tree, excluded from L1 AI prompt, and L2 modifications within them will be skipped.</p>
        </div>
      </div>
    </div>
  );
};