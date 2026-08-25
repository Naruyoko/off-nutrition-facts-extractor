import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { ExtractionSchema, INPUT_SET_IDS, extractionJsonSchema } from './src/types';
import { z } from 'zod';
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import dns from "dns";
import ipaddr from "ipaddr.js";
import fs from "fs";
import { rateLimit } from "express-rate-limit";

const {version: APP_VERSION, author: {email: APP_AUTHOR_EMAIL}} = JSON.parse(fs.readFileSync(new URL("./package.json", import.meta.url), "utf-8"));

dotenv.config();

const app = express();
const PORT = 3000;

// Enable trust proxy for rate limiting (needed for Cloud Run/proxies)
app.set('trust proxy', 1);

// Rate limiter for the extraction endpoint
const extractionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 10, // Limit each IP to 10 requests per window
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many extraction requests from this IP, please try again after 5 minutes." },
});

const APP_IDENTITY_NAME = "OFFNutritionFactsExtractor";
const APP_USER_AGENT = `${APP_IDENTITY_NAME}/${APP_VERSION} (${APP_AUTHOR_EMAIL})`;

/**
 * Validates a URL and its resolved IP addresses to prevent SSRF.
 */
async function validateImageUrl(urlStr: string) {
  const url = new URL(urlStr);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Invalid protocol. Only http: and https: are allowed.");
  }
  
  const { address } = await dns.promises.lookup(url.hostname);
  const parsedIp = ipaddr.parse(address);
  if (parsedIp.range() !== 'unicast') {
    throw new Error(`Access to private or reserved IP range is blocked: ${address} (${parsedIp.range()})`);
  }
}

// Increase payload limit for base64 image uploads
app.use(express.json({ limit: "20mb" }));

// Initialize Gemini client lazily/safely
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Fetch and parse OFF nutrients taxonomy file from GitHub
let cachedNutrientTags: Record<string, Record<string, string[]>> = {};
let lastFetchTime = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

async function getNutrientTaxonomyTags(): Promise<Record<string, Record<string, string[]>>> {
  const now = Date.now();
  if (Object.keys(cachedNutrientTags).length > 0 && now - lastFetchTime < CACHE_DURATION) {
    return cachedNutrientTags;
  }

  try {
    const res = await fetch("https://raw.githubusercontent.com/openfoodfacts/openfoodfacts-server/main/taxonomies/nutrients.txt", {
      headers: {
        "User-Agent": APP_USER_AGENT,
        "Accept": "text/plain, */*"
      },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const text = await res.text();
      const lines = text.split("\n");
      const tags: Record<string, Record<string, string[]>> = {};
      let currentKey = "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        if (trimmed.startsWith("zz:")) {
          currentKey = trimmed.substring(3).trim();
          if (!tags[currentKey]) tags[currentKey] = {};
        } else if (currentKey && trimmed.includes(":")) {
          const colonIndex = trimmed.indexOf(":");
          const lang = trimmed.substring(0, colonIndex).trim();
          const namesRaw = trimmed.substring(colonIndex + 1).trim();

          const names = [];
          let currentName = "";
          let escaped = false;
          for (let i = 0; i < namesRaw.length; i++) {
            const char = namesRaw[i];
            if (escaped) {
              currentName += char;
              escaped = false;
            } else if (char === '\\') {
              escaped = true;
            } else if (char === ',') {
              names.push(currentName.trim());
              currentName = "";
            } else {
              currentName += char;
            }
          }
          names.push(currentName.trim());

          tags[currentKey][lang] = names;
        }
      }

      if (Object.keys(tags).length > 0) {
        cachedNutrientTags = tags;
        lastFetchTime = now;
        return cachedNutrientTags;
      }
    }
  } catch (err) {
    console.error("Failed to fetch OFF nutrients taxonomy from GitHub, using fallback list:", err);
  }

  // Fallback map if fetch fails
  return {
    "energy-kcal": { "en": ["Energy (kcal)"] },
    "energy-kj": { "en": ["Energy (kJ)"] },
    "fat": { "en": ["Fat"] },
    "saturated-fat": { "en": ["Saturated fat"] },
    "carbohydrates": { "en": ["Carbohydrates"] },
    "sugars": { "en": ["Sugars"] },
    "fiber": { "en": ["Fiber"] },
    "proteins": { "en": ["Proteins"] },
    "salt": { "en": ["Salt"] },
    "sodium": { "en": ["Sodium"] },
  };
}

// Endpoint to fetch taxonomy keys
app.get("/api/taxonomy-keys", async (req, res) => {
  try {
    const tags = await getNutrientTaxonomyTags();
    res.json({ tags });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch taxonomy keys" });
  }
});

// Health check route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Primary route for extracting nutrition facts from image URL or base64
app.post("/api/extract-nutrition", extractionLimiter, async (req, res) => {
  try {
    const { imageUrl, imageBase64, mimeType, model } = req.body || {};

    if (!imageUrl && !imageBase64) {
      return res.status(400).json({ error: "Please provide either an image URL or image data." });
    }

    const allowedModels = [
      "gemini-3.6-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.5-flash",
    ];
    const modelToUse = allowedModels.includes(model) ? model : "gemini-3.6-flash";

    let finalBase64 = "";
    let finalMimeType = mimeType || "image/jpeg";

    if (imageBase64) {
      // Direct base64 string
      if (imageBase64.includes(";base64,")) {
        const parts = imageBase64.split(";base64,");
        const header = parts[0];
        finalBase64 = parts[1];
        if (header.includes(":")) {
          finalMimeType = header.split(":")[1];
        }
      } else {
        finalBase64 = imageBase64;
      }
    } else if (imageUrl) {
      // Handle data URL directly if passed as URL
      if (imageUrl.startsWith("data:")) {
        const parts = imageUrl.split(";base64,");
        const header = parts[0];
        finalBase64 = parts[1];
        if (header.includes(":")) {
          finalMimeType = header.split(":")[1];
        }
      } else {
        // Fetch image from URL
        try {
          // SSRF Protection: Validate URL and IP
          await validateImageUrl(imageUrl);

          // Prepare headers for proxy request
          const clientUA = req.get("user-agent") || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

          const proxyHeaders: Record<string, string> = {
            "User-Agent": `${clientUA} (Via ${APP_USER_AGENT})`,
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            "X-Forwarded-For": (req.headers["x-forwarded-for"] as string) || req.ip || "",
            "Via": `1.1 ${APP_IDENTITY_NAME}`
          };

          // Pass through Client Hints to help origin serve optimized assets
          ["sec-ch-ua", "sec-ch-ua-mobile", "sec-ch-ua-platform"].forEach(hint => {
            const val = req.get(hint);
            if (val) proxyHeaders[hint] = val;
          });

          // Fetch with timeout and redirect: 'error' to prevent redirect bypasses
          const imageRes = await fetch(imageUrl, {
            headers: proxyHeaders,
            signal: AbortSignal.timeout(20000), // 20 second timeout for image fetch
            redirect: 'error',
          });

          if (!imageRes.ok) {
            return res.status(400).json({
              error: `Unable to download image from provided URL (HTTP ${imageRes.status}: ${imageRes.statusText}). Please check the URL or upload the image directly.`
            });
          }

          const contentType = imageRes.headers.get("content-type");
          if (contentType && contentType.startsWith("image/")) {
            finalMimeType = contentType.split(";")[0];
          }

          const arrayBuffer = await imageRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          finalBase64 = buffer.toString("base64");
        } catch (fetchErr: any) {
          console.error("Error fetching image URL:", fetchErr);
          const errorMessage = fetchErr.name === 'AbortError' 
            ? "Image fetch timed out." 
            : (fetchErr.message || "Network error or connection timeout");
          
          return res.status(400).json({
            error: `Failed to fetch image URL: ${errorMessage}. Try uploading the image file instead.`
          });
        }
      }
    }

    if (!finalBase64) {
      return res.status(400).json({ error: "Could not retrieve image data to process." });
    }

    const ai = getGeminiClient();

    const imagePart = {
      inlineData: {
        mimeType: finalMimeType,
        data: finalBase64,
      },
    };

    // Helper for timeout
    const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
        ),
      ]);
    };

    // Step 1: Detect Language
    const languageDetectionPrompt = "Analyze this nutrition label photo and identify its primary language. If the label contains no text, respond with '-'. Otherwise, respond with ONLY the two-letter ISO 639-1 language code (e.g., 'en', 'fr', 'ja', 'es').";
    const languageResponse = await withTimeout(
      ai.models.generateContent({
        model: modelToUse,
        contents: {
          parts: [imagePart, { text: languageDetectionPrompt }],
        },
      }),
      15000,
      "Language detection"
    );

    const detectedLanguage = languageResponse.text?.trim();

    if (detectedLanguage == "-") {
      return res.json({
        success: false,
        error: "No text detected",
        languageDetectionPrompt: languageDetectionPrompt,
        languageDetectionResponse: languageResponse.text,
      });
    }

    if (!/^[a-z]{2}$/.test(detectedLanguage)) {
      return res.json({
        success: false,
        error: `Received invalid language: ${detectedLanguage}`,
        languageDetectionPrompt: languageDetectionPrompt,
        languageDetectionResponse: languageResponse.text,
      });
    }

    // Step 2: Extraction
    const nutrientTags = await getNutrientTaxonomyTags();

    // Prepare taxonomy list with names for the main prompt
    const taxonomyListStr = Object.keys(nutrientTags).map(tag => {
      const name = nutrientTags[tag][detectedLanguage] || nutrientTags[tag]['en'];
      return ` - '${tag}' (Common names: ${name})`;
    }).join("\n");

    const extractionPrompt = `Analyze this nutrition label photo in high detail for a label primarily in ${detectedLanguage}. Extract all nutrition facts formatted for the Open Food Facts database.
Carefully read every line, value, unit, serving size, and footnote.

CRITICAL RULES:
- Never calculate, estimate, or interpolate unprinted values. If "per 100g" or "per 100ml" values are not explicitly printed on the label, do not compute them.
- In the 'values' object, include ONLY keys that are explicitly printed on the label (${INPUT_SET_IDS.map(s => `'${s}'`).join(', ')}). For example, if a label only provides values per serving, do not include 'as_sold_100g'.
- Map column amounts to their exact corresponding keys. Never place liquid/volume ('per 100ml') values into weight ('as_sold_100g') fields.
- For 'servingSize':
  - If the reference basis is "per 100g", "per 100ml", or "per 1l" (or language equivalents) without a specific serving size, return an empty string "".
  - Preserve exact spacing as printed on the label (e.g., "30g", "240 ml (8 fl oz)", "1 bar (45g)", "1包装").
  - Omit prepositions or phrases meaning "per" (e.g., "per", "por", "par", "pro", "あたり").
- Preserve verbatim text in 'values': Include symbols, prefixes, ranges, and text exactly as printed (e.g., "12.5", "0", "< 0.5", "0~0.3", "less than 1", "trace", "approx. 5"). CRITICAL: DO NOT normalize or simplify values (e.g., never convert "less than 1" to "1" or "0"). CRITICAL: DO NOT include units in these strings.
- VISUAL & ORDERING DISCIPLINE:
  - Do not assume nutrients are listed in any conventional or standard order. Rely solely on the visual layout of the provided photo.
  - Only extract a nutrient if its name is clearly, legibly visible in the photo. If a nutrient name is not clearly visible, place it in 'unrecognizedNutrients'.
  - Do not guess, infer, or hallucinate nutrients that are not plainly written.
- STRICT TAXONOMY MATCHING:
  - The 'key' in 'nutrients' MUST be an exact match from the taxonomy list below. Do not guess or invent keys.
  - If a nutrient does not match any taxonomy key exactly, place it in 'unrecognizedNutrients'. If a taxonomy key is a plausible close match, include it in 'suggestedKey'; otherwise, omit 'suggestedKey'.
- Differentiate related or easily confused nutrients without conflation:
  - Distinctly identify: 'Carbohydrates' (total), 'Fiber', 'Sugars', 'Added sugars', 'Starch', and 'Polyols'.
  - If "Fiber" is listed or indented under "Carbohydrates", do not assume "Carbohydrates" excludes fiber unless explicitly stated.
  - Strictly differentiate between 'Folates' and 'Folic acid'.

SCHEMA SPECIFICATIONS:
- servingSize: Extracted serving size string, or "" if none.
- detectedLanguage: Must be "${detectedLanguage}".
- confidenceScore: Number from 0.0 to 1.0 representing overall OCR and reading confidence.
- nutrients: Array of extracted nutrients matching the Open Food Facts taxonomy:
${taxonomyListStr}
- unrecognizedNutrients: Array of nutrients not found in the taxonomy list above.

FIELD DEFINITIONS PER NUTRIENT:
- key: (Recognized nutrients only) Exact taxonomy key.
- printedName: Name exactly as printed on the label.
- suggestedKey: (Unrecognized nutrients only) Suggested taxonomy key if a plausible match exists.
- values: Record mapping applicable InputSetIds (${INPUT_SET_IDS.map(s => `'${s}'`).join(', ')}) to verbatim strings. Only include keys present on the label. CRITICAL: DO NOT include units in these strings.
- unit: Standard unit ('g', 'mg', 'µg', 'kcal', 'kJ', 'IU', '% DV'). Ensure this is the ONLY place where units are extracted.
- confidence: 'high', 'medium', or 'low'. Readily lower confidence if affected by glare, folds, curved surfaces, obstructions, cutoffs, or low resolution. Reserve 'high' confidence for clear, unobstructed text.
- note: Footnotes, asterisked explanations, or calculation notes if applicable.
`;
    //TODO: Discuss how "Not a significant source of <nutrients>" should be handled on Slack. Currently, the LLM seems to default to not listing them. That is better than polluting the database with bad decisions now, though.

    const extractionResponse = await withTimeout(
      ai.models.generateContent({
        model: modelToUse,
        contents: {
          parts: [imagePart, { text: extractionPrompt }],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: extractionJsonSchema.toJSONSchema(),
        },
      }),
      60000,
      "Extraction"
    );

    const jsonText = extractionResponse.text;

    let parsedData: ExtractionSchema;
    try {
      parsedData = extractionJsonSchema.parse(JSON.parse(jsonText));
    } catch (parseErr) {
      if (parseErr instanceof z.ZodError) {
        return res.json({
          success: false,
          error: `JSON Schema validation failed: ${JSON.stringify(parseErr.issues)}`,
          languageDetectionPrompt: languageDetectionPrompt,
          languageDetectionResponse: languageResponse.text,
          extractionPrompt: extractionPrompt,
          extractionResponse: extractionResponse.text,
        });
      }
      return res.json({
        success: false,
        error: `JSON parse error from Gemini output: ${parseErr.message}`,
        languageDetectionPrompt: languageDetectionPrompt,
        languageDetectionResponse: languageResponse.text,
        extractionPrompt: extractionPrompt,
        extractionResponse: extractionResponse.text,
      });
    }

    if (detectedLanguage != parsedData.detectedLanguage) {
      return res.json({
        success: false,
        error: `A different label language was returned: ${detectedLanguage}, ${parsedData.detectedLanguage}`,
        languageDetectionPrompt: languageDetectionPrompt,
        languageDetectionResponse: languageResponse.text,
        extractionPrompt: extractionPrompt,
        extractionResponse: extractionResponse.text,
      });
    }

    return res.json({
      success: true,
      languageDetectionPrompt,
      languageDetectionResponse: languageResponse.text,
      extractionPrompt,
      extractionResponse: extractionResponse.text,
      data: parsedData,
    });
  } catch (error: any) {
    console.error("Error in /api/extract-nutrition:", error);
    return res.status(500).json({
      error: error.message || "An error occurred while extracting nutrition data.",
    });
  }
});

// Ensure any unhandled /api route returns JSON 404 instead of HTML fallback
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
});

// Custom JSON error handler middleware so Express errors respond with JSON, never HTML
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled Express error:", err);
  res.status(err.status || 500).json({
    error: err.message || "An unexpected server error occurred.",
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
