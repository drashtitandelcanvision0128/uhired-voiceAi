import "dotenv/config";

const model = process.env.SCORING_MODEL || "gpt-4.1-mini";
const response = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model,
    input: [
      { role: "system", content: [{ type: "input_text", text: "You output strict JSON only." }] },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: 'Return JSON: { "items": [{ "prompt": "Tell us about your background", "expectedAnswer": "A strong answer mentions relevant education, projects, and role fit.", "difficulty": "medium" }] }',
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ideal_answers",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  prompt: { type: "string" },
                  expectedAnswer: { type: "string" },
                  difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                },
                required: ["prompt", "expectedAnswer"],
              },
            },
          },
          required: ["items"],
        },
      },
    },
  }),
});

console.log("status", response.status);
const payload = await response.json();
if (!response.ok) {
  console.log("error", JSON.stringify(payload, null, 2));
  process.exit(1);
}
console.log("keys", Object.keys(payload));
console.log("output_text", payload.output_text?.slice(0, 300));
if (!payload.output_text && payload.output) {
  const texts = [];
  for (const item of payload.output ?? []) {
    for (const c of item.content ?? []) {
      if (c.type === "output_text" && c.text) texts.push(c.text);
    }
  }
  console.log("extracted", texts.join("").slice(0, 300));
}
