
import React from 'react';

interface SettingsPanelProps {
  apiKey: string;
  setApiKey: (key: string) => void;
  apiUrl: string;
  setApiUrl: (url: string) => void;
  geminiModelName: string;
  setGeminiModelName: (modelName: string) => void;
  ignoredFolders: string;
  setIgnoredFolders: (folders: string) => void;
  showApiUrlInput: boolean; // New prop to control API URL input visibility
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  apiKey, setApiKey, 
  apiUrl, setApiUrl,
  geminiModelName, setGeminiModelName,
  ignoredFolders, setIgnoredFolders,
  showApiUrlInput 
}) => {
  return (
    <div className="p-4 bg-gray-800 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4 text-sky-400">API Settings</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300 mb-1">
            Your Gemini API Key
          </label>
          <input
            type="password"
            id="apiKey"
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-sky-500 focus:border-sky-500 text-gray-100"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your API Key (optional, uses deployer's if set)"
            autoComplete="new-password"
          />
           <p className="text-xs text-gray-400 mt-1">If empty, uses deployer-provided key (if available).</p>
        </div>

        {showApiUrlInput && (
          <div>
            <label htmlFor="apiUrl" className="block text-sm font-medium text-gray-300 mb-1">
              Your Gemini API URL
            </label>
            <input
              type="text"
              id="apiUrl"
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-sky-500 focus:border-sky-500 text-gray-100"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="Defaults to Google's endpoint if empty"
            />
            <p className="text-xs text-gray-400 mt-1">Overrides default. (Note: SDK primarily uses standard Google endpoints).</p>
          </div>
        )}
        
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
