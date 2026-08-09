import type {
  QuestionGenerationLanguage,
  QuestionGenerationStyle,
} from "~/features/question-generation/question-generation.constants";

export const MAX_CONTEXT_PUBLISHED_PAIRS = 20;
export const MAX_CONTEXT_PINNED_PAIRS = 3;
export const MAX_CONTEXT_ANSWER_CHARACTERS = 1_000;
export const MAX_CONTEXT_SERIALIZED_CHARACTERS = 30_000;

export interface QuestionGenerationContextProfile {
  displayName: string;
  bio: string | null;
}

export interface QuestionGenerationContextPair {
  id: string;
  question: string;
  answer: string;
  pinned: boolean;
  publishedAt: Date;
}

export interface QuestionGenerationContextInput {
  profile: QuestionGenerationContextProfile;
  interests: string[];
  language: QuestionGenerationLanguage;
  style: QuestionGenerationStyle;
  pairs: QuestionGenerationContextPair[];
  topic: string;
}

export interface QuestionGenerationContext {
  language: QuestionGenerationLanguage;
  style: QuestionGenerationStyle;
  topic: string;
  profile: QuestionGenerationContextProfile;
  interests: string[];
  publishedPairs: { question: string; answer: string }[];
}

export function buildQuestionGenerationContext(
  input: QuestionGenerationContextInput,
): QuestionGenerationContext {
  const selectedPairs = selectPublishedPairs(input.pairs);
  const context: QuestionGenerationContext = {
    language: input.language,
    style: input.style,
    topic: input.topic,
    profile: {
      displayName: input.profile.displayName,
      bio: input.profile.bio,
    },
    interests: [...input.interests],
    publishedPairs: selectedPairs.map((pair) => ({
      question: pair.question,
      answer: clipUnicode(pair.answer, MAX_CONTEXT_ANSWER_CHARACTERS),
    })),
  };

  return clipContextToSerializedLimit(context);
}

export function serializeQuestionGenerationContext(context: QuestionGenerationContext) {
  return JSON.stringify(context);
}

function selectPublishedPairs(pairs: QuestionGenerationContextPair[]) {
  const pinned = selectPinnedPairs(pairs);
  const selected = new Set(pinned.map((pair) => pair.id));
  const newest = pairs
    .filter((pair) => !selected.has(pair.id))
    .sort((left, right) => right.publishedAt.getTime() - left.publishedAt.getTime());

  return [...pinned, ...newest].slice(0, MAX_CONTEXT_PUBLISHED_PAIRS);
}

function selectPinnedPairs(pairs: QuestionGenerationContextPair[]) {
  const selected = new Set<string>();

  return pairs.filter((pair) => {
    if (!pair.pinned || selected.has(pair.id) || selected.size >= MAX_CONTEXT_PINNED_PAIRS) {
      return false;
    }

    selected.add(pair.id);
    return true;
  });
}

function clipContextToSerializedLimit(context: QuestionGenerationContext) {
  const clipped: QuestionGenerationContext = {
    ...context,
    profile: { ...context.profile },
    interests: [...context.interests],
    publishedPairs: [...context.publishedPairs],
  };

  while (
    clipped.publishedPairs.length > 0 &&
    Array.from(serializeQuestionGenerationContext(clipped)).length >
      MAX_CONTEXT_SERIALIZED_CHARACTERS
  ) {
    clipped.publishedPairs.pop();
  }

  while (serializedLength(clipped) > MAX_CONTEXT_SERIALIZED_CHARACTERS && clipped.interests.length > 0) {
    clipped.interests.pop();
  }

  if (serializedLength(clipped) > MAX_CONTEXT_SERIALIZED_CHARACTERS && clipped.profile.bio) {
    clipped.profile.bio = clipToSerializedLimit(clipped, "bio", clipped.profile.bio);
  }

  return clipped;
}

function serializedLength(context: QuestionGenerationContext) {
  return Array.from(serializeQuestionGenerationContext(context)).length;
}

function clipToSerializedLimit(
  context: QuestionGenerationContext,
  field: "bio",
  value: string,
) {
  const characters = Array.from(value);
  let lower = 0;
  let upper = characters.length;

  while (lower < upper) {
    const middle = Math.ceil((lower + upper) / 2);
    context.profile[field] = characters.slice(0, middle).join("");
    if (serializedLength(context) <= MAX_CONTEXT_SERIALIZED_CHARACTERS) lower = middle;
    else upper = middle - 1;
  }

  return characters.slice(0, lower).join("");
}

function clipUnicode(value: string, maximumCharacters: number) {
  return Array.from(value).slice(0, maximumCharacters).join("");
}
