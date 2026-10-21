import type { Quest } from "../screens/HomeScreen";

export const featuredQuest: Quest = {
  id: "get-it-dirty",
  title: "Get It Dirty",
  category: "Off-Road",
  duration: "Half Day",
  difficulty: 3,
  difficultyLabel: "Moderate",
  description:
    "Complete an off-road trail and earn your dirt badge. Show that your Jimny belongs in the wild!",
  requirements:
    "Your Jimny, sense of adventure, camera",
  steps: [
    "Find an off-road trail in South Africa",
    "Drive the trail in your Jimny",
    "Take a photo of your vehicle on the trail as proof",
  ],
  stampTitle: "The Dirt Badge",
};

export const quests: Quest[] = [
  {
    id: "convoy-and-coffee",
    title: "Convoy & Coffee",
    category: "Community",
    duration: "2 Hours",
    difficulty: 1,
    difficultyLabel: "Easy",
    description:
      "Meet up with fellow Jimny owners, hit the road together and finish the adventure with a coffee stop.",
    requirements:
      "Your Jimny, a fellow Jimny owner, camera",
    steps: [
      "Plan or join a small Jimny convoy",
      "Drive together to a coffee stop",
      "Take a photo of the Jimnys together",
      "Submit the photo to claim your stamp",
    ],
    stampTitle: "The Convoy Badge",
  },
  {
    id: "sleep-under-the-stars",
    title: "Sleep Under the Stars",
    category: "Camping",
    duration: "1 Night",
    difficulty: 3,
    difficultyLabel: "Moderate",
    description:
      "Pack your Jimny, head outdoors and spend a night camping under the stars.",
    requirements:
      "Your Jimny, camping gear, camera",
    steps: [
      "Choose a camping destination",
      "Pack your Jimny and travel there",
      "Spend the night camping",
      "Submit a photo to claim your stamp",
    ],
    stampTitle: "The Camping Badge",
  },
  {
    id: "find-your-twin",
    title: "Find Your Twin",
    category: "Quick Quest",
    duration: "30 Mins",
    difficulty: 1,
    difficultyLabel: "Easy",
    description:
      "Find another Jimny that matches yours and capture the perfect twin photo.",
    requirements:
      "Your Jimny, another matching Jimny, camera",
    steps: [
      "Keep an eye out for a matching Jimny",
      "Park your Jimnys together",
      "Take a twin photo",
      "Submit the photo to claim your stamp",
    ],
    stampTitle: "The Twin Badge",
  },
  {
    id: "road-less-travelled",
    title: "Road Less Travelled",
    category: "Road Trip",
    duration: "1 Day",
    difficulty: 2,
    difficultyLabel: "Easy",
    description:
      "Leave the familiar route behind and take your Jimny somewhere you have never explored before.",
    requirements:
      "Your Jimny, a destination, camera",
    steps: [
      "Choose a road or destination you have not explored",
      "Take your Jimny on the adventure",
      "Stop somewhere memorable",
      "Submit a photo to claim your stamp",
    ],
    stampTitle: "The Explorer Badge",
  },
];

export const allQuests: Quest[] = [
  featuredQuest,
  ...quests,
];

export const TOTAL_QUESTS =
  allQuests.length;