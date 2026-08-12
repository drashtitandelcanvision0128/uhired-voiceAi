/**
 * Simulates candidate STT commit races that produce blank/missing answers.
 * Run: node scripts/test-interview-transcript-capture.mjs
 */
import assert from "node:assert/strict";

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    throw error;
  }
}

/**
 * Buggy model: drops transcription.completed when item gen < current gen,
 * and finish tears down before pending Whisper events arrive.
 */
function simulateBuggyCapture(events) {
  let gen = 0;
  const itemGen = new Map();
  const transcript = [];
  let channelOpen = true;
  let pendingOrder = null;
  let nextOrder = 0;

  const commit = (text, itemId) => {
    const clean = String(text ?? "").trim();
    if (!clean) return;
    transcript.push({ itemId, text: clean, orderIndex: pendingOrder ?? nextOrder++ });
    pendingOrder = null;
  };

  for (const event of events) {
    if (event.type === "speech_started") {
      gen += 1;
      if (event.itemId) itemGen.set(event.itemId, gen);
      pendingOrder = nextOrder++;
    }
    if (event.type === "speech_stopped") {
      if (event.itemId) itemGen.set(event.itemId, gen);
    }
    if (event.type === "transcription.completed") {
      if (!channelOpen) continue;
      const g = event.itemId ? itemGen.get(event.itemId) : undefined;
      if (g != null && g < gen) continue; // bug: drop late Whisper
      if (!event.transcript) continue;
      commit(event.transcript, event.itemId);
    }
    if (event.type === "finish") {
      channelOpen = false; // bug: tear down immediately
    }
  }
  return transcript.map((t) => t.text);
}

/**
 * Fixed model: always commit completed Whisper text (with per-item order),
 * and keep the channel open until pending stopped utterances settle or timeout.
 */
function simulateFixedCapture(events, { finishWaitMs = 4000 } = {}) {
  let gen = 0;
  let now = 0;
  const itemMeta = new Map(); // itemId -> { gen, orderIndex, startMs }
  const unsettledGens = new Set();
  const transcript = [];
  const appended = new Set();
  let channelOpen = true;
  let nextOrder = 0;
  let pendingOrder = null;
  let pendingStartMs = null;
  /** When set, channel stays open until unsettled clears or this timestamp. */
  let finishDeadline = null;

  const settleGen = (g) => {
    if (g != null) unsettledGens.delete(g);
  };

  const maybeCloseAfterFinishWait = () => {
    if (finishDeadline == null) return;
    if (unsettledGens.size === 0 || now >= finishDeadline) {
      channelOpen = false;
      unsettledGens.clear();
      finishDeadline = null;
    }
  };

  const commit = (text, itemId) => {
    const clean = String(text ?? "").trim();
    if (!clean) return;
    const dedupeKey = itemId ?? `candidate:${clean}`;
    if (appended.has(dedupeKey)) return;
    appended.add(dedupeKey);
    const meta = itemId ? itemMeta.get(itemId) : undefined;
    const orderIndex = meta?.orderIndex ?? pendingOrder ?? nextOrder++;
    transcript.push({ itemId, text: clean, orderIndex });
    if (meta && pendingOrder === meta.orderIndex) {
      pendingOrder = null;
      pendingStartMs = null;
    } else if (!meta) {
      pendingOrder = null;
      pendingStartMs = null;
    }
  };

  for (const event of events) {
    now += event.dt ?? 0;
    maybeCloseAfterFinishWait();

    if (event.type === "speech_started") {
      gen += 1;
      pendingOrder = nextOrder++;
      pendingStartMs = now;
      if (event.itemId) {
        itemMeta.set(event.itemId, { gen, orderIndex: pendingOrder, startMs: pendingStartMs });
      }
    }
    if (event.type === "speech_stopped") {
      unsettledGens.add(gen);
      if (event.itemId && !itemMeta.has(event.itemId)) {
        itemMeta.set(event.itemId, {
          gen,
          orderIndex: pendingOrder ?? nextOrder++,
          startMs: pendingStartMs ?? now,
        });
      } else if (event.itemId) {
        itemMeta.get(event.itemId).gen = gen;
      }
    }
    if (event.type === "transcription.completed") {
      if (!channelOpen) continue;
      const meta = event.itemId ? itemMeta.get(event.itemId) : undefined;
      // Fixed: never drop because a newer utterance started.
      if (event.transcript) commit(event.transcript, event.itemId);
      settleGen(meta?.gen ?? gen);
      maybeCloseAfterFinishWait();
    }
    if (event.type === "transcription.failed") {
      if (!channelOpen) continue;
      const meta = event.itemId ? itemMeta.get(event.itemId) : undefined;
      settleGen(meta?.gen ?? gen);
      maybeCloseAfterFinishWait();
    }
    if (event.type === "finish") {
      finishDeadline = now + finishWaitMs;
      maybeCloseAfterFinishWait();
    }
  }

  // End of event stream: close if finish was requested.
  if (finishDeadline != null) {
    now = finishDeadline;
    maybeCloseAfterFinishWait();
  }

  return transcript.sort((a, b) => a.orderIndex - b.orderIndex).map((t) => t.text);
}

console.log("Interview transcript capture simulation tests\n");

test("buggy model drops answer when candidate speaks again before Whisper returns", () => {
  const answers = simulateBuggyCapture([
    { type: "speech_started", itemId: "item-1" },
    { type: "speech_stopped", itemId: "item-1" },
    { type: "speech_started", itemId: "item-2" },
    { type: "speech_stopped", itemId: "item-2" },
    { type: "transcription.completed", itemId: "item-1", transcript: "I led a React migration." },
    { type: "transcription.completed", itemId: "item-2", transcript: "I used TypeScript daily." },
  ]);
  assert.deepEqual(answers, ["I used TypeScript daily."]);
});

test("fixed model keeps late Whisper answers from prior utterances", () => {
  const answers = simulateFixedCapture([
    { type: "speech_started", itemId: "item-1", dt: 0 },
    { type: "speech_stopped", itemId: "item-1", dt: 2000 },
    { type: "speech_started", itemId: "item-2", dt: 500 },
    { type: "speech_stopped", itemId: "item-2", dt: 2000 },
    {
      type: "transcription.completed",
      itemId: "item-1",
      transcript: "I led a React migration.",
      dt: 100,
    },
    {
      type: "transcription.completed",
      itemId: "item-2",
      transcript: "I used TypeScript daily.",
      dt: 100,
    },
  ]);
  assert.deepEqual(answers, ["I led a React migration.", "I used TypeScript daily."]);
});

test("buggy model loses last answer when finish closes channel before Whisper", () => {
  const answers = simulateBuggyCapture([
    { type: "speech_started", itemId: "item-3" },
    { type: "speech_stopped", itemId: "item-3" },
    { type: "finish" },
    { type: "transcription.completed", itemId: "item-3", transcript: "My biggest strength is ownership." },
  ]);
  assert.deepEqual(answers, []);
});

test("fixed model waits briefly on finish and captures pending Whisper", () => {
  const answers = simulateFixedCapture([
    { type: "speech_started", itemId: "item-3", dt: 0 },
    { type: "speech_stopped", itemId: "item-3", dt: 1500 },
    { type: "finish", dt: 0 },
    {
      type: "transcription.completed",
      itemId: "item-3",
      transcript: "My biggest strength is ownership.",
      dt: 300,
    },
  ]);
  assert.deepEqual(answers, ["My biggest strength is ownership."]);
});

test("fixed model preserves per-item order when late transcript arrives after next speech_started", () => {
  const answers = simulateFixedCapture([
    { type: "speech_started", itemId: "a", dt: 0 },
    { type: "speech_stopped", itemId: "a", dt: 1000 },
    { type: "speech_started", itemId: "b", dt: 100 },
    { type: "speech_stopped", itemId: "b", dt: 1000 },
    { type: "transcription.completed", itemId: "b", transcript: "Second answer", dt: 50 },
    { type: "transcription.completed", itemId: "a", transcript: "First answer", dt: 50 },
  ]);
  assert.deepEqual(answers, ["First answer", "Second answer"]);
});

test("empty Whisper transcript does not invent text but settles the utterance", () => {
  const answers = simulateFixedCapture([
    { type: "speech_started", itemId: "empty-1", dt: 0 },
    { type: "speech_stopped", itemId: "empty-1", dt: 500 },
    { type: "transcription.completed", itemId: "empty-1", transcript: "   ", dt: 100 },
    { type: "finish", dt: 0 },
  ]);
  assert.deepEqual(answers, []);
});

console.log("\nAll transcript capture simulation tests passed.");
