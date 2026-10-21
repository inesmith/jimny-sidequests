import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, fonts, spacing } from "../theme/theme";

type LandingScreenProps = {
  onExploreQuests?: () => void;
  onViewPassport?: () => void;
  onUpcomingExperiences?: () => void;
};

type QuestCardProps = {
  title: string;
  category: string;
  duration: string;
  difficulty: number;
};

type EventCardProps = {
  title: string;
  category: string;
  date: string;
  location: string;
  description: string;
};

const questData: QuestCardProps[] = [
  {
    title: "Convoy & Coffee",
    category: "Community",
    duration: "2 Hours",
    difficulty: 1,
  },
  {
    title: "Sleep Under the Stars",
    category: "Camping",
    duration: "1 Night",
    difficulty: 4,
  },
  {
    title: "Find Your Twin",
    category: "Quick Quest",
    duration: "30 Mins",
    difficulty: 1,
  },
  {
    title: "Road Less Travelled",
    category: "Road Trip",
    duration: "1 Day",
    difficulty: 3,
  },
];

const eventData: EventCardProps[] = [
  {
    title: "Franschhoek Coffee Cruise",
    category: "Coffee Meet-up",
    date: "12 Oct 2026",
    location: "Franschhoek, Western Cape",
    description:
      "Join fellow owners for a morning mountain pass cruise followed by artisanal coffee.",
  },
  {
    title: "Baviaanskloof Weekend",
    category: "Camping Weekend",
    date: "25–27 Oct 2026",
    location: "Eastern Cape",
    description:
      "A legendary 4x4 route through wilderness campsites, rivers, and technical tracks.",
  },
];

function ImagePlaceholder({
  label,
  style,
}: {
  label: string;
  style?: object;
}) {
  return (
    <View style={[styles.imagePlaceholder, style]}>
      <Text style={styles.placeholderText}>{label}</Text>
    </View>
  );
}

function QuestCard({
  title,
  category,
  duration,
  difficulty,
}: QuestCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.questCard,
        pressed && styles.pressed,
      ]}
    >
      <ImagePlaceholder label="IMAGE" style={styles.questImage} />

      <View style={styles.questInfo}>
        <View style={styles.questTitleRow}>
          <Text style={styles.questTitle} numberOfLines={2}>
            {title}
          </Text>

          <View style={styles.categoryTag}>
            <Text style={styles.categoryTagText}>{category}</Text>
          </View>
        </View>

        <View style={styles.questMeta}>
          <View style={styles.difficultyDots}>
            {[1, 2, 3, 4, 5].map((dot) => (
              <View
                key={dot}
                style={[
                  styles.difficultyDot,
                  dot <= difficulty && styles.difficultyDotActive,
                ]}
              />
            ))}
          </View>

          <Text style={styles.duration}>{duration}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function EventCard({
  title,
  category,
  date,
  location,
  description,
}: EventCardProps) {
  return (
    <View style={styles.eventCard}>
      <ImagePlaceholder label="EVENT IMAGE" style={styles.eventImage} />

      <View style={styles.eventContent}>
        <View style={styles.eventTitleRow}>
          <Text style={styles.eventTitle}>{title}</Text>

          <View style={styles.eventCategory}>
            <Text style={styles.eventCategoryText}>{category}</Text>
          </View>
        </View>

        <View style={styles.eventDetails}>
          <Text style={styles.eventDate}>{date}</Text>
          <Text style={styles.eventLocation}>{location}</Text>
        </View>

        <Text style={styles.eventDescription}>{description}</Text>

        <Pressable hitSlop={8}>
          <Text style={styles.learnMore}>Learn More ›</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function LandingScreen({
  onExploreQuests,
  onViewPassport,
  onUpcomingExperiences,
}: LandingScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.screen}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.content}>
            {/* BRAND */}
            <View style={styles.brandSection}>
              <Image
                source={require("../../assets/images/jimny-side-quests-logo.png")}
                style={styles.logo}
                resizeMode="contain"
              />

              <Text style={styles.tagline}>
                The adventure between Gatherings.
              </Text>
            </View>

            {/* HERO */}
            <ImagePlaceholder
              label="HERO IMAGE"
              style={styles.heroPlaceholder}
            />

            {/* NETWORK INTRO */}
            <View style={styles.networkCard}>
              <Text style={styles.networkTitle}>
                South African Owners Network
              </Text>

              <Text style={styles.networkBody}>
                Discover dirt trails, camp spots, and quick road tasks tailored
                for your 4×4 between national meets.
              </Text>
            </View>

            {/* WHAT IT OFFERS */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                WHAT JIMNY SIDE QUESTS OFFERS
              </Text>

              <View style={styles.offerCard}>
                <Text style={styles.offerTitle}>
                  Side quests, passport stamps, and upcoming experiences in one
                  place.
                </Text>

                <Text style={styles.offerBody}>
                  Between national meets, you can complete short adventures,
                  collect physical stamps, and join upcoming events with other
                  owners. The app helps you find the right activity for your
                  Jimny, your schedule, and your next adventure.
                </Text>

                <View style={styles.chipContainer}>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>Dirt trails</Text>
                  </View>

                  <View style={styles.chip}>
                    <Text style={styles.chipText}>Camp spots</Text>
                  </View>

                  <View style={styles.chip}>
                    <Text style={styles.chipText}>Quick road tasks</Text>
                  </View>

                  <View style={styles.chip}>
                    <Text style={styles.chipText}>Upcoming events</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* SUGGESTED QUESTS */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>SUGGESTED THINGS TO DO</Text>

              <View style={styles.questList}>
                {questData.map((quest) => (
                  <QuestCard key={quest.title} {...quest} />
                ))}
              </View>
            </View>

            {/* UPCOMING EXPERIENCES */}
            <View style={styles.section}>
              <View style={styles.sectionHeadingRow}>
                <Text style={styles.sectionLabelNoMargin}>
                  UPCOMING EXPERIENCES
                </Text>

                <Pressable
                  onPress={onUpcomingExperiences}
                  hitSlop={10}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={styles.viewAllText}>VIEW ALL</Text>
                </Pressable>
              </View>

              <View style={styles.eventList}>
                {eventData.map((event) => (
                  <EventCard key={event.title} {...event} />
                ))}
              </View>
            </View>
          </View>

          <Image
            source={require("../../assets/images/footer-pattern.png")}
            style={styles.footerFlags}
            resizeMode="stretch"
          />
        </ScrollView>

        {/* BOTTOM ACTION AREA */}
        <View style={styles.bottomActions}>
          <Pressable
            style={({ pressed }) => [
              styles.exploreButton,
              pressed && styles.pressed,
            ]}
            onPress={onExploreQuests}
          >
            <Text style={styles.exploreButtonText}>
              EXPLORE SIDE QUESTS
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => pressed && styles.pressed}
            onPress={onViewPassport}
            hitSlop={10}
          >
            <Text style={styles.passportButtonText}>
              View My Passport
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 12,
  },

  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: spacing.screen,
  },

  /* BRAND */

  brandSection: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 21,
  },

  logo: {
    width: "58%",
    maxWidth: 225,
    minWidth: 175,
    height: 72,
  },

  tagline: {
    marginTop: 4,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.orange,
    textAlign: "center",
  },

  /* PLACEHOLDERS */

  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D9D9D9",
  },

  placeholderText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: colors.textSecondary,
  },

  heroPlaceholder: {
    width: "100%",
    aspectRatio: 1.18,
    marginBottom: 24,
  },

  /* NETWORK */

  networkCard: {
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 15,
    marginBottom: 25,
  },

  networkTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    lineHeight: 17,
    color: colors.text,
    marginBottom: 5,
  },

  networkBody: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  /* SECTIONS */

  section: {
    marginBottom: 25,
  },

  sectionLabel: {
    fontFamily: fonts.extraBold,
    fontSize: 11,
    lineHeight: 15,
    color: colors.red,
    marginBottom: 10,
  },

  sectionHeadingRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  sectionLabelNoMargin: {
    fontFamily: fonts.extraBold,
    fontSize: 11,
    lineHeight: 15,
    color: colors.red,
  },

  viewAllText: {
    fontFamily: fonts.extraBold,
    fontSize: 10,
    lineHeight: 15,
    color: colors.red,
    textDecorationLine: "underline",
  },

  /* OFFER */

  offerCard: {
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: 4,
    padding: 14,
  },

  offerTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    lineHeight: 19,
    color: colors.text,
    marginBottom: 7,
  },

  offerBody: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
    marginBottom: 10,
  },

  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },

  chip: {
    minHeight: 23,
    justifyContent: "center",
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.orange,
    borderRadius: 20,
    backgroundColor: colors.background,
  },

  chipText: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.text,
  },

  /* QUESTS */

  questList: {
    gap: 11,
  },

  questCard: {
    width: "100%",
    minHeight: 98,
    flexDirection: "row",
    alignItems: "center",
    padding: 11,
    borderWidth: 1,
    borderColor: colors.orange,
    borderRadius: 4,
    backgroundColor: colors.background,

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.16,
    shadowRadius: 3,
    elevation: 3,
  },

  questImage: {
    width: 76,
    height: 76,
    borderRadius: 3,
    flexShrink: 0,
  },

  questInfo: {
    flex: 1,
    marginLeft: 13,
    justifyContent: "center",
  },

  questTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  questTitle: {
    flex: 1,
    paddingRight: 7,
    fontFamily: fonts.extraBold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.text,
  },

  categoryTag: {
    backgroundColor: colors.green,
    borderRadius: 2,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexShrink: 0,
  },

  categoryTagText: {
    fontFamily: fonts.regular,
    fontSize: 8,
    color: colors.white,
  },

  questMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 7,
  },

  difficultyDots: {
    flexDirection: "row",
    gap: 3,
    marginRight: 12,
  },

  difficultyDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#B5BDC7",
  },

  difficultyDotActive: {
    backgroundColor: colors.text,
  },

  duration: {
    fontFamily: fonts.regular,
    fontSize: 9,
    color: colors.textSecondary,
  },

  /* EVENTS */

  eventList: {
    gap: 12,
  },

  eventCard: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.orange,
    borderRadius: 4,
    backgroundColor: colors.background,

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.14,
    shadowRadius: 3,
    elevation: 3,
  },

  eventImage: {
    width: "100%",
    aspectRatio: 2.15,
  },

  eventContent: {
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 14,
  },

  eventTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  eventTitle: {
    flex: 1,
    paddingRight: 7,
    fontFamily: fonts.extraBold,
    fontSize: 15,
    lineHeight: 19,
    color: colors.text,
  },

  eventCategory: {
    flexShrink: 0,
    backgroundColor: colors.green,
    borderRadius: 2,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },

  eventCategoryText: {
    fontFamily: fonts.regular,
    fontSize: 8,
    color: colors.white,
  },

  eventDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 13,
    marginBottom: 8,
  },

  eventDate: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: colors.text,
  },

  eventLocation: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.textSecondary,
  },

  eventDescription: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
    marginBottom: 10,
  },

  learnMore: {
    fontFamily: fonts.extraBold,
    fontSize: 11,
    color: colors.text,
  },

  /* DECORATIVE DIVIDER */

  decorativeFooter: {
    height: 28,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    overflow: "hidden",
    paddingHorizontal: 12,
  },

  footerShape: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.red,
    marginBottom: -10,
  },

  /* BOTTOM ACTIONS */

  bottomActions: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: spacing.screen,
    paddingTop: 14,
    paddingBottom: 9,
    backgroundColor: colors.background,
  },

  exploreButton: {
    width: "100%",
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 3,
    backgroundColor: colors.green,

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 3,
  },

  exploreButtonText: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    color: colors.white,
  },

  passportButtonText: {
    alignSelf: "center",
    marginTop: 15,
    marginBottom: 1,
    paddingBottom: 2,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.text,
    textDecorationLine: "underline",
  },

  pressed: {
    opacity: 0.82,
  },

  footerFlags: {
    width: "100%",
    height: 27,
  },
});