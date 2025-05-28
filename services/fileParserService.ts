
import { Level1Output, ParsedModificationInstruction, OperationType } from '../types';

export const parseLevel1Output = (output: string): Level1Output | null => {
  try {
    const threadCountMatch = output.match(/THREAD_COUNT:\s*(\d+)/);
    const threadCount = threadCountMatch ? parseInt(threadCountMatch[1], 10) : 4;

    const modifications: ParsedModificationInstruction[] = [];
    
    const fileModificationsBlockMatch = output.match(/FILE_MODIFICATIONS_START([\s\S]*?)FILE_MODIFICATIONS_END/);
    if (!fileModificationsBlockMatch || !fileModificationsBlockMatch[1]) {
        console.error("Could not find FILE_MODIFICATIONS_START/END block or it's empty in Level 1 output.");
        // Allow processing if thread count is present but no modifications (e.g. AI says no changes needed)
        if (threadCountMatch) return { threadCount, modifications: [] };
        return null;
    }
    const filesBlock = fileModificationsBlockMatch[1];

    // Regex to capture each file modification block
    // It's important that DESCRIPTION can be multiline and non-greedy.
    // CONTEXT_MODIFICATIONS_START to CONTEXT_MODIFICATIONS_END captures everything in between.
    const fileRegex = /FILE:\s*(?<filePath>[^\r\n]+?)\s*OPERATION:\s*(?<operation>CREATE|UPDATE|DELETE)\s*DESCRIPTION:\s*(?<description>[\s\S]*?)\s*CONTEXT_MODIFICATIONS_START(?<modificationDetails>[\s\S]*?)CONTEXT_MODIFICATIONS_END\s*FILE_END/g;
    
    let match;
    while ((match = fileRegex.exec(filesBlock)) !== null) {
      if (match.groups) {
        const { filePath, operation, description, modificationDetails } = match.groups;
        modifications.push({
          filePath: filePath.trim(),
          operation: operation.trim() as OperationType,
          description: description.trim(),
          modificationDetails: modificationDetails.trim(),
        });
      }
    }
    
    if (modifications.length === 0 && filesBlock.trim().length > 0) {
        console.warn("FILE_MODIFICATIONS_START/END block was present in Level 1 output, but no individual FILE blocks were parsed. Check file block regex and input format.");
    }

    return { threadCount, modifications };
  } catch (error) {
    console.error("Error parsing Level 1 AI output:", error);
    return null;
  }
};

export const parseLevel2Output = (output: string): string | null => {
  try {
    const modifiedFileRegex = /MODIFIED_FILE_START([\s\S]*?)MODIFIED_FILE_END/s;
    const match = output.match(modifiedFileRegex);
    if (match && typeof match[1] === 'string') { // match[1] could be empty string
      return match[1]; // Return the content within the markers, even if empty (e.g. for DELETE)
    }
    
    console.warn("MODIFIED_FILE_START/MODIFIED_FILE_END markers not found in Level 2 AI output. Treating entire output as content. Raw output:", output);
    // If markers are not found, but there's content, assume it's the file content.
    // This helps if AI fails to format exactly but still gives the code.
    return output.trim();

  } catch (error) {
    console.error("Error parsing Level 2 AI output:", error);
    return null;
  }
};
