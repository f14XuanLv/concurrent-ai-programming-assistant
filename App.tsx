
import React, { useState, useCallback, useEffect, ChangeEvent, RefObject, useMemo, useRef } from 'react';
import { FileTreeNode, ParsedModificationInstruction, Level1Output, AppStatus, OperationType, UploadedFileData } from './types';
import { DEFAULT_API_KEY, DEFAULT_API_URL, DEFAULT_GEMINI_MODEL_NAME } from './constants';
import { SettingsPanel } from './components/SettingsPanel';
import { FileTreePanel } from './components/FileTreePanel';
import { EditorPanel } from './components/EditorPanel';
import { Level1Panel } from './components/Level1Panel';
import { StatusBar } from './components/StatusBar';
import { Button } from './components/Button';
import { parseLevel1Output, parseLevel2Output } from './services/fileParserService';
import { callGeminiApi } from './services/geminiService';

// Attempt to read deployer-configured environment variables.
// For Vercel deployments using Vite (as indicated by `vite build` in logs):
// 1. Environment variables MUST be prefixed with `VITE_` in Vercel UI (e.g., VITE_API_KEY).
// 2. Vite exposes these client-side via `import.meta.env.VITE_YOUR_VARIABLE`.
const VITE_DEPLOYER_API_KEY = (
    typeof import.meta !== 'undefined' && // Check if import.meta exists
    (import.meta as any).env && // Check if .env exists on it (as any)
    (import.meta as any).env.VITE_API_KEY // Check if .VITE_API_KEY exists on .env
) ? String(((import.meta as any).env).VITE_API_KEY) : "";

const VITE_DEPLOYER_API_URL = (
    typeof import.meta !== 'undefined' &&
    (import.meta as any).env &&
    (import.meta as any).env.VITE_API_URL
) ? String(((import.meta as any).env).VITE_API_URL) : "";


// Fallback for other environments or if VITE_ vars are not set (less common for client-side Vercel/Vite).
// `process.env.API_KEY` is generally not populated client-side by Vite builds from Vercel dashboard variables.
const LEGACY_DEPLOYER_API_KEY = (typeof process !== 'undefined' && process.env && process.env.API_KEY) ? process.env.API_KEY : "";
const LEGACY_DEPLOYER_API_URL = (typeof process !== 'undefined' && process.env && process.env.API_URL) ? process.env.API_URL : "";

// Prioritize Vite's environment variables, then legacy, then empty.
const DEPLOYER_API_KEY = VITE_DEPLOYER_API_KEY || LEGACY_DEPLOYER_API_KEY;
const DEPLOYER_API_URL = VITE_DEPLOYER_API_URL || LEGACY_DEPLOYER_API_URL;


// Helper to build file tree
const buildFileTreeStructure = (filesData: Record<string, UploadedFileData>): FileTreeNode[] => {
  const rootNodes: FileTreeNode[] = [];
  const nodeMap: Record<string, FileTreeNode> = {};

  Object.keys(filesData).sort().forEach(fullPath => {
    const parts = fullPath.split('/');
    let currentPath = '';
    parts.forEach((part, index) => {
      const oldCurrentPath = currentPath;
      currentPath += (currentPath ? '/' : '') + part;
      if (!nodeMap[currentPath]) {
        const isDir = index < parts.length - 1;
        const fileData = filesData[fullPath];
        nodeMap[currentPath] = {
          id: currentPath,
          name: part,
          path: currentPath,
          type: isDir ? 'directory' : 'file',
          children: isDir ? [] : undefined,
          content: isDir ? undefined : fileData?.content,
          mimeType: isDir ? undefined : fileData?.mimeType,
        };
        if (index === 0) {
          if (!rootNodes.find(n => n.id === currentPath)) rootNodes.push(nodeMap[currentPath]);
        } else {
          if (nodeMap[oldCurrentPath] && nodeMap[oldCurrentPath].type === 'directory') {
             if (!nodeMap[oldCurrentPath].children!.find(n => n.id === currentPath)) {
                nodeMap[oldCurrentPath].children!.push(nodeMap[currentPath]);
             }
          }
        }
      }
    });
  });
  return rootNodes;
};


// Helper for concurrent processing with batching
async function processInBatches<T, R,>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<R>,
  onProgress?: (completed: number, total: number) => void
): Promise<R[]> {
  const allResults: R[] = [];
  let completedCount = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchPromises = batch.map(processor);
    try {
      const batchResults = await Promise.all(batchPromises);
      allResults.push(...batchResults);
      completedCount += batch.length;
      if (onProgress) onProgress(completedCount, items.length);
    } catch (error) {
        console.error("Error processing batch: ", error);
        throw error;
    }
  }
  return allResults;
}

const MIN_PANE_WIDTH_PERCENT = 10; // Minimum 10% width for each pane

const App: React.FC = () => {
  // State for user-provided API configurations
  const [userApiKey, setUserApiKey] = useState<string>(DEFAULT_API_KEY); // Defaults to ""
  const [userApiUrl, setUserApiUrl] = useState<string>(DEFAULT_API_URL); // Defaults to Google's endpoint

  const [geminiModelName, setGeminiModelName] = useState<string>(DEFAULT_GEMINI_MODEL_NAME);
  const [ignoredFoldersInput, setIgnoredFoldersInput] = useState<string>('.git,node_modules,dist,build');

  const ignoredFoldersArray = useMemo(() => {
    return ignoredFoldersInput.split(',').map(f => f.trim()).filter(f => f);
  }, [ignoredFoldersInput]);

  const [uploadedFilesData, setUploadedFilesData] = useState<Record<string, UploadedFileData>>({});
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
  const [selectedFileMimeType, setSelectedFileMimeType] = useState<string | null>(null);

  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [paneWidths, setPaneWidths] = useState({ left: 25, middle: 50, right: 25 });
  const [draggingDivider, setDraggingDivider] = useState<null | 'left-middle' | 'middle-right'>(null);
  const dragStartRef = useRef({ x: 0, leftWidth: 0, middleWidth: 0, rightWidth: 0 });
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Function to determine the effective API key and URL
  const getEffectiveConfig = useCallback(() => {
    // User-entered API key takes highest priority.
    // Then, DEPLOYER_API_KEY (which now correctly checks VITE_API_KEY first).
    const effectiveApiKey = userApiKey.trim() || DEPLOYER_API_KEY;

    let effectiveApiUrl = DEFAULT_API_URL; // Start with the hardcoded default

    // For API URL:
    // 1. DEPLOYER_API_URL (which now checks VITE_API_URL first) takes highest precedence.
    // 2. If DEPLOYER_API_URL is empty, user-entered URL is used.
    // 3. If both are empty, hardcoded DEFAULT_API_URL is used.
    if (DEPLOYER_API_URL) {
        effectiveApiUrl = DEPLOYER_API_URL;
    } else if (userApiUrl.trim()) {
        effectiveApiUrl = userApiUrl.trim();
    }

    return { effectiveApiKey, effectiveApiUrl };
  }, [userApiKey, userApiUrl]);


  useEffect(() => {
    if (Object.keys(uploadedFilesData).length > 0) {
      setStatus(AppStatus.GENERATING_TREE);
      const tree = buildFileTreeStructure(uploadedFilesData);
      setFileTree(tree);
      setStatus(AppStatus.AWAITING_L1_OUTPUT);
      setStatusMessage('Project loaded. Ready for Level 1 AI output or prepare new L1 prompt.');
    } else {
      setFileTree([]);
      setStatus(AppStatus.IDLE);
      setSelectedFilePath(null);
      setSelectedFileContent(null);
      setSelectedFileMimeType(null);
      setStatusMessage('Upload a project folder to begin.');
    }
  }, [uploadedFilesData]);

  const handleFolderUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setStatus(AppStatus.UPLOADING);
    setStatusMessage(`Reading ${files.length} files...`);
    const newFilesData: Record<string, UploadedFileData> = {};

    const fileReadPromises = Array.from(files).map(file => {
      return new Promise<{ path: string; content: string, mimeType: string }>((resolve, reject) => {
        const path = (file as any).webkitRelativePath || file.name;
        const mimeType = file.type || 'application/octet-stream';

        if (!path) {
          console.warn("File without path found, skipping:", file.name);
          resolve({path: '', content: '', mimeType: ''});
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => resolve({ path, content: e.target?.result as string, mimeType });
        reader.onerror = (e) => reject(new Error(`Error reading ${file.name}: ${e.target?.error}`));

        if (mimeType.startsWith('image/')) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsText(file);
        }
      });
    });

    try {
      const results = await Promise.all(fileReadPromises);
      results.forEach(result => {
        if (result.path) {
            newFilesData[result.path] = { content: result.content, mimeType: result.mimeType };
        }
      });
      setUploadedFilesData(newFilesData);
    } catch (error) {
      console.error("Error reading files:", error);
      setStatus(AppStatus.ERROR);
      setStatusMessage(error instanceof Error ? error.message : "Failed to read files.");
    } finally {
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }
  }, []);

  const handleFileSelect = useCallback((path: string, content?: string, mimeType?: string) => {
    setSelectedFilePath(path);
    const fileData = uploadedFilesData[path];
    if (content !== undefined) {
      setSelectedFileContent(content);
      setSelectedFileMimeType(mimeType || fileData?.mimeType || 'application/octet-stream');
    } else if (fileData) {
      setSelectedFileContent(fileData.content);
      setSelectedFileMimeType(fileData.mimeType);
    } else {
      setSelectedFileContent(nodeIsDirectory(path, fileTree) ? null : 'Content not available.');
      setSelectedFileMimeType(null);
    }
  }, [uploadedFilesData, fileTree]);

  const nodeIsDirectory = (path: string, tree: FileTreeNode[]): boolean => {
    function findNode(nodes: FileTreeNode[], targetPath: string): FileTreeNode | null {
        for (const node of nodes) {
            if (node.path === targetPath) return node;
            if (node.children) {
                const foundInChild = findNode(node.children, targetPath);
                if (foundInChild) return foundInChild;
            }
        }
        return null;
    }
    const node = findNode(tree, path);
    return node?.type === 'directory';
  };

  const printNode = (node: FileTreeNode, indent: string, ignoredPaths: string[]): string => {
    if (node.type === 'directory' && ignoredPaths.includes(node.name)) {
      return '';
    }
    let str = `${indent}${node.type === 'directory' ? '📁' : '📄'} ${node.name}`;
    if (node.children) {
      const childStrings = node.children
        .map(child => printNode(child, indent + '  ', ignoredPaths))
        .filter(childStr => childStr.length > 0);
      if (childStrings.length > 0) {
        str += `\n${childStrings.join('\n')}`;
      }
    }
    return str;
  };

  const prepareL1PromptContent = useCallback((): string => {
    setStatus(AppStatus.PREPARING_L1_PROMPT);

    const projectStructure = fileTree.map(node => printNode(node, '', ignoredFoldersArray)).filter(s => s).join('\n');

    const filteredUploadedFilesList = Object.keys(uploadedFilesData)
      .filter(filePath => {
        const parts = filePath.split('/');
        return !parts.slice(0, -1).some(part => ignoredFoldersArray.includes(part));
      })
      .sort()
      .join('\n');

    setStatus(AppStatus.AWAITING_L1_OUTPUT);
    setStatusMessage('Level 1 prompt template populated. Edit requirements and copy.');
    return `=====PROJECT-STRUCTURE=====\n${projectStructure}\n=====END-PROJECT-STRUCTURE=====\n\n=====UPLOADED-FILES=====\n${filteredUploadedFilesList}\n=====END-UPLOADED-FILES=====`;
  }, [fileTree, uploadedFilesData, ignoredFoldersArray]);


  const handleProcessL1Output = useCallback(async (output: string) => {
    setStatus(AppStatus.PROCESSING_L1_OUTPUT);
    setStatusMessage("Parsing Level 1 AI output...");

    const { effectiveApiKey, effectiveApiUrl } = getEffectiveConfig();

    if (!effectiveApiKey) {
        setStatus(AppStatus.ERROR);
        setStatusMessage("API Key is missing. Please set it in API Settings. If a deployer key (e.g., VITE_API_KEY) was intended, ensure it's correctly set in your Vercel project and accessible.");
        return;
    }

    const parsedOutput: Level1Output | null = parseLevel1Output(output);

    if (!parsedOutput) {
      setStatus(AppStatus.ERROR);
      setStatusMessage("Failed to parse Level 1 AI output. Check format and console for details.");
      return;
    }

    let commonRootPrefix: string | null = null;
    if (fileTree.length === 1 && fileTree[0].type === 'directory') {
        commonRootPrefix = fileTree[0].name;
    } else if (Object.keys(uploadedFilesData).length > 0) {
        const allPaths = Object.keys(uploadedFilesData);
        const firstPathSegments = allPaths[0].split('/');
        if (firstPathSegments.length > 1) {
            const potentialPrefix = firstPathSegments[0];
            if (allPaths.every(p => p.startsWith(potentialPrefix + '/'))) {
                commonRootPrefix = potentialPrefix;
            }
        }
    }

    const activeModifications = parsedOutput.modifications.filter(instruction => {
      const pathParts = instruction.filePath.split('/');
      const isPathIgnored = pathParts.slice(0, -1).some(part => ignoredFoldersArray.includes(part)) ||
                            (commonRootPrefix && pathParts[0] === commonRootPrefix && pathParts.slice(1, -1).some(part => ignoredFoldersArray.includes(part)));
      if (isPathIgnored) {
          console.warn(`Skipping modification for file in ignored folder: ${instruction.filePath}`);
          setStatusMessage(`Skipping op for ignored path: ${instruction.filePath}`);
          return false;
      }
      return true;
    });

    if (activeModifications.length === 0) {
        setStatus(AppStatus.DONE);
        setStatusMessage("Level 1 AI output parsed. No actionable file modifications specified (or all were in ignored folders).");
        return;
    }

    setStatusMessage(`Found ${activeModifications.length} actionable modifications. Preparing for Level 2 AI calls.`);

    const instructionsWithContent = activeModifications.map(mod => {
      let actualFilePath = mod.filePath;
      let fileData = uploadedFilesData[actualFilePath];

      if (fileData === undefined && commonRootPrefix && !mod.filePath.startsWith(commonRootPrefix + '/')) {
          const potentialFullPath = `${commonRootPrefix}/${mod.filePath}`;
          const potentialFileData = uploadedFilesData[potentialFullPath];
          if (potentialFileData !== undefined) {
              console.warn(`Path auto-correction: L1 output used '${mod.filePath}', matched to '${potentialFullPath}' by prepending root '${commonRootPrefix}'.`);
              setStatusMessage(`Info: Path for ${mod.filePath} auto-corrected to ${potentialFullPath}.`);
              fileData = potentialFileData;
              actualFilePath = potentialFullPath;
          }
      }
      return {
        ...mod,
        filePath: actualFilePath,
        originalContent: mod.operation !== OperationType.CREATE ? fileData?.content : undefined,
      };
    }).filter(mod => {
        if (mod.operation !== OperationType.CREATE && mod.originalContent === undefined) {
            console.warn(`Skipping ${mod.operation} for non-existent or uncorrected file path: ${mod.filePath}`);
            setStatusMessage(`Warning: File ${mod.filePath} not found for ${mod.operation}. Skipping.`);
            return false;
        }
        return true;
    });

    if (instructionsWithContent.length === 0) {
        setStatus(AppStatus.DONE);
        setStatusMessage("All specified modifications were for non-existent files (even after path correction attempts). No operations to perform.");
        return;
    }

    setStatus(AppStatus.CALLING_L2_AI);
    let modifiedCount = 0;
    const totalCalls = instructionsWithContent.length;
    setStatusMessage(`Calling Level 2 AI for ${totalCalls} files (0/${totalCalls} completed)...`);

    const newUploadedFilesData = { ...uploadedFilesData };
    let anyErrorDuringL2Calls = false;

    try {
        await processInBatches(
            instructionsWithContent,
            parsedOutput.threadCount,
            async (instruction) => {
                try {
                    // Use effectiveApiKey and effectiveApiUrl for the call
                    const modifiedFileContentRaw = await callGeminiApi(instruction, effectiveApiKey, effectiveApiUrl, geminiModelName);
                    if (modifiedFileContentRaw === null) {
                        throw new Error("API call returned null, indicating an error during the call or empty response.");
                    }
                    const finalModifiedContent = parseLevel2Output(modifiedFileContentRaw);

                    if (finalModifiedContent === null && instruction.operation !== OperationType.DELETE) {
                        console.warn(`Failed to parse Level 2 output for ${instruction.filePath} or content was null. File not modified.`);
                        setStatusMessage(`Warning: Could not parse L2 output for ${instruction.filePath}.`);
                        anyErrorDuringL2Calls = true;
                        return;
                    }

                    const originalMimeType = newUploadedFilesData[instruction.filePath]?.mimeType || 'text/plain';

                    if (instruction.operation === OperationType.DELETE || (finalModifiedContent === '' && instruction.operation !== OperationType.CREATE && finalModifiedContent !== null) ) {
                        delete newUploadedFilesData[instruction.filePath];
                        console.log(`File deleted: ${instruction.filePath}`);
                    } else if (finalModifiedContent !== null) {
                        newUploadedFilesData[instruction.filePath] = {
                           content: finalModifiedContent,
                           mimeType: instruction.operation === OperationType.CREATE ? 'text/plain' : originalMimeType
                        };
                        console.log(`File ${instruction.operation === OperationType.CREATE ? 'created' : 'updated'}: ${instruction.filePath}`);
                    }
                } catch (e: any) {
                    console.error(`Error processing file ${instruction.filePath}: ${e.message}`);
                    setStatusMessage(`Error for ${instruction.filePath}: ${e.message.substring(0,100)}...`);
                    anyErrorDuringL2Calls = true;
                }
            },
            (completed, total) => {
                modifiedCount = completed;
                setStatusMessage(`Calling Level 2 AI for ${total} files (${completed}/${total} completed)...`);
            }
        );

        setUploadedFilesData(newUploadedFilesData);

        if (selectedFilePath && newUploadedFilesData[selectedFilePath]?.content !== uploadedFilesData[selectedFilePath]?.content) {
          setSelectedFileContent(newUploadedFilesData[selectedFilePath]?.content || null);
          setSelectedFileMimeType(newUploadedFilesData[selectedFilePath]?.mimeType || null);
        } else if (selectedFilePath && !newUploadedFilesData.hasOwnProperty(selectedFilePath)) {
          setSelectedFilePath(null);
          setSelectedFileContent(null);
          setSelectedFileMimeType(null);
        }

        setStatus(anyErrorDuringL2Calls ? AppStatus.ERROR : AppStatus.DONE);
        setStatusMessage(anyErrorDuringL2Calls ? `Completed with some errors. ${modifiedCount}/${totalCalls} processed. Check console.` : `All ${modifiedCount} modifications processed successfully.`);

    } catch (batchProcessingError: any) {
        console.error("A batch processing error occurred:", batchProcessingError);
        setStatus(AppStatus.ERROR);
        setStatusMessage(`A critical error occurred during batch processing: ${batchProcessingError.message}. Some files may not have been processed.`);
        setUploadedFilesData(newUploadedFilesData);
    }

  }, [getEffectiveConfig, geminiModelName, uploadedFilesData, selectedFilePath, ignoredFoldersArray, fileTree]);

  const handleDividerMouseDown = (divider: 'left-middle' | 'middle-right', event: React.MouseEvent) => {
    event.preventDefault();
    setDraggingDivider(divider);
    dragStartRef.current = {
      x: event.clientX,
      leftWidth: paneWidths.left,
      middleWidth: paneWidths.middle,
      rightWidth: paneWidths.right,
    };
    document.body.style.cursor = 'col-resize';
  };

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!draggingDivider || !mainContentRef.current) return;
      event.preventDefault();

      const deltaX = event.clientX - dragStartRef.current.x;
      const containerWidth = mainContentRef.current.offsetWidth;
      const deltaPercent = (deltaX / containerWidth) * 100;

      let newLeft = dragStartRef.current.leftWidth;
      let newMiddle = dragStartRef.current.middleWidth;
      let newRight = dragStartRef.current.rightWidth;

      if (draggingDivider === 'left-middle') {
        newLeft = dragStartRef.current.leftWidth + deltaPercent;
        newMiddle = dragStartRef.current.middleWidth - deltaPercent;
      } else { // middle-right
        newMiddle = dragStartRef.current.middleWidth + deltaPercent;
        newRight = dragStartRef.current.rightWidth - deltaPercent;
      }

      if (newLeft < MIN_PANE_WIDTH_PERCENT) {
        const diff = MIN_PANE_WIDTH_PERCENT - newLeft;
        newLeft = MIN_PANE_WIDTH_PERCENT;
        if (draggingDivider === 'left-middle') newMiddle -= diff;
      }
      if (newMiddle < MIN_PANE_WIDTH_PERCENT) {
        const diff = MIN_PANE_WIDTH_PERCENT - newMiddle;
        newMiddle = MIN_PANE_WIDTH_PERCENT;
        if (draggingDivider === 'left-middle') newLeft -= diff;
        else newRight -= diff;
      }
      if (newRight < MIN_PANE_WIDTH_PERCENT) {
        const diff = MIN_PANE_WIDTH_PERCENT - newRight;
        newRight = MIN_PANE_WIDTH_PERCENT;
        if (draggingDivider === 'middle-right') newMiddle -= diff;
      }

      const total = newLeft + newMiddle + newRight;
      if (Math.abs(total - 100) > 0.1) {
          if (draggingDivider === 'left-middle') {
            const fixed = newRight;
            const remaining = 100 - fixed;
            newLeft = Math.max(MIN_PANE_WIDTH_PERCENT, Math.min(newLeft, remaining - MIN_PANE_WIDTH_PERCENT));
            newMiddle = remaining - newLeft;
          } else {
            const fixed = newLeft;
            const remaining = 100 - fixed;
            newRight = Math.max(MIN_PANE_WIDTH_PERCENT, Math.min(newRight, remaining - MIN_PANE_WIDTH_PERCENT));
            newMiddle = remaining - newRight;
          }
      }

      const finalSum = newLeft + newMiddle + newRight;
      setPaneWidths({
        left: (newLeft / finalSum) * 100,
        middle: (newMiddle / finalSum) * 100,
        right: (newRight / finalSum) * 100,
      });
    };

    const handleMouseUp = () => {
      setDraggingDivider(null);
      document.body.style.cursor = 'default';
    };

    if (draggingDivider) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [draggingDivider]);


  return (
    <div className="flex flex-col h-screen antialiased text-gray-200 bg-gray-900">
      <header className="p-4 bg-gray-800 shadow-md flex-shrink-0">
        <h1 className="text-2xl font-bold text-sky-400">Concurrent AI Programming Assistant</h1>
      </header>

      <div
        ref={mainContentRef}
        id="main-content-area"
        className="flex flex-1 p-4 space-x-0 overflow-hidden"
        style={{ paddingBottom: '50px' }}
      >
        <div
          className="flex flex-col space-y-4 h-full overflow-hidden"
          style={{ flexBasis: `${paneWidths.left}%` }}
        >
          <div className="flex-shrink-0">
            <SettingsPanel
              apiKey={userApiKey}
              setApiKey={setUserApiKey}
              apiUrl={userApiUrl}
              setApiUrl={setUserApiUrl}
              geminiModelName={geminiModelName}
              setGeminiModelName={setGeminiModelName}
              ignoredFolders={ignoredFoldersInput}
              setIgnoredFolders={setIgnoredFoldersInput}
              showApiUrlInput={!DEPLOYER_API_URL} // Hide if deployer URL (Vite or legacy) is set
            />
          </div>
           <div className="flex-shrink-0">
            <input
                type="file"
                // @ts-ignore
                webkitdirectory=""
                // @ts-ignore
                directory=""
                multiple
                ref={fileInputRef as RefObject<HTMLInputElement & {webkitdirectory:string, directory: string}>}
                onChange={handleFolderUpload}
                className="hidden"
                id="folderUploadInput"
            />
            <Button
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
                disabled={status === AppStatus.UPLOADING || status === AppStatus.GENERATING_TREE}
                isLoading={status === AppStatus.UPLOADING || status === AppStatus.GENERATING_TREE}
            >
                {Object.keys(uploadedFilesData).length > 0 ? 'Re-upload Project Folder' : 'Upload Project Folder'}
            </Button>
           </div>
          <div className="flex-1 min-h-0 overflow-y-auto bg-gray-800 rounded-lg shadow">
            <FileTreePanel
              fileTree={fileTree}
              onFileSelect={handleFileSelect}
              selectedFilePath={selectedFilePath}
              ignoredFolders={ignoredFoldersArray}
            />
          </div>
        </div>

        <div
          className="w-2 mx-1.5 flex-shrink-0 bg-gray-700 hover:bg-sky-600 cursor-col-resize transition-colors duration-150"
          onMouseDown={(e) => handleDividerMouseDown('left-middle', e)}
          title="Drag to resize"
        ></div>

        <div
            className="flex flex-col h-full overflow-hidden"
            style={{ flexBasis: `${paneWidths.middle}%` }}
        >
          <EditorPanel filePath={selectedFilePath} content={selectedFileContent} mimeType={selectedFileMimeType} />
        </div>

        <div
          className="w-2 mx-1.5 flex-shrink-0 bg-gray-700 hover:bg-sky-600 cursor-col-resize transition-colors duration-150"
          onMouseDown={(e) => handleDividerMouseDown('middle-right', e)}
          title="Drag to resize"
        ></div>

        <div
            className="flex-shrink-0 h-full overflow-y-auto rounded-lg shadow bg-gray-800"
            style={{ flexBasis: `${paneWidths.right}%` }}
        >
          <Level1Panel
            onPrepareL1Prompt={Object.keys(uploadedFilesData).length > 0 ? prepareL1PromptContent : (() => { alert("Please upload a project first."); return ""; })}
            onProcessL1Output={handleProcessL1Output}
            currentStatus={status}
          />
        </div>
      </div>
      <StatusBar status={status} message={statusMessage} />
    </div>
  );
};

export default App;
