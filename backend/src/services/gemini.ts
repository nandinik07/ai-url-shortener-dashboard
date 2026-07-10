/**
 * Service to generate optimized custom aliases using Gemini AI.
 * Uses gemini-2.5-flash-preview-09-2025 with Structured Outputs and Exponential Backoff.
 */
export interface AliasSuggestions {
  suggestions: string[];
}

export async function generateAIAliases(targetUrl: string, campaignTitle: string): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn("AI Alias: GEMINI_API_KEY is not configured. Falling back to programmatic suggestions.");
    return generateStaticFallback(targetUrl, campaignTitle);
  }

  const modelName = "gemini-2.5-flash-preview-09-2025";
  const systemPrompt = "You are an expert marketing campaign optimizer. Generate short, catchy, URL-safe aliases (words separated by dashes). Do not include any file extensions, query params, or symbols.";
  const userPrompt = `Target URL: ${targetUrl}. Campaign Title: ${campaignTitle}. Provide exactly 3 short, catchy custom alias recommendations.`;

  let delay = 1000;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              suggestions: {
                type: "ARRAY",
                items: { type: "STRING" },
                description: "Clean, URL-friendly lowercase words separated by dashes."
              }
            },
            required: ["suggestions"]
          }
        }
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
      }

      const result = (await response.json()) as any;
      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (rawText) {
        const parsed: AliasSuggestions = JSON.parse(rawText);
        if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
          return parsed.suggestions.map(s => sanitizeAlias(s)).filter(Boolean);
        }
      }
      throw new Error("Invalid response format from Gemini API");
    } catch (error: any) {
      console.warn(`AI Alias attempt ${attempt} failed: ${error.message}`);
      if (attempt === maxRetries) {
        console.error("AI Alias suggestions exhausted retry capacity. Returning fallbacks.");
        return generateStaticFallback(targetUrl, campaignTitle);
      }
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }

  return generateStaticFallback(targetUrl, campaignTitle);
}

/**
 * Sanitizes a string to make it URL-safe.
 */
function sanitizeAlias(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-")        // Replace spaces with dashes
    .replace(/-+/g, "-")          // Replace multiple dashes with single dash
    .substring(0, 30);            // Limit length
}

/**
 * Robust programmatic alias generator as a fallback.
 */
function generateStaticFallback(targetUrl: string, campaignTitle: string): string[] {
  const suggestions: string[] = [];

  // 1. From Campaign Title
  if (campaignTitle) {
    const cleanTitle = sanitizeAlias(campaignTitle);
    if (cleanTitle) {
      suggestions.push(cleanTitle);
      suggestions.push(`${cleanTitle}-promo`);
    }
  }

  // 2. From URL Hostname/Path
  try {
    const url = new URL(targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`);
    const hostParts = url.hostname.replace("www.", "").split(".");
    const mainDomain = hostParts[0];

    if (mainDomain) {
      const cleanPath = url.pathname !== "/" ? sanitizeAlias(url.pathname) : "";
      if (cleanPath) {
        suggestions.push(`${mainDomain}-${cleanPath}`);
      } else {
        suggestions.push(`${mainDomain}-deal`);
      }
    }
  } catch (e) {
    // Ignore invalid url parse errors in fallback
  }

  // Add default placeholders if suggestions are empty
  if (suggestions.length < 3) {
    suggestions.push("campaign-promo");
    suggestions.push("marketing-lnk");
    suggestions.push("exclusive-deal");
  }

  // Unique elements, limit to 3
  return [...new Set(suggestions)].slice(0, 3);
}
