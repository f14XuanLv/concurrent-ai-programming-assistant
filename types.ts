
export interface ProjectFile {
  path: string; // relative path like "src/components/Button.tsx"
  content: string; // data URL for images, text for others
  mimeType: string; 
  webkitRelativePath: string; 
}

export interface FileTreeNode {
  id: string; // Typically the full path
  name: string; // File or folder name
  path: string; // Full path from root
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  content?: string; // For files: data URL for images, text for others
  mimeType?: string; // For files
}

// Type for the structure stored in App's uploadedFilesData state
export interface UploadedFileData {
  content: string; // data URL for images, text for others
  mimeType: string;
}


export enum OperationType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

export interface ParsedModificationInstruction {
  filePath: string;
  operation: OperationType;
  description: string;
  modificationDetails: string; // The raw "CONTEXT_MODIFICATIONS_START...CONTEXT_MODIFICATIONS_END" block
  originalContent?: string; // To be added before sending to Level 2 AI (data URL for images)
}

export interface Level1Output {
  threadCount: number;
  modifications: ParsedModificationInstruction[];
}

export enum AppStatus {
  IDLE = '无请求',
  UPLOADING = '上传中...',
  GENERATING_TREE = '生成目录树...',
  PREPARING_L1_PROMPT = '准备一级提示词...',
  AWAITING_L1_OUTPUT = '等待一级AI输出...',
  PROCESSING_L1_OUTPUT = '处理一级AI输出...',
  CALLING_L2_AI = '并发调用二级AI...',
  UPDATING_FILES = '更新文件...',
  DONE = '处理完成',
  ERROR = '发生错误',
}

// Define a type for the API response structure from Gemini (via fetch from proxy)
export interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text: string }>;
      role?: string;
    };
    finishReason?: string;
    index?: number;
    safetyRatings?: Array<{
      category: string;
      probability: string;
    }>;
  }>;
  promptFeedback?: {
    safetyRatings: Array<{
      category: string;
      probability: string;
    }>;
  };
  text?: string; 
  error?: { 
    message: string; // Consistently provided by the proxy
    details?: any;    // Provided by the proxy (e.g., error.cause)
    code?: number;    // Optional, as not provided by current proxy implementation in its JSON
    status?: string;  // Optional, as not provided by current proxy implementation in its JSON (proxy sets HTTP status code)
  }
}