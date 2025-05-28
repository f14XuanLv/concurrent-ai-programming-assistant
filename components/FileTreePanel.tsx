
import React from 'react';
import { FileTreeNode } from '../types';
import { FolderIconSVG, FileIconSVG } from '../constants'; // Using .tsx for constants

interface FileTreeNodeItemProps {
  node: FileTreeNode;
  onFileSelect: (path: string, content?: string, mimeType?: string) => void;
  selectedFilePath: string | null;
  level?: number;
  ignoredFolders: string[];
}

const FileTreeNodeItem: React.FC<FileTreeNodeItemProps> = React.memo(({ node, onFileSelect, selectedFilePath, level = 0, ignoredFolders }) => {
  const [isOpen, setIsOpen] = React.useState(
    level < 2 && (node.type === 'file' || !ignoredFolders.includes(node.name))
  );

  const isSelected = selectedFilePath === node.path;

  const handleSelect = () => {
    if (node.type === 'file') {
      onFileSelect(node.path, node.content, node.mimeType);
    } else {
      setIsOpen(!isOpen);
      // For directories, content and mimeType are undefined
      onFileSelect(node.path, undefined, undefined); 
    }
  };

  const isIgnoredNode = node.type === 'directory' && ignoredFolders.includes(node.name);

  return (
    <div style={{ paddingLeft: `${level * 1.25}rem` }}>
      <div
        className={`flex items-center py-1 px-2 cursor-pointer rounded-md hover:bg-gray-700 ${isSelected ? 'bg-sky-700 font-semibold' : ''} ${isIgnoredNode ? 'opacity-70' : ''}`}
        onClick={handleSelect}
        title={isIgnoredNode ? `${node.name} (Ignored Folder)` : node.name}
        role="treeitem"
        aria-expanded={node.type === 'directory' ? isOpen : undefined}
        aria-selected={isSelected}
        tabIndex={0} // Make it focusable
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelect(); }}
      >
        {node.type === 'directory' ? (
          <FolderIconSVG className={`w-5 h-5 mr-2 flex-shrink-0 ${isOpen && !isIgnoredNode ? 'text-sky-400' : 'text-yellow-500'} ${isIgnoredNode && !isOpen ? 'text-gray-500' : ''}`} />
        ) : (
          <FileIconSVG className="w-5 h-5 mr-2 flex-shrink-0 text-sky-400" />
        )}
        <span className={`truncate text-sm ${isIgnoredNode ? 'italic text-gray-400' : ''}`}>{node.name}</span>
      </div>
      {node.type === 'directory' && isOpen && node.children && (
        <div role="group">
          {node.children.length > 0 ? (
            node.children.map((child) => (
              <FileTreeNodeItem
                key={child.id}
                node={child}
                onFileSelect={onFileSelect}
                selectedFilePath={selectedFilePath}
                level={level + 1}
                ignoredFolders={ignoredFolders}
              />
            ))
          ) : (
            <div style={{ paddingLeft: `${(level + 1) * 1.25}rem` }} className="py-1 px-2 text-xs text-gray-500 italic">
              (empty)
            </div>
          )}
        </div>
      )}
    </div>
  );
});


interface FileTreePanelProps {
  fileTree: FileTreeNode[];
  onFileSelect: (path: string, content?: string, mimeType?: string) => void;
  selectedFilePath: string | null;
  ignoredFolders: string[];
}

export const FileTreePanel: React.FC<FileTreePanelProps> = ({ fileTree, onFileSelect, selectedFilePath, ignoredFolders }) => {
  if (!fileTree || fileTree.length === 0) {
    return <div className="p-4 text-gray-400 italic">No project uploaded or empty project.</div>;
  }

  return (
    <div className="p-2 bg-gray-800 rounded-lg shadow h-full overflow-y-auto" role="tree" aria-label="Project Explorer">
      <h3 className="text-lg font-semibold mb-2 text-sky-400 px-2" id="project-explorer-heading">Project Explorer</h3>
      {fileTree.map((node) => (
        <FileTreeNodeItem 
            key={node.id} 
            node={node} 
            onFileSelect={onFileSelect} 
            selectedFilePath={selectedFilePath}
            ignoredFolders={ignoredFolders}
        />
      ))}
    </div>
  );
};
