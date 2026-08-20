const SYSTEM_PROMPT =
  "You are a frontend developer. Based on the user's description, " +
  "create a complete single-file HTML page (HTML + CSS, styles inside <style>). " +
  "The page will be shown inside a 600x800 (portrait) iframe and MUST fit into " +
  "600x800 exactly with NO scrollbars: set html,body { width:600px; height:800px; " +
  "margin:0; overflow:hidden } and design all content inside this fixed box — " +
  "use flex/grid with percentage or flexible sizes, never let content exceed " +
  "800px in height; if something does not fit, compress it instead of scrolling. " +
  "Return ONLY the HTML code, without markdown fences, comments or explanations.";

function stripCodeFences(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```[a-z0-9_-]*\s*\n([\s\S]*?)(?:\n)?```\s*$/i);
  if (fenced) return (fenced[1] ?? "").trim();
  const lines = trimmed.split("\n");
  if (lines[0]?.trim().startsWith("```")) lines.shift();
  if (lines[lines.length - 1]?.trim() === "```") lines.pop();
  return lines.join("\n").trim();
}

export type GenerateResult = { html: string } | { error: string };

export async function generateHtml(prompt: string): Promise<GenerateResult> {
  const apiKey = process.env["OPENAI_API_KEY"] || "";
  if (!apiKey) return { error: "OPENAI_API_KEY is not set in .env" };
  if (!prompt.trim()) return { error: "Prompt is empty" };

  const baseUrl = (process.env["AI_BASE_URL"] || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env["AI_MODEL"] || "gpt-4o-mini";

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { error: `AI request failed (${res.status}): ${body.slice(0, 200)}` };
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = stripCodeFences(data.choices?.[0]?.message?.content || "");
    return content ? { html: content } : { error: "AI returned empty content" };
  } catch (err) {
    return { error: `AI request error: ${err instanceof Error ? err.message : String(err)}` };
  }
}
