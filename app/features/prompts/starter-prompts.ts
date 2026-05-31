export const starterPromptCategoryValues = [
  "casual",
  "deep",
  "funny",
  "friends",
  "work_school",
  "random",
] as const;

export type StarterPromptCategoryId = (typeof starterPromptCategoryValues)[number];

export interface StarterPrompt {
  id: string;
  categoryId: StarterPromptCategoryId;
  text: string;
}

export interface StarterPromptCategory {
  id: StarterPromptCategoryId;
  label: string;
  prompts: readonly StarterPrompt[];
}

const promptCopyByCategory = {
  casual: [
    "What has been taking up most of your attention lately?",
    "What is a small thing that made your week better?",
    "What is something you have changed your mind about recently?",
    "What is your current comfort show, song, or routine?",
    "What is a simple opinion you will defend every time?",
    "What are you trying to get better at right now?",
    "What is one thing people misunderstand about your day-to-day?",
    "What is a place you keep meaning to visit?",
    "What habit has quietly helped you?",
    "What would you recommend to almost anyone?",
  ],
  deep: [
    "What belief has helped you through a hard season?",
    "What is something you are learning to accept?",
    "When do you feel most like yourself?",
    "What does a good apology need to include?",
    "What do you wish more people asked you about?",
    "What is a boundary you are glad you learned to set?",
    "What kind of future are you trying to build?",
    "What is a lesson you learned later than you wanted?",
    "What makes someone easy for you to trust?",
    "What are you proud of that no one saw?",
  ],
  funny: [
    "What harmless thing annoys you more than it should?",
    "What is your most dramatic low-stakes opinion?",
    "What would your villain origin story be if it had to start today?",
    "What is the most unserious thing you take seriously?",
    "What is a bad habit you would rebrand as a lifestyle?",
    "What food opinion would get you politely removed from a group chat?",
    "What is the funniest misunderstanding you have had recently?",
    "What object in your room has the strongest main-character energy?",
    "What would you be famous for in a very small town?",
    "What is your most irrational ick?",
  ],
  friends: [
    "What is a memory with friends that still makes you smile?",
    "What makes someone feel safe to be around?",
    "What kind of friend do you try to be?",
    "What is the best way a friend can show up for you?",
    "What is a friendship green flag you notice quickly?",
    "What is something your friends know about you that others miss?",
    "What is your ideal low-pressure hangout?",
    "What is a song, place, or joke tied to a friend for you?",
    "What do you appreciate most in your closest people?",
    "What is a small tradition you want with your friends?",
  ],
  work_school: [
    "What project or class is teaching you the most right now?",
    "What is a skill you want to be known for?",
    "What helps you focus when your brain is scattered?",
    "What is one piece of advice you would give your past self at work or school?",
    "What kind of feedback actually helps you improve?",
    "What is a system or habit that saves you time?",
    "What is the hardest part of your current workload?",
    "What topic could you explain for twenty minutes?",
    "What makes a team or class feel healthy to you?",
    "What is one win from this week that deserves more credit?",
  ],
  random: [
    "What is something oddly specific that you love?",
    "If your week had a title, what would it be?",
    "What question do you wish people would stop asking?",
    "What is a tiny luxury you refuse to give up?",
    "What is an opinion you hold with very little evidence?",
    "What is a color, sound, or smell that instantly changes your mood?",
    "What would you put in a time capsule from this month?",
    "What is a topic you accidentally know a lot about?",
    "What is something you would try if embarrassment was impossible?",
    "What is your current personal side quest?",
  ],
} satisfies Record<StarterPromptCategoryId, readonly string[]>;

const categoryLabels = {
  casual: "Casual",
  deep: "Deep",
  funny: "Funny",
  friends: "Friends",
  work_school: "Work / school",
  random: "Random",
} satisfies Record<StarterPromptCategoryId, string>;

export const starterPromptCategories = starterPromptCategoryValues.map(
  (categoryId) => ({
    id: categoryId,
    label: categoryLabels[categoryId],
    prompts: promptCopyByCategory[categoryId].map((text, index) => ({
      id: `${categoryId}-${String(index + 1).padStart(2, "0")}`,
      categoryId,
      text,
    })),
  }),
) satisfies readonly StarterPromptCategory[];

export const starterPrompts = starterPromptCategories.flatMap(
  (category) => category.prompts,
);

export function findStarterPrompt(promptId: string) {
  return starterPrompts.find((prompt) => prompt.id === promptId);
}
