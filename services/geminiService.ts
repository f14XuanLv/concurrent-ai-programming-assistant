
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ParsedModificationInstruction, OperationType } from '../types';
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

    if ((instruction.operation === OperationType.UPDATE || instruction.operation === OperationType.DELETE) && typeof instruction.originalContent === 'string') {
        prompt += LEVEL_2_PROMPT_ORIGINAL_CONTENT_SECTION.replace('{originalContent}', instruction.originalContent);
    } else if (instruction.operation === OperationType.CREATE) {
      prompt += LEVEL_2_PROMPT_ORIGINAL_CONTENT_SECTION.replace('{originalContent}', "// This is a new file to be created.");
    }

    prompt += LEVEL_2_PROMPT_MODIFICATION_DETAILS_SECTION.replace('{modificationDetails}', instruction.modificationDetails);
    prompt += LEVEL_2_PROMPT_FOOTER;
    return prompt;
};

export const callGeminiApi = async (
  instruction: ParsedModificationInstruction,
  apiKey: string,
  apiUrl: string, // Note: This parameter may have limited effect if the @google/genai SDK is used, as it manages its own endpoints.
  modelName: string
): Promise<string | null> => {
  const promptText = constructLevel2Prompt(instruction);

  if (!apiKey) {
    console.error(`Gemini API key is missing for model ${modelName} and file ${instruction.filePath}.`);
    throw new Error(`[${instruction.filePath} - ${modelName}] API Key is missing.`);
  }
  
  try {
    // Initialize the GoogleGenAI client with the API key
    // The SDK typically handles the base URL (e.g., generativelanguage.googleapis.com) itself.
    // The `apiUrl` parameter passed to this function might not be directly used by the SDK.
    const ai = new GoogleGenAI({ apiKey });

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: modelName,
        contents: [{ parts: [{ text: promptText }] }],
        // config: { temperature: 0.7 } // Example, if needed
    });
    
    return response.text;

  } catch (error: any) {
    console.error(`Error calling Gemini API via SDK (${modelName}) for ${instruction.filePath}:`, error);
    const errorMessage = error.message || "An unknown error occurred with the Gemini SDK.";
    // Prepend filepath and model to error message for better context
    throw new Error(`[${instruction.filePath} - ${modelName}] ${errorMessage}`);
  }
};
