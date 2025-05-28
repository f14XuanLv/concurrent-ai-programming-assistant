
import { ParsedModificationInstruction, OperationType, GeminiApiResponse } from '../types';
import { 
    LEVEL_2_PROMPT_TEMPLATE_HEADER,
    LEVEL_2_PROMPT_ORIGINAL_CONTENT_SECTION,
    LEVEL_2_PROMPT_MODIFICATION_DETAILS_SECTION,
    LEVEL_2_PROMPT_FOOTER
} from '../constants';

const constructLevel2Prompt = (instruction: ParsedModificationInstruction): string => {
    let prompt = LEVEL_2_PROMPT_TEMPLATE_HEADER
        .replace('{filePath}', instruction.filePath)
        .replace('{operationType}', instruction.operation)
        .replace('{description}', instruction.description);

    // Only include original content section if it's an UPDATE or DELETE operation
    // and original content is actually available.
    if ((instruction.operation === OperationType.UPDATE || instruction.operation === OperationType.DELETE) && typeof instruction.originalContent === 'string') {
        prompt += LEVEL_2_PROMPT_ORIGINAL_CONTENT_SECTION.replace('{originalContent}', instruction.originalContent);
    } else if (instruction.operation === OperationType.CREATE) {
      // For CREATE, explicitly state no original content or make it an empty block
      prompt += LEVEL_2_PROMPT_ORIGINAL_CONTENT_SECTION.replace('{originalContent}', "// This is a new file to be created.");
    }


    prompt += LEVEL_2_PROMPT_MODIFICATION_DETAILS_SECTION.replace('{modificationDetails}', instruction.modificationDetails);
    prompt += LEVEL_2_PROMPT_FOOTER;
    return prompt;
};

export const callGeminiApi = async (
  instruction: ParsedModificationInstruction,
  apiKey: string,
  apiUrl: string,
  modelName: string // Added modelName parameter
): Promise<string | null> => {
  const promptText = constructLevel2Prompt(instruction);
  // User provided URL structure, e.g., https://api-proxy.me/gemini/v1beta/models/{MODEL_NAME}:generateContent?key=API_KEY
  // Ensure apiUrl ends with / if not already
  const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
  const fullApiUrl = `${baseUrl}/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(fullApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: promptText }],
          },
        ],
        // generationConfig: { temperature: 0.7 } // Example config
      }),
    });

    const data: GeminiApiResponse = await response.json();

    if (!response.ok) {
      const errorMsg = data.error?.message || `API Error ${response.status}: ${response.statusText}`;
      console.error(`Gemini API Error (${modelName}):`, errorMsg, data);
      throw new Error(errorMsg);
    }
    
    if (data.candidates && data.candidates.length > 0 &&
        data.candidates[0].content && data.candidates[0].content.parts &&
        data.candidates[0].content.parts.length > 0 && typeof data.candidates[0].content.parts[0].text === 'string') {
      return data.candidates[0].content.parts[0].text;
    } else if (typeof data.text === 'string') { 
        return data.text;
    } else {
      console.error(`Unexpected Gemini API response structure (${modelName}):`, data);
      throw new Error(`Unexpected Gemini API response structure for model ${modelName}. No text found.`);
    }

  } catch (error) {
    console.error(`Error calling Gemini API (${modelName}) for ${instruction.filePath}:`, error);
    if (error instanceof Error) {
        // Prepend filepath and model to error message for better context
        throw new Error(`[${instruction.filePath} - ${modelName}] ${error.message}`);
    }
    throw new Error(`[${instruction.filePath} - ${modelName}] An unknown error occurred while calling Gemini API.`);
  }
};
