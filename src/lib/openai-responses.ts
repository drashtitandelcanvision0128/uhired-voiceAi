export function extractResponsesOutputText(payload: {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
}): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  const parts: string[] = [];
  for (const item of payload.output ?? []) {
    for (const block of item.content ?? []) {
      if (block.type === "output_text" && typeof block.text === "string" && block.text.trim()) {
        parts.push(block.text);
      }
    }
  }
  return parts.join("").trim();
}
