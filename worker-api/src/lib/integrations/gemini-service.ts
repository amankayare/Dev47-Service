import { getCloudflareContext } from "@opennextjs/cloudflare";

export const DEFAULT_SYSTEM_PROMPT = `You are a senior technical content writer and frontend engineer.

Your task is to transform raw technical content into a polished, production-ready HTML article that feels like a premium engineering blog post.

==================================================
PRIMARY OBJECTIVE
=================

Convert the provided raw content into:

* long-form educational content
* semantic HTML
* visually structured article layout
* developer-focused production-quality writing

The final article should:

* feel human-written
* avoid robotic phrasing
* maintain technical accuracy
* improve clarity and pacing
* preserve important engineering insights

==================================================
OUTPUT RULES
============

Return ONLY a single valid JSON object.

Do not include:

* markdown fences
* explanations
* comments
* text outside JSON

==================================================
EXPECTED JSON FIELDS (IN EXACT ORDER)
=====================================

The JSON response must contain these fields in this order:

* suggested_title
* suggested_excerpt
* reading_time_minutes
* suggested_tags
* suggested_quick_links
* html_content

==================================================
JSON FIELD REQUIREMENTS
=======================

suggested_title:

* SEO friendly
* engaging
* under 70 characters

suggested_excerpt:

* compelling summary
* 120-160 characters describing the core thesis of the article

reading_time_minutes:

* estimated using 200 wpm (typically 4-8 minutes)

suggested_tags:

* array of 3 to 6 lowercase technical tags (e.g. ["ai", "software-engineering", "architecture"])

suggested_quick_links:

* array of 2 to 4 objects with:
  * title: exact title of a major section or heading in the article
  * url: anchor hash in kebab-case format, e.g. "#introducing-decision-memory"

CRITICAL FOR QUICK LINKS AND HEADINGS:
* Every quick link MUST correspond to an actual <h2> or <section> in the html_content.
* You MUST give that <h2> or <section> the exact matching id attribute!
  Example: If a quick link has url: "#ai-agents-and-historical-context", then the heading in html_content MUST be:
  <h2 id="ai-agents-and-historical-context">AI Agents and Historical Context</h2>

html_content:

* must contain the complete, fully-finished HTML article
* length: comprehensive yet focused (1,200 to 2,000 words)
* CRITICAL: Always complete the entire article and close all tags properly. Never leave an article cut off or unfinished mid-sentence.
* Use clean semantic HTML without excessively bloated wrappers.

==================================================
STRICT HTML DESIGN SYSTEM
=========================

Use ONLY these approved HTML structures.

Root:
div.blog-content-container

Sections:
section

Hero:
div.hero-section

Info box:
div.info-box

Warning box:
div.warning-box

Feature grid:
div.feature-grid
div.feature-card

Accordion:
details.interactive-accordion
summary.accordion-title

Animated diagram:
div.animated-flow-diagram

Code:
pre > code

Typography:

* h1 for title
* h2 for major sections
* h3 for subsections

Do NOT:

* invent new class names
* use JavaScript
* use external libraries
* generate markdown
* create unnecessary wrapper divs

==================================================
HEADING ID RULES
================

Every h1, h2, and h3 must include a unique id.

Rules:

* lowercase only
* hyphen-separated
* maximum 3 meaningful words
* remove punctuation and symbols

Examples:

* react-server-components
* scaling-api-gateways

==================================================
CONTENT STYLE RULES
===================

Writing style should feel:

* conversational
* technically insightful
* practical
* modern
* developer-centric

Avoid:

* repetitive phrasing
* filler explanations
* generic introductions
* AI-sounding transitions

Prefer:

* production lessons
* architecture reasoning
* debugging insights
* real-world engineering examples
* practical tradeoffs

==================================================
CONTENT TRANSFORMATION RULES
============================

Do NOT summarize.

Instead:

* rewrite into a polished article
* reorganize ideas logically
* remove transcript repetition
* enrich weak explanations
* improve readability and pacing

==================================================
ARTICLE STRUCTURE
=================

1. Hero Section

* title
* strong opening hook
* concise introduction

2. Core Sections
   Each major section should include:

* h2 heading
* readable paragraphs
* one animated-flow-diagram

Optional additions:

* info-box
* warning-box
* feature-grid
* accordion
* code blocks

3. Final Section

* reflective conclusion
* concise takeaway
* one blockquote

==================================================
MINIMUM CONTENT REQUIREMENTS
============================

Minimum:

* 1500 words
* 5 headings
* 15 paragraphs
* 2 code blocks
* 2 info boxes
* 1 warning box
* 1 feature grid
* 1 accordion
* one animated-flow-diagram per major section

==================================================
FLOW DIAGRAM RULES
==================

Each major section must contain one SVG/CSS animated architecture diagram.

Requirements:

* pure SVG and CSS only
* no JavaScript
* architecture-focused
* visually understandable
* animated data movement
* scoped styles only

==================================================
COMPONENT USAGE RULES
=====================

Feature grids:

* comparisons
* tradeoffs
* framework analysis

Info boxes:

* best practices
* optimization tips
* engineering insights

Warning boxes:

* production mistakes
* anti-patterns
* scaling pitfalls

Accordions:

* FAQs
* deep dives
* debugging walkthroughs

Code blocks:

* only when educationally useful

==================================================
FINAL VALIDATION RULES
======================

Before generating output:

* ensure valid parsable JSON
* ensure escaped quotes
* ensure closed HTML tags
* ensure unique heading IDs
* ensure no markdown exists
* ensure all required sections exist
* ensure all minimum requirements are satisfied
`;

export class AiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigurationError";
  }
}

export class AiParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiParseError";
  }
}

export interface ConversionResult {
  html_content: string;
  suggested_title: string;
  suggested_excerpt: string;
  reading_time_minutes: number;
  suggested_quick_links: Array<{ title: string; url: string }>;
  suggested_tags: string[];
}

/**
 * Resiliently parses AI JSON output, repairing unescaped newlines/control chars,
 * truncated strings/brackets, and falling back to regex extraction if needed.
 */
function parseAiJsonOutput(raw: string): Record<string, unknown> {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // 1. Direct standard parse
  try {
    return JSON.parse(cleaned);
  } catch {
    // Continue to repair
  }

  // 2. Repair unescaped newlines/control characters inside JSON strings and close truncated output
  try {
    let inString = false;
    let escaped = false;
    let fixed = "";

    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
      if (escaped) {
        fixed += char;
        escaped = false;
        continue;
      }
      if (char === "\\") {
        fixed += char;
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        fixed += char;
        continue;
      }
      if (inString) {
        if (char === "\n") {
          fixed += "\\n";
          continue;
        }
        if (char === "\r") {
          fixed += "\\r";
          continue;
        }
        if (char === "\t") {
          fixed += "\\t";
          continue;
        }
      }
      fixed += char;
    }

    // If truncated while inside a string literal, close the string and object
    if (inString) {
      fixed += '"';
    }
    const trimmed = fixed.trim();
    if (!trimmed.endsWith("}")) {
      fixed = trimmed + "}";
    }

    return JSON.parse(fixed);
  } catch {
    // Continue to regex fallback
  }

  // 3. Regex extraction fallback
  const fallbackResult: Record<string, unknown> = {};

  const htmlMatch = cleaned.match(
    /"html_content"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"(?:suggested_|reading_|quick_|tags)|"$|"\s*\}|$)/
  );
  if (htmlMatch && htmlMatch[1]) {
    fallbackResult.html_content = htmlMatch[1]
      .replace(/\\"/g, '"')
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\r/g, "");
  }

  const titleMatch = cleaned.match(/"suggested_title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  if (titleMatch && titleMatch[1]) {
    fallbackResult.suggested_title = titleMatch[1].replace(/\\"/g, '"');
  }

  const excerptMatch = cleaned.match(/"suggested_excerpt"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  if (excerptMatch && excerptMatch[1]) {
    fallbackResult.suggested_excerpt = excerptMatch[1].replace(/\\"/g, '"');
  }

  const readingMatch = cleaned.match(/"reading_time_minutes"\s*:\s*(\d+)/);
  if (readingMatch && readingMatch[1]) {
    fallbackResult.reading_time_minutes = parseInt(readingMatch[1], 10);
  }

  const tagsMatch = cleaned.match(/"suggested_tags"\s*:\s*\[([\s\S]*?)\]/);
  if (tagsMatch && tagsMatch[1]) {
    try {
      fallbackResult.suggested_tags = JSON.parse(`[${tagsMatch[1]}]`);
    } catch {}
  }

  const linksMatch = cleaned.match(/"suggested_quick_links"\s*:\s*\[([\s\S]*?)\]/);
  if (linksMatch && linksMatch[1]) {
    try {
      fallbackResult.suggested_quick_links = JSON.parse(`[${linksMatch[1]}]`);
    } catch {}
  }

  if (typeof fallbackResult.html_content === "string" && fallbackResult.html_content.trim().length > 0) {
    return fallbackResult;
  }

  throw new AiParseError("AI returned an invalid JSON response and could not be parsed.");
}

export async function convertContentToHtml(
  rawText: string,
  customSystemPrompt?: string | null,
  apiKeyOverride?: string,
  modelOverride?: string,
): Promise<ConversionResult> {
  // Priority 1: explicitly injected key (from route handler which has direct env access)
  let apiKey: string | undefined = apiKeyOverride;
  let modelName: string = modelOverride || process.env.GEMINI_MODEL || "gemini-2.0-flash";

  if (!apiKey) {
    // Priority 2: globalThis cloudflare context (synchronous)
    try {
      const cloudflareEnv = (globalThis as any)[Symbol.for("__cloudflare-context__")]?.env;
      if (cloudflareEnv?.GEMINI_API_KEY) {
        apiKey = cloudflareEnv.GEMINI_API_KEY;
      }
      if (cloudflareEnv?.GEMINI_MODEL) {
        modelName = cloudflareEnv.GEMINI_MODEL;
      }
    } catch {
      // ignore
    }
  }

  if (!apiKey) {
    // Priority 3: getCloudflareContext async
    try {
      const ctx = await getCloudflareContext({ async: true });
      if (ctx?.env) {
        const cfEnv = ctx.env as any;
        if (cfEnv.GEMINI_API_KEY) {
          apiKey = cfEnv.GEMINI_API_KEY;
        }
        if (cfEnv.GEMINI_MODEL) {
          modelName = cfEnv.GEMINI_MODEL;
        }
      }
    } catch {
      // ignore
    }
  }

  // Priority 4: process.env (works for vars, not secrets)
  if (!apiKey) {
    apiKey = process.env.GEMINI_API_KEY;
  }

  if (!apiKey) {
    throw new AiConfigurationError("Gemini API key is not configured");
  }

  apiKey = apiKey.trim();
  modelName = (modelName || "gemini-2.0-flash").trim();

  const prompt = customSystemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const payload = {
    systemInstruction: {
      parts: [{ text: prompt }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: `Convert this content:\n\n${rawText}` }],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          suggested_title: { type: "STRING" },
          suggested_excerpt: { type: "STRING" },
          reading_time_minutes: { type: "INTEGER" },
          suggested_tags: {
            type: "ARRAY",
            items: { type: "STRING" },
          },
          suggested_quick_links: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                title: { type: "STRING" },
                url: { type: "STRING" },
              },
              required: ["title", "url"],
            },
          },
          html_content: { type: "STRING" },
        },
        required: [
          "suggested_title",
          "suggested_excerpt",
          "reading_time_minutes",
          "suggested_tags",
          "suggested_quick_links",
          "html_content",
        ],
      },
    },
  };

  let response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok && response.status === 404) {
    // Model not found on current version/name. Query available models to auto-recover.
    try {
      const modelsRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      if (modelsRes.ok) {
        const modelsData = (await modelsRes.json()) as {
          models?: Array<{
            name: string;
            supportedGenerationMethods?: string[];
          }>;
        };
        const available = (modelsData.models || [])
          .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
          .map((m) => m.name.replace(/^models\//, ""));

        // Prefer 2.5-flash, 2.0-flash, 1.5-flash-latest, any flash, then any gemini model
        const preferred =
          available.find((m) => m.includes("2.5-flash")) ||
          available.find((m) => m.includes("2.0-flash")) ||
          available.find((m) => m.includes("1.5-flash-latest")) ||
          available.find((m) => m.includes("flash") && !m.includes("exp")) ||
          available.find((m) => m.includes("flash")) ||
          available.find((m) => m.includes("gemini-2")) ||
          available.find((m) => m.includes("gemini-1.5")) ||
          available.find((m) => m.includes("gemini")) ||
          available[0];

        if (preferred && preferred !== modelName) {
          console.warn(`[gemini] Model '${modelName}' returned 404. Auto-switching to available model: '${preferred}'`);
          const retryEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${preferred}:generateContent?key=${apiKey}`;
          response = await fetch(retryEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
        }

        if (!response.ok) {
          const retryError = await response.text();
          throw new Error(
            `Gemini model '${modelName}' not found. Available models: [${available.join(
              ", "
            )}]. Response: ${retryError}`
          );
        }
      }
    } catch (fallbackErr: any) {
      if (fallbackErr?.message?.includes("Available models")) {
        throw fallbackErr;
      }
      // Continue to default error throw below
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const responseData = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const rawTextOutput =
    responseData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  const parsed = parseAiJsonOutput(rawTextOutput);

  if (typeof parsed.html_content !== "string") {
    throw new AiParseError("AI response missing required field: html_content");
  }

  return {
    html_content: parsed.html_content,
    suggested_title: typeof parsed.suggested_title === "string" ? parsed.suggested_title : "",
    suggested_excerpt: typeof parsed.suggested_excerpt === "string" ? parsed.suggested_excerpt : "",
    reading_time_minutes: Number(parsed.reading_time_minutes ?? 0),
    suggested_quick_links: Array.isArray(parsed.suggested_quick_links)
      ? (parsed.suggested_quick_links as Array<{ title: string; url: string }>)
      : Array.isArray(parsed.quick_links)
        ? (parsed.quick_links as Array<{ title: string; url: string }>)
        : [],
    suggested_tags: Array.isArray(parsed.suggested_tags)
      ? (parsed.suggested_tags as string[])
      : Array.isArray(parsed.tags)
        ? (parsed.tags as string[])
        : [],
  };
}
