
import { ParsedModificationInstruction, OperationType, GeminiApiResponse } from '../types';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { 
    LEVEL_2_PROMPT_TEMPLATE_HEADER,
    LEVEL_2_PROMPT_ORIGINAL_CONTENT_SECTION,
    LEVEL_2_PROMPT_MODIFICATION_DETAILS_SECTION,
    LEVEL_2_PROMPT_FOOTER,
    DEFAULT_USER_API_URL, // Import for comparison
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
  modelName: string,
  userApiKey?: string, 
  userApiUrl?: string  
): Promise<string | null> => {
  const promptText = constructLevel2Prompt(instruction);
  
  if (userApiKey && userApiKey.trim() !== "") {
    // Mode 1: User provided an API key, make direct client-side call
    console.log(`Using user-provided API key for direct call to ${instruction.filePath}`);
    try {
      const sdkConfig: { apiKey: string; clientOptions?: { apiEndpoint: string } } = { apiKey: userApiKey };

      if (userApiUrl && userApiUrl.trim() !== "" && userApiUrl.trim().toLowerCase() !== DEFAULT_USER_API_URL.toLowerCase()) {
        try {
          const parsedUserUrl = new URL(userApiUrl.trim());
          const defaultGoogleHostname = new URL(DEFAULT_USER_API_URL).hostname;

          if (parsedUserUrl.hostname !== defaultGoogleHostname) {
            sdkConfig.clientOptions = { apiEndpoint: parsedUserUrl.hostname };
            console.log(`Using custom API endpoint for user's key: ${parsedUserUrl.hostname}`);
          } else {
             console.log("User API URL is the default Google endpoint or a variation; no custom clientOptions.apiEndpoint needed for direct SDK call.");
          }
        } catch (e) {
          console.warn(`Invalid custom API URL provided: "${userApiUrl}". Error: ${(e as Error).message}. Falling back to default Google endpoint behavior for user's key.`);
          // Potentially throw error or alert if URL is malformed and critical
           throw new Error(`[${instruction.filePath} - ${modelName}] Invalid API URL: ${userApiUrl}. Please correct it or use the default.`);
        }
      } else {
         console.log("Using default Google endpoint for user's key (no custom API URL or it matches default).");
      }
      
      const ai = new GoogleGenAI(sdkConfig);
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: modelName,
        contents: [{ parts: [{ text: promptText }] }],
      });

      if (!response || typeof response.text !== 'string') { // Check if text is a string
        console.warn(`Direct Gemini API response for ${instruction.filePath} was successful but did not contain valid text.`, response);
        throw new Error(`[${instruction.filePath} - ${modelName}] Received an invalid or empty text response from direct API call.`);
      }
      return response.text;

    } catch (error: any) {
      console.error(`Error making direct Gemini API call for ${instruction.filePath} (model ${modelName}):`, error);
      const errorMessage = error.message || "An unknown error occurred during direct API call.";
      throw new Error(`[${instruction.filePath} - ${modelName}] ${errorMessage}`);
    }

  } else {
    // Mode 2: No user API key, use the backend proxy
    console.log(`Using backend proxy for ${instruction.filePath}`);
    try {
        const response = await fetch('/api/gemini', { 
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            prompt: promptText,
            modelName: modelName,
        }),
        });

        const responseData: GeminiApiResponse = await response.json();

        if (!response.ok) {
        const errorMsg = responseData.error?.message || `Error from proxy: ${response.status} ${response.statusText}`;
        console.error(`Error calling Gemini API via proxy for ${instruction.filePath} (model ${modelName}): ${errorMsg}`, responseData.error?.details);
        throw new Error(`[${instruction.filePath} - ${modelName}] ${errorMsg}`);
        }
        
        if (responseData && typeof responseData.text === 'string') {
            return responseData.text;
        } else {
            console.warn(`Proxy response for ${instruction.filePath} (model ${modelName}) was successful but did not contain text.`, responseData);
            throw new Error(`[${instruction.filePath} - ${modelName}] Received an invalid or empty text response from the proxy.`);
        }

    } catch (error: any) {
        console.error(`Network or parsing error when calling proxy for ${instruction.filePath} (model ${modelName}):`, error);
        const errorMessage = error.message || "An unknown network or parsing error occurred.";
        throw new Error(`[${instruction.filePath} - ${modelName}] ${errorMessage}`);
    }
  }
};