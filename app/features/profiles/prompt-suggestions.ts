const PUBLIC_PROMPT_SUGGESTIONS = [
  "What changed your mind recently?",
  "What are you tired of pretending?",
  "What advice aged badly?",
  "What feels easier now?",
  "What are you learning to say no to?",
  "Which small habit changed more than expected?",
  "What belief are you still testing?",
  "What deserves more patience than people give it?",
  "What did you stop optimizing?",
  "Which mistake taught you the most?",
  "What question do you wish people asked more often?",
  "What are you quietly proud of?",
  "What became simpler once you understood it?",
  "Which assumption are you reconsidering?",
  "What would you do differently if you started today?",
  "What have you made peace with recently?",
] as const;

const DEFAULT_PROMPT_COUNT = 4;

export function getPromptSuggestions(
  seed: string,
  count = DEFAULT_PROMPT_COUNT,
): string[] {
  const suggestions = [...PUBLIC_PROMPT_SUGGESTIONS];
  const random = createSeededRandom(seed);

  for (let index = suggestions.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = suggestions[index];
    const replacement = suggestions[swapIndex];

    if (current === undefined || replacement === undefined) {
      continue;
    }

    suggestions[index] = replacement;
    suggestions[swapIndex] = current;
  }

  return suggestions.slice(0, Math.min(count, suggestions.length));
}

function createSeededRandom(seed: string) {
  let state = hashSeed(seed);

  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);

    return ((state ^ (state >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function hashSeed(seed: string) {
  let hash = 2_166_136_261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}
