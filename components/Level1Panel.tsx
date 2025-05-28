
import React, { useState, useCallback } from 'react';
import { Button } from './Button';
import { LEVEL_1_PROMPT_TEMPLATE, LEVEL_1_PROMPT_TEMPLATE_PLACEHOLDERS } from '../constants';
import { AppStatus } from '../types';

interface Level1PanelProps {
  onPrepareL1Prompt: () => string;
  onProcessL1Output: (output: string) => void;
  currentStatus: AppStatus;
}

export const Level1Panel: React.FC<Level1PanelProps> = ({ onPrepareL1Prompt, onProcessL1Output, currentStatus }) => {
  const [l1Prompt, setL1Prompt] = useState<string>(LEVEL_1_PROMPT_TEMPLATE.replace(LEVEL_1_PROMPT_TEMPLATE_PLACEHOLDERS.USER_REQUIREMENTS, ''));
  const [l1Output, setL1Output] = useState<string>('');
  const [userRequirements, setUserRequirements] = useState<string>('');

  const handlePreparePrompt = useCallback(() => {
    const generatedPart = onPrepareL1Prompt(); 

    let projectStructureForTemplate = "";
    let fileListForTemplate = "";

    if (generatedPart) {
        const parts = generatedPart.split('=====UPLOADED-FILES=====');
        projectStructureForTemplate = (parts[0] || "") 
            .replace('=====PROJECT-STRUCTURE=====', '')
            .replace('=====END-PROJECT-STRUCTURE=====', '')
            .trim();
        fileListForTemplate = (parts[1] || "") 
            .replace('=====END-UPLOADED-FILES=====', '')
            .trim();
    }

    let fullPrompt = LEVEL_1_PROMPT_TEMPLATE;
    fullPrompt = fullPrompt.replace(LEVEL_1_PROMPT_TEMPLATE_PLACEHOLDERS.FILE_TREE, projectStructureForTemplate);
    fullPrompt = fullPrompt.replace(LEVEL_1_PROMPT_TEMPLATE_PLACEHOLDERS.UPLOADED_FILES_LIST, fileListForTemplate);
    fullPrompt = fullPrompt.replace(LEVEL_1_PROMPT_TEMPLATE_PLACEHOLDERS.USER_REQUIREMENTS, userRequirements.trim());
    setL1Prompt(fullPrompt);
  }, [onPrepareL1Prompt, userRequirements]);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(l1Prompt)
      .then(() => alert('Level 1 Prompt copied to clipboard!'))
      .catch(err => alert('Failed to copy prompt: ' + err));
  };

  const handleExecute = () => {
    // API key check (user-entered or deployer-provided) is now handled in App.tsx before calling onProcessL1Output
    if (l1Output.trim()) {
      onProcessL1Output(l1Output);
    } else {
      alert('Please paste Level 1 AI output before executing.');
    }
  };

  const isLoading = currentStatus === AppStatus.PROCESSING_L1_OUTPUT || currentStatus === AppStatus.CALLING_L2_AI || currentStatus === AppStatus.UPDATING_FILES;

  return (
    <div className="p-4 bg-gray-800 rounded-lg shadow space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2 text-sky-400">Step 1: Generate & Edit Level 1 AI Prompt</h3>
        <p className="text-sm text-gray-400 mb-2">Describe your high-level requirements. The system will help populate project structure and file list.</p>
        <label htmlFor="userRequirements" className="block text-sm font-medium text-gray-300 mb-1">
          Your Requirements:
        </label>
        <textarea
          id="userRequirements"
          rows={3}
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-sky-500 focus:border-sky-500 text-gray-100 placeholder-gray-500"
          placeholder="e.g., Refactor all components to use TypeScript, update branding to blue theme..."
          value={userRequirements}
          onChange={(e) => setUserRequirements(e.target.value)}
          disabled={isLoading}
        />
        <div className="mt-2 flex space-x-2">
          <Button onClick={handlePreparePrompt} disabled={isLoading || !onPrepareL1Prompt} variant="secondary">
            Prepare/Refresh L1 Prompt Template
          </Button>
        </div>
        <label htmlFor="l1Prompt" className="block text-sm font-medium text-gray-300 mt-4 mb-1">
          Level 1 Prompt (Edit if needed, then copy for your primary AI):
        </label>
        <textarea
          id="l1Prompt"
          rows={10}
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-sky-500 focus:border-sky-500 text-gray-100 font-mono text-xs"
          value={l1Prompt}
          onChange={(e) => setL1Prompt(e.target.value)}
          readOnly={isLoading}
        />
        <div className="mt-2 flex space-x-2">
          <Button onClick={handleCopyPrompt} disabled={isLoading || !l1Prompt}>Copy L1 Prompt</Button>
        </div>
         <p className="text-xs text-gray-500 mt-1">Manually provide this prompt to your chosen high-level AI (e.g., Claude or a capable Gemini model).</p>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2 text-sky-400">Step 2: Process Level 1 AI Output</h3>
         <p className="text-sm text-gray-400 mb-2">Paste the structured output from your primary AI below.</p>
        <label htmlFor="l1Output" className="block text-sm font-medium text-gray-300 mb-1">
          Paste Level 1 AI Output Here:
        </label>
        <textarea
          id="l1Output"
          rows={10}
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-sky-500 focus:border-sky-500 text-gray-100 font-mono text-xs"
          placeholder="THREAD_COUNT: ... FILE_MODIFICATIONS_START ... FILE: ... FILE_END ... FILE_MODIFICATIONS_END"
          value={l1Output}
          onChange={(e) => setL1Output(e.target.value)}
          disabled={isLoading}
        />
        <div className="mt-2">
          <Button onClick={handleExecute} isLoading={isLoading} disabled={isLoading || !l1Output.trim()}>
            Execute Modifications (Calls Level 2 AI)
          </Button>
        </div>
      </div>
    </div>
  );
};
