import { ParsedModificationInstruction, OperationType, GeminiApiResponse } from '../types';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { 
    LEVEL_2_PROMPT_TEMPLATE_HEADER,
    LEVEL_2_PROMPT_ORIGINAL_CONTENT_SECTION,
    LEVEL_2_PROMPT_MODIFICATION_DETAILS_SECTION,
    LEVEL_2_PROMPT_FOOTER,
    DEFAULT_USER_API_URL, // Import for comparison
    ENABLE_DETAILED_LOGGING, // Import the flag
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
  if (ENABLE_DETAILED_LOGGING) {
    console.log(`[GeminiService] Debug: callGeminiApi for ${instruction.filePath}, model: ${modelName}. User API Key Provided: ${!!userApiKey}, User API URL: ${userApiUrl || 'Not provided'}`);
  }
  
  if (userApiKey && userApiKey.trim() !== "") {
    if (ENABLE_DETAILED_LOGGING) {
      console.log(`[GeminiService] Debug: Operating in DIRECT CLIENT-SIDE CALL Mode for ${instruction.filePath}.`);
    }
    try {
      const sdkConfig: { apiKey: string; clientOptions?: { apiEndpoint: string } } = { apiKey: userApiKey };

      if (userApiUrl && userApiUrl.trim() !== "" && userApiUrl.trim().toLowerCase() !== DEFAULT_USER_API_URL.toLowerCase()) {
        try {
          const parsedUserUrl = new URL(userApiUrl.trim());
          const defaultGoogleHostname = new URL(DEFAULT_USER_API_URL).hostname;

          if (parsedUserUrl.hostname !== defaultGoogleHostname) {
            sdkConfig.clientOptions = { apiEndpoint: parsedUserUrl.hostname };
            if (ENABLE_DETAILED_LOGGING) {
              console.log(`[GeminiService] Debug: Using custom API endpoint for user's key: ${parsedUserUrl.hostname}. SDK Config:`, JSON.stringify(sdkConfig));
            }
          } else {
            if (ENABLE_DETAILED_LOGGING) {
             console.log("[GeminiService] Debug: User API URL is the default Google endpoint or a variation; no custom clientOptions.apiEndpoint needed for direct SDK call.");
            }
          }
        } catch (e) {
          console.warn(`[GeminiService] Invalid custom API URL provided: "${userApiUrl}". Error: ${(e as Error).message}. Falling back to default Google endpoint behavior for user's key.`);
           throw new Error(`[${instruction.filePath} - ${modelName}] Invalid API URL: ${userApiUrl}. Please correct it or use the default.`);
        }
      } else {
        if (ENABLE_DETAILED_LOGGING) {
         console.log("[GeminiService] Debug: Using default Google endpoint for user's key (no custom API URL or it matches default). SDK Config:", JSON.stringify(sdkConfig));
        }
      }
      
      const ai = new GoogleGenAI(sdkConfig);
      if (ENABLE_DETAILED_LOGGING) {
        console.log(`[GeminiService] Debug: Making direct call to Gemini for ${instruction.filePath} with model ${modelName}.`);
      }
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: modelName,
        contents: [{ parts: [{ text: promptText }] }],
      });
      if (ENABLE_DETAILED_LOGGING) {
        console.log(`[GeminiService] Debug: Direct call response for ${instruction.filePath}:`, response);
      }

      if (!response || typeof response.text !== 'string') { 
        console.warn(`[GeminiService] Direct Gemini API response for ${instruction.filePath} was successful but did not contain valid text.`, response);
        throw new Error(`[${instruction.filePath} - ${modelName}] Received an invalid or empty text response from direct API call.`);
      }
      return response.text;

    } catch (error: any) {
      console.error(`[GeminiService] Error making direct Gemini API call for ${instruction.filePath} (model ${modelName}):`, error.message, error.cause, error);
      const errorMessage = error.message || "An unknown error occurred during direct API call.";
      throw new Error(`[${instruction.filePath} - ${modelName}] ${errorMessage}`);
    }

  } else {
    if (ENABLE_DETAILED_LOGGING) {
      console.log(`[GeminiService] Debug: Operating in BACKEND PROXY CALL Mode for ${instruction.filePath}.`);
    }
    const proxyRequestBody = {
        prompt: promptText,
        modelName: modelName,
    };
    if (ENABLE_DETAILED_LOGGING) {
      console.log(`[GeminiService] Debug: Sending request to backend proxy /api/gemini for ${instruction.filePath}. Body:`, JSON.stringify(proxyRequestBody, null, 2));
    }

    try {
        const response = await fetch('/api/gemini', { 
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(proxyRequestBody),
        });

        if (!response.ok) {
          const rawTextError = await response.text(); // Get raw response text FIRST
          // This console.error is important for diagnosing proxy issues, so it remains.
          console.error(`[GeminiService] Proxy call for ${instruction.filePath} (model ${modelName}) FAILED. Status: ${response.status} ${response.statusText}. Raw Response from Proxy: ${rawTextError}`);
          
          let errorMsg = `Error from proxy: ${response.status} ${response.statusText}`;
          let errorDetails = null;
          try {
            const responseData: GeminiApiResponse = JSON.parse(rawTextError); 
            errorMsg = responseData.error?.message || errorMsg; 
            errorDetails = responseData.error?.details;
          } catch (e) {
            console.warn("[GeminiService] Failed to parse proxy error response as JSON. Using raw text as error message.", e);
            errorMsg = rawTextError || errorMsg; 
          }
          if (ENABLE_DETAILED_LOGGING) {
            console.error(`[GeminiService] Debug: Final error message from proxy for ${instruction.filePath}: ${errorMsg}`, errorDetails);
          }
          throw new Error(`[${instruction.filePath} - ${modelName}] ${errorMsg}`);
        }
        
        const responseData: GeminiApiResponse = await response.json();
        if (ENABLE_DETAILED_LOGGING) {
          console.log(`[GeminiService] Debug: Proxy response for ${instruction.filePath} (model ${modelName}):`, responseData);
        }
        
        if (responseData && typeof responseData.text === 'string') {
            return responseData.text;
        } else {
            console.warn(`[GeminiService] Proxy response for ${instruction.filePath} (model ${modelName}) was successful but did not contain text.`, responseData);
            throw new Error(`[${instruction.filePath} - ${modelName}] Received an invalid or empty text response from the proxy.`);
        }

    } catch (error: any) {
        // This catch block handles network errors for the fetch call itself, or errors from the 'throw new Error' above.
        console.error(`[GeminiService] Network or parsing error when calling proxy for ${instruction.filePath} (model ${modelName}):`, error.message, error);
        const errorMessage = error.message.startsWith(`[${instruction.filePath} - ${modelName}]`) 
          ? error.message 
          : `[${instruction.filePath} - ${modelName}] ${error.message || "An unknown network or parsing error occurred."}`;
        throw new Error(errorMessage);
    }
  }
};