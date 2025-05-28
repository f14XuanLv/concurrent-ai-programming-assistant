
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Using local minimal interfaces instead of importing from 'next'
// to avoid dependency issues in non-Next.js environments.

interface ProxyRequestPayload {
  prompt: string;
  modelName: string;
  // Add any other parameters the AI SDK might need, e.g., temperature, topK
}

interface ProxyResponseData {
  text?: string;
  error?: { message: string; status?: number, details?: any };
}

/**
 * Minimal local interface for NextApiRequest to avoid direct 'next' dependency.
 */
interface MinimalNextApiRequest {
  method?: string;
  body: ProxyRequestPayload; // Using the existing ProxyRequestPayload
}

/**
 * Minimal local interface for NextApiResponse to avoid direct 'next' dependency.
 * @template T The type of the response body for the json method.
 */
interface MinimalNextApiResponse<T> {
  setHeader(name: string, value: string | string[]): MinimalNextApiResponse<T>;
  status(statusCode: number): MinimalNextApiResponse<T>;
  json(body: T): MinimalNextApiResponse<T>; // Or void, but chaining is common
}

const DEFAULT_GOOGLE_API_HOSTNAME = "generativelanguage.googleapis.com";

export default async function handler(
  req: MinimalNextApiRequest, 
  res: MinimalNextApiResponse<ProxyResponseData> 
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
  }

  const { prompt, modelName }: ProxyRequestPayload = req.body;

  if (!prompt || !modelName) {
    return res.status(400).json({ error: { message: 'Missing required parameters: prompt and modelName.' } });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const apiUrlFromEnv = process.env.GEMINI_API_URL;

  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set in server environment.');
    return res.status(500).json({ error: { message: 'API key not configured on the server for the proxy.' } });
  }

  const sdkConfig: { apiKey: string; clientOptions?: { apiEndpoint: string } } = { apiKey };

  if (apiUrlFromEnv && apiUrlFromEnv.trim() !== "") {
    try {
      const parsedProxyUrl = new URL(apiUrlFromEnv.trim());
      if (parsedProxyUrl.hostname && parsedProxyUrl.hostname.toLowerCase() !== DEFAULT_GOOGLE_API_HOSTNAME.toLowerCase()) {
        sdkConfig.clientOptions = { apiEndpoint: parsedProxyUrl.hostname };
        console.log(`Backend proxy using custom API endpoint: ${parsedProxyUrl.hostname}`);
      } else {
        console.log("Backend proxy using default Google API endpoint (GEMINI_API_URL is default or similar).");
      }
    } catch (e) {
      console.warn(`Invalid GEMINI_API_URL in environment: "${apiUrlFromEnv}". Error: ${(e as Error).message}. Proxy falling back to default Google endpoint behavior.`);
      // Do not throw, let SDK use its default if URL is malformed
    }
  } else {
    console.log("Backend proxy using default Google API endpoint (GEMINI_API_URL not set).");
  }
  
  try {
    const ai = new GoogleGenAI(sdkConfig);
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelName,
      contents: [{ parts: [{ text: prompt }] }],
      // config: { temperature: 0.7 } // Example, pass from client if needed
    });

    if (!response || typeof response.text !== 'string') { // Check if text is a string
      console.warn('Gemini API response via proxy was successful but did not contain valid text.', response);
      return res.status(500).json({ error: { message: 'Received an empty or invalid response from AI service via proxy.'} });
    }
    
    return res.status(200).json({ text: response.text });

  } catch (error: any) {
    console.error(`Error calling Gemini API via proxy (model: ${modelName}):`, error);
    const errorMessage = error.message || 'An unknown error occurred while contacting the AI service via proxy.';
    const errorStatus = error.status || 500; 
    return res.status(errorStatus).json({ error: { message: errorMessage, details: error.cause } });
  }
}
