
import React, { useState, useCallback, useEffect, ChangeEvent, RefObject, useMemo } from 'react';
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
        throw error; // Propagate the error to stop further processing if one batch fails catastrophically.
    }
  }
  return allResults;
}


const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>(DEFAULT_API_KEY);
  const [apiUrl, setApiUrl] = useState<string>(DEFAULT_API_URL);
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
      // setSelectedFilePath(null); // Cleared by useEffect on uploadedFilesData change
      // setSelectedFileContent(null);
      // setSelectedFileMimeType(null);
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
    } else { // Directory selected or file data somehow missing
      setSelectedFileContent(nodeIsDirectory(path, fileTree) ? null : 'Content not available.');
      setSelectedFileMimeType(null);
    }
  }, [uploadedFilesData, fileTree]);

  const nodeIsDirectory = (path: string, tree: FileTreeNode[]): boolean => {
    function findNode(nodes: FileTreeNode[], targetPath: string): FileTreeNode | null {
        for (const node of nodes) {
            if (node.path === targetPath) return node;
            if (node.children) {
                const found = findNode(node.children, targetPath);
                if (found) return found;
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


  const processLevel1Output = useCallback(async (output: string) => {
    setStatus(AppStatus.PROCESSING_L1_OUTPUT);
    setStatusMessage("Parsing Level 1 AI output...");

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
        filePath: actualFilePath, // Use the potentially corrected file path
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
            async (instruction) => { // instruction.filePath here is the potentially corrected one
                try {
                    const modifiedFileContentRaw = await callGeminiApi(instruction, apiKey, apiUrl, geminiModelName); // Pass geminiModelName
                    if (modifiedFileContentRaw === null) {
                        throw new Error("API call returned null, indicating an error during the call or empty response.");
                    }
                    const finalModifiedContent = parseLevel2Output(modifiedFileContentRaw);

                    if (finalModifiedContent === null && instruction.operation !== OperationType.DELETE) {
                        console.warn(`Failed to parse Level 2 output for ${instruction.filePath} or content was null. File not modified.`);
                        setStatusMessage(`Warning: Could not parse L2 output for ${instruction.filePath}.`);
                        anyErrorDuringL2Calls = true; // Mark that an error occurred for this file
                        return; // Skip this file but continue batch
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

    } catch (batchProcessingError: any) { // This catches errors from processInBatches if it rethrows
        console.error("A batch processing error occurred:", batchProcessingError);
        setStatus(AppStatus.ERROR);
        setStatusMessage(`A critical error occurred during batch processing: ${batchProcessingError.message}. Some files may not have been processed.`);
        setUploadedFilesData(newUploadedFilesData); // Reflect potentially partial updates
    }

  }, [apiKey, apiUrl, geminiModelName, uploadedFilesData, selectedFilePath, ignoredFoldersArray, fileTree]);


  return (
    <div className="flex flex-col h-screen antialiased text-gray-200 bg-gray-900">
      <header className="p-4 bg-gray-800 shadow-md">
        <h1 className="text-2xl font-bold text-sky-400">Concurrent AI Programming Assistant</h1>
      </header>

      <div className="flex flex-grow p-4 space-x-4 overflow-hidden" style={{height: 'calc(100vh - 68px - 45px)'}}> {/* Adjust height for header and status bar */}
        <div className="w-1/4 flex flex-col space-y-4">
          <SettingsPanel 
            apiKey={apiKey} 
            setApiKey={setApiKey} 
            apiUrl={apiUrl} 
            setApiUrl={setApiUrl}
            geminiModelName={geminiModelName}
            setGeminiModelName={setGeminiModelName}
            ignoredFolders={ignoredFoldersInput}
            setIgnoredFolders={setIgnoredFoldersInput}
          />
           <div>
            <input
                type="file"
                // @ts-ignore webkitdirectory is a non-standard attribute but required for folder selection
                webkitdirectory=""
                // @ts-ignore directory is a non-standard attribute but required for folder selection
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
          <div className="flex-grow min-h-0"> {/* This div needs to manage overflow for FileTreePanel */}
            <FileTreePanel 
              fileTree={fileTree} 
              onFileSelect={(path, nodeContent, nodeMimeType) => handleFileSelect(path, nodeContent, nodeMimeType)}
              selectedFilePath={selectedFilePath}
              ignoredFolders={ignoredFoldersArray}
            />
          </div>
        </div>

        <div className="w-1/2 min-h-0"> {/* Editor panel should take available height */}
          <EditorPanel filePath={selectedFilePath} content={selectedFileContent} mimeType={selectedFileMimeType} />
        </div>

        <div className="w-1/4 flex-shrink-0 overflow-y-auto"> {/* This panel will scroll independently */}
          <Level1Panel
            onPrepareL1Prompt={Object.keys(uploadedFilesData).length > 0 ? prepareL1PromptContent : (() => { alert("Please upload a project first."); return ""; })}
            onProcessL1Output={processLevel1Output}
            currentStatus={status}
          />
        </div>
      </div>
      <StatusBar status={status} message={statusMessage} />
    </div>
  );
};

export default App;
