
import React, { useState, useCallback, useEffect, ChangeEvent, RefObject, useMemo, useRef } from 'react';
import { FileTreeNode, ParsedModificationInstruction, Level1Output, AppStatus, OperationType, UploadedFileData } from './types';
import { DEFAULT_GEMINI_MODEL_NAME, DEFAULT_USER_API_URL } from './constants';
import { SettingsPanel } from './components/SettingsPanel';
import { FileTreePanel } from './components/FileTreePanel';
import { EditorPanel } from './components/EditorPanel';
import { Level1Panel } from './components/Level1Panel';
import { StatusBar } from './components/StatusBar';
import { Button } from './components/Button';
import { parseLevel1Output, parseLevel2Output } from './services/fileParserService';
import { callGeminiApi } from './services/geminiService';

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
        // Allow individual errors to be handled by the processor,
        // but if Promise.all itself rejects (e.g., unhandled rejection in processor not caught there), rethrow.
        // The processor should ideally catch its own errors and return a specific error state if needed.
        throw error; 
    }
  }
  return allResults;
}

const MIN_PANE_WIDTH_PERCENT = 10; // Minimum 10% width for each pane

const App: React.FC = () => {
  const [userApiKey, setUserApiKey] = useState<string>('');
  const [userApiUrl, setUserApiUrl] = useState<string>(DEFAULT_USER_API_URL);
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
          resolve({path: '', content: '', mimeType: ''}); // Resolve to allow Promise.all to continue
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
        if (result.path) { // Only add if path is valid
            newFilesData[result.path] = { content: result.content, mimeType: result.mimeType };
        }
      });
      setUploadedFilesData(newFilesData); // This will trigger the useEffect for tree building
    } catch (error) {
      console.error("Error reading files:", error);
      setStatus(AppStatus.ERROR);
      setStatusMessage(error instanceof Error ? error.message : "Failed to read files.");
    } finally {
        if (fileInputRef.current) { // Reset file input
            fileInputRef.current.value = "";
        }
    }
  }, []);

  const handleFileSelect = useCallback((path: string, content?: string, mimeType?: string) => {
    setSelectedFilePath(path);
    const fileData = uploadedFilesData[path];
    if (content !== undefined) { // Content explicitly passed (e.g. from FileTreeNodeItem if it stored it)
      setSelectedFileContent(content);
      setSelectedFileMimeType(mimeType || fileData?.mimeType || 'application/octet-stream');
    } else if (fileData) { // Fallback to lookup in uploadedFilesData
      setSelectedFileContent(fileData.content);
      setSelectedFileMimeType(fileData.mimeType);
    } else { // Path selected might be a directory or file not found
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
      return ''; // Skip ignored directories
    }
    let str = `${indent}${node.type === 'directory' ? '📁' : '📄'} ${node.name}`;
    if (node.children) {
      const childStrings = node.children
        .map(child => printNode(child, indent + '  ', ignoredPaths))
        .filter(childStr => childStr.length > 0); // Filter out empty strings from ignored children
      if (childStrings.length > 0) {
        str += `\n${childStrings.join('\n')}`;
      }
    }
    return str;
  };

  const prepareL1PromptContent = useCallback((): string => {
    setStatus(AppStatus.PREPARING_L1_PROMPT);

    const projectStructure = fileTree.map(node => printNode(node, '', ignoredFoldersArray)).filter(s => s).join('\n');

    // Filter out files within ignored folders from the list for L1 AI
    const filteredUploadedFilesList = Object.keys(uploadedFilesData)
      .filter(filePath => {
        const parts = filePath.split('/');
        // Check if any parent directory segment is in the ignoredFoldersArray
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

    if (!userApiKey.trim()) {
        // Check if the backend proxy is available (e.g., by trying a lightweight health check or assuming it is if not self-hosting with user keys)
        // For now, we'll assume the proxy is available if no userApiKey is set.
        // Production deployments should ensure the proxy at /api/gemini is functional.
        console.info("No user API key provided. L2 AI calls will attempt to use backend proxy.");
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
        if (firstPathSegments.length > 1) { // Check if there is at least one directory segment
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
                    // Pass userApiKey and userApiUrl to callGeminiApi
                    const modifiedFileContentRaw = await callGeminiApi(instruction, geminiModelName, userApiKey, userApiUrl);
                    
                    if (modifiedFileContentRaw === null) {
                        if (instruction.operation !== OperationType.DELETE) {
                           throw new Error("API call returned null, indicating an error during the call or empty response.");
                        }
                    }
                    
                    const finalModifiedContent = parseLevel2Output(modifiedFileContentRaw as string); 

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

  }, [geminiModelName, userApiKey, userApiUrl, uploadedFilesData, selectedFilePath, ignoredFoldersArray, fileTree]);

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
      
      const finalSum = newLeft + newMiddle + newRight;
      if (finalSum > 0) { // Avoid division by zero if all widths somehow become zero
        setPaneWidths({
            left: (newLeft / finalSum) * 100,
            middle: (newMiddle / finalSum) * 100,
            right: (newRight / finalSum) * 100,
        });
      }
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
        {/* Left Pane */}
        <div
          className="flex flex-col space-y-4 h-full overflow-hidden"
          style={{ flexBasis: `${paneWidths.left}%` }}
        >
          <div className="flex-shrink-0">
            <SettingsPanel
              userApiKey={userApiKey}
              setUserApiKey={setUserApiKey}
              userApiUrl={userApiUrl}
              setUserApiUrl={setUserApiUrl}
              geminiModelName={geminiModelName}
              setGeminiModelName={setGeminiModelName}
              ignoredFolders={ignoredFoldersInput}
              setIgnoredFolders={setIgnoredFoldersInput}
            />
          </div>
           <div className="flex-shrink-0"> 
            <input
                type="file"
                // @ts-ignore 
                webkitdirectory=""
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

        {/* Divider 1 */}
        <div
          className="w-2 mx-1.5 flex-shrink-0 bg-gray-700 hover:bg-sky-600 cursor-col-resize transition-colors duration-150 rounded"
          onMouseDown={(e) => handleDividerMouseDown('left-middle', e)}
          title="Drag to resize"
          role="separator"
          aria-orientation="vertical"
        ></div>

        {/* Middle Pane */}
        <div
            className="flex flex-col h-full overflow-hidden" 
            style={{ flexBasis: `${paneWidths.middle}%` }}
        >
          <EditorPanel filePath={selectedFilePath} content={selectedFileContent} mimeType={selectedFileMimeType} />
        </div>

        {/* Divider 2 */}
        <div
          className="w-2 mx-1.5 flex-shrink-0 bg-gray-700 hover:bg-sky-600 cursor-col-resize transition-colors duration-150 rounded"
          onMouseDown={(e) => handleDividerMouseDown('middle-right', e)}
          title="Drag to resize"
          role="separator"
          aria-orientation="vertical"
        ></div>

        {/* Right Pane */}
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