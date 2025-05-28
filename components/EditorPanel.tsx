
import React, { CSSProperties } from 'react';

interface EditorPanelProps {
  filePath: string | null;
  content: string | null;
  mimeType: string | null;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({ filePath, content, mimeType }) => {
  if (!filePath) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 bg-gray-800 rounded-lg shadow">
        Select a file to view its content.
      </div>
    );
  }

  const isImage = mimeType && mimeType.startsWith('image/');

  const preStyle: CSSProperties = {
    padding: '1rem', // Replicates padding from SyntaxHighlighter customStyle
    height: '100%',
    width: '100%',
    overflow: 'auto',
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    fontSize: '13px',
    whiteSpace: 'pre-wrap', // Preserves whitespace, wraps lines
    wordWrap: 'break-word', // Breaks long words to prevent overflow
    margin: 0, // Ensure no default margin from pre
    boxSizing: 'border-box',
  };

  return (
    <div className="p-4 bg-gray-800 rounded-lg shadow h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-2 text-sky-400 truncate" title={filePath}>{filePath}</h3>
      
      {isImage && content ? (
        <div className="flex-grow w-full p-2 bg-gray-900 border border-gray-700 rounded-md flex items-center justify-center overflow-auto">
          <img 
            src={content} 
            alt={filePath} 
            className="max-w-full max-h-full object-contain"
          />
        </div>
      ) : content !== null ? (
        <div className="flex-grow w-full border border-gray-700 rounded-md overflow-hidden text-sm bg-gray-900">
          {/* Using a pre tag for displaying code content as plain text */}
          <pre style={preStyle}>
            {String(content)}
          </pre>
        </div>
      ) : (
        <div className="flex-grow flex items-center justify-center text-gray-500 bg-gray-900 border border-gray-700 rounded-md">
          Content not available or directory selected.
        </div>
      )}
    </div>
  );
};
