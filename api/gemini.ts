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
// Note: ENABLE_DETAILED_LOGGING from constants.tsx is not directly importable here
// as this is a Vercel serverless function environment, separate from the frontend bundle.
// For serverless function debugging, rely on Vercel logs or temporarily uncomment logs.
const ENABLE_PROXY_DETAILED_LOGGING = process.env.ENABLE_PROXY_DETAILED_LOGGING === 'true' || false; // Control via env var for proxy

export default async function handler(
  req: MinimalNextApiRequest, 
  res: MinimalNextApiResponse<ProxyResponseData> 
) {
  if (ENABLE_PROXY_DETAILED_LOGGING) {
    console.log(`[API Proxy /api/gemini] Debug: Handler invoked. Method: ${req.method}`);
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    console.warn(`[API Proxy] Method Not Allowed: ${req.method}`);
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
  }

  const { prompt, modelName }: ProxyRequestPayload = req.body;
  if (ENABLE_PROXY_DETAILED_LOGGING) {
    console.log("[API Proxy] Debug: Received request body:", JSON.stringify(req.body, null, 2));
  }

  if (!prompt || !modelName) {
    console.warn("[API Proxy] Missing required parameters: prompt and/or modelName.");
    return res.status(400).json({ error: { message: 'Missing required parameters: prompt and modelName.' } });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const apiUrlFromEnv = process.env.GEMINI_API_URL;

  if (ENABLE_PROXY_DETAILED_LOGGING) {
    console.log(`[API Proxy] Debug: GEMINI_API_KEY found: ${!!apiKey}, Length > 0: ${!!apiKey && apiKey.length > 0}`);
    console.log(`[API Proxy] Debug: GEMINI_API_URL from env: ${apiUrlFromEnv || "Not set"}`);
  }

  if (!apiKey) {
    console.error('[API Proxy] Critical Error: GEMINI_API_KEY is not set in server environment.');
    return res.status(500).json({ error: { message: 'API key not configured on the server for the proxy.' } });
  }

  const sdkConfig: { apiKey: string; clientOptions?: { apiEndpoint: string } } = { apiKey };

  if (apiUrlFromEnv && apiUrlFromEnv.trim() !== "") {
    try {
      const parsedProxyUrl = new URL(apiUrlFromEnv.trim());
      if (parsedProxyUrl.hostname && parsedProxyUrl.hostname.toLowerCase() !== DEFAULT_GOOGLE_API_HOSTNAME.toLowerCase()) {
        sdkConfig.clientOptions = { apiEndpoint: parsedProxyUrl.hostname };
        if (ENABLE_PROXY_DETAILED_LOGGING) {
          console.log(`[API Proxy] Debug: Using custom API endpoint from GEMINI_API_URL: ${parsedProxyUrl.hostname}`);
        }
      } else {
        if (ENABLE_PROXY_DETAILED_LOGGING) {
          console.log("[API Proxy] Debug: GEMINI_API_URL is default Google endpoint or similar; using SDK default endpoint behavior.");
        }
      }
    } catch (e) {
      console.warn(`[API Proxy] Invalid GEMINI_API_URL in environment: "${apiUrlFromEnv}". Error: ${(e as Error).message}. Proxy falling back to default Google endpoint behavior.`);
    }
  } else {
    if (ENABLE_PROXY_DETAILED_LOGGING) {
      console.log("[API Proxy] Debug: GEMINI_API_URL not set or empty. Using SDK default Google API endpoint.");
    }
  }
  if (ENABLE_PROXY_DETAILED_LOGGING) {
    console.log("[API Proxy] Debug: SDK Config (API key omitted for security):", JSON.stringify({ clientOptions: sdkConfig.clientOptions }, null, 2));
  }
  
  try {
    const ai = new GoogleGenAI(sdkConfig);
    if (ENABLE_PROXY_DETAILED_LOGGING) {
      console.log(`[API Proxy] Debug: Calling Gemini SDK with model: ${modelName}`);
    }
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelName,
      contents: [{ parts: [{ text: prompt }] }],
    });
    if (ENABLE_PROXY_DETAILED_LOGGING) {
      console.log("[API Proxy] Debug: Received response from Gemini SDK.");
    }

    if (!response || typeof response.text !== 'string') { 
      console.warn('[API Proxy] Gemini API response via proxy was successful but did not contain valid text.', response);
      return res.status(500).json({ error: { message: 'Received an empty or invalid response from AI service via proxy.'} });
    }
    
    // A high-level success log for the proxy
    console.log(`[API Proxy] Successfully processed request for model ${modelName}.`);
    return res.status(200).json({ text: response.text });

  } catch (error: any) {
    console.error(`[API Proxy] Error calling Gemini API via proxy (model: ${modelName}):`, error.message, error.cause, error);
    const errorMessage = error.message || 'An unknown error occurred while contacting the AI service via proxy.';
    const errorStatus = error.status || 500; 
    return res.status(errorStatus).json({ error: { message: errorMessage, details: error.cause || error.toString() } });
  }
}
