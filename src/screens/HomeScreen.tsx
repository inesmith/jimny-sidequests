import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { colors, fonts, spacing } from "../theme/theme";
import BottomNav from "../components/BottomNav";
import {
  featuredQuest,
  quests,
} from "../data/quests";

export type Quest = {
  id: string;
  title: string;
  category: string;
  duration: string;
  difficulty: number;
  difficultyLabel: string;
  description: string;
  requirements: string;
  steps: string[];
  stampTitle: string;
  image?: number;
  stampImage?: number;
};

type HomeScreenProps = {
  onPassport?: () => void;
  onAdventures?: () => void;
  onProfile?: () => void;
  onQuestPress?: (quest: Quest) => void;
  onUpcomingExperiences?: () => void;

  onNotifications?: () => void;
  notificationCount?: number;
};

const categories = [
  "All",
  "Off-Road",
  "Camping",
  "Community",
  "Road Trip",
  "Quick Quest",
];

function ImagePlaceholder({
  label = "IMAGE",
  style,
}: {
  label?: string;
  style?: object;
}) {
  return (
    <View style={[styles.imagePlaceholder, style]}>
      <MaterialIcons
        name="image"
        size={24}
        color={colors.textSecondary}
      />

      <Text style={styles.placeholderText}>
        {label}
      </Text>
    </View>
  );
}

function DifficultyDots({
  difficulty,
}: {
  difficulty: number;
}) {
  return (
    <View style={styles.difficultyDots}>
      {[1, 2, 3, 4, 5].map((dot) => (
        <View
          key={dot}
          style={[
            styles.difficultyDot,
            dot <= difficulty &&
              styles.difficultyDotActive,
          ]}
        />
      ))}
    </View>
  );
}

function QuestCard({
  quest,
  onPress,
}: {
  quest: Quest;
  onPress?: (quest: Quest) => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.questCard,
        pressed && styles.pressed,
      ]}
      onPress={() => onPress?.(quest)}
    >
      <ImagePlaceholder style={styles.questImage} />

      <View style={styles.questContent}>
        <View style={styles.questTitleRow}>
          <Text
            style={styles.questTitle}
            numberOfLines={1}
          >
            {quest.title}
          </Text>

          <View style={styles.questTag}>
            <Text style={styles.questTagText}>
              {quest.category}
            </Text>
          </View>
        </View>

        <View style={styles.questMeta}>
          <DifficultyDots
            difficulty={quest.difficulty}
          />

          <Text style={styles.questDuration}>
            {quest.duration}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function HomeScreen({
  onPassport,
  onAdventures,
  onProfile,
  onQuestPress,
  onUpcomingExperiences,
  onNotifications,
  notificationCount = 0,
}: HomeScreenProps) {
  const [selectedCategory, setSelectedCategory] =
    useState("All");
  const filteredQuests =
    selectedCategory === "All"
      ? quests
      : quests.filter(
          (quest) =>
            quest.category === selectedCategory
        );

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "bottom"]}
    >
      <View style={styles.screen}>
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            style={styles.headerIconButton}
            hitSlop={10}
            onPress={onNotifications}
          >
            <MaterialIcons
              name="notifications-none"
              size={29}
              color={colors.text}
            />

            {notificationCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text
                  style={styles.notificationBadgeText}
                >
                  {notificationCount > 99
                    ? "99+"
                    : notificationCount}
                </Text>
              </View>
            )}
          </Pressable>

          <Text style={styles.headerTitle}>
            Explore Side Quests
          </Text>

          <Pressable
            style={styles.headerIconButton}
            hitSlop={10}
          >
            <MaterialIcons
              name="more-horiz"
              size={29}
              color={colors.text}
            />
          </Pressable>
        </View>

        {/* MAIN CONTENT */}
        <ScrollView
          style={styles.mainScroll}
          contentContainerStyle={
            styles.mainScrollContent
          }
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* FILTERS */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={
              styles.filterContainer
            }
          >
            {categories.map((category) => {
              const selected =
                selectedCategory === category;

              return (
                <Pressable
                  key={category}
                  style={({ pressed }) => [
                    styles.filterButton,
                    selected &&
                      styles.filterButtonSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() =>
                    setSelectedCategory(category)
                  }
                >
                  <Text
                    style={[
                      styles.filterText,
                      selected &&
                        styles.filterTextSelected,
                    ]}
                  >
                    {category}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.content}>
            {/* FEATURED QUEST */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                FEATURED QUEST
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.featuredCard,
                  pressed && styles.pressed,
                ]}
                onPress={() =>
                  onQuestPress?.(featuredQuest)
                }
              >
                <ImagePlaceholder
                  label="FEATURED QUEST IMAGE"
                  style={styles.featuredImage}
                />

                <View style={styles.featuredContent}>
                  <View style={styles.featuredTitleRow}>
                    <Text style={styles.featuredTitle}>
                      {featuredQuest.title}
                    </Text>

                    <View style={styles.featuredTag}>
                      <Text style={styles.featuredTagText}>
                        {featuredQuest.category}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={styles.featuredDescription}
                  >
                    {featuredQuest.description}
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* AVAILABLE QUESTS */}
            <View style={styles.availableSection}>
              <Text style={styles.sectionTitle}>
                AVAILABLE QUESTS
              </Text>

              <View style={styles.questList}>
                {filteredQuests.length > 0 ? (
                  filteredQuests.map((quest) => (
                    <QuestCard
                      key={quest.id}
                      quest={quest}
                      onPress={onQuestPress}
                    />
                  ))
                ) : (
                  <View style={styles.emptyState}>
                    <Text
                      style={styles.emptyStateText}
                    >
                      No quests in this category yet.
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* UPCOMING EXPERIENCES */}
            <View style={styles.upcomingSection}>
              <View style={styles.upcomingHeadingRow}>
                <View style={styles.upcomingHeadingText}>
                  <Text style={styles.sectionTitle}>
                    UPCOMING EXPERIENCES
                  </Text>

                  <Text style={styles.upcomingIntro}>
                    Looking for something bigger? See the
                    upcoming Jimny experiences you can join.
                  </Text>
                </View>

              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.upcomingButton,
                  pressed && styles.pressed,
                ]}
                onPress={onUpcomingExperiences}
              >
                <View style={styles.upcomingButtonLeft}>
                  <View style={styles.upcomingIcon}>
                    <MaterialIcons
                      name="calendar-month"
                      size={25}
                      color={colors.white}
                    />
                  </View>

                  <View style={styles.upcomingButtonCopy}>
                    <Text style={styles.upcomingButtonTitle}>
                      View Upcoming Experiences
                    </Text>

                    <Text style={styles.upcomingButtonSubtitle}>
                      Trips, gatherings and community events
                    </Text>
                  </View>
                </View>

                <MaterialIcons
                  name="chevron-right"
                  size={25}
                  color={colors.text}
                />
              </Pressable>
            </View>
          </View>
        </ScrollView>

        {/* SHARED BOTTOM NAVIGATION */}
        <BottomNav
          selected="explore"
          onHibernate={onAdventures}
          onPassport={onPassport}
          onProfile={onProfile}
        />
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

  header: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screen,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },

  headerIconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    flex: 1,
    paddingHorizontal: 10,
    fontFamily: fonts.extraBold,
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
    color: colors.red,
  },

  notificationBadge: {
    position: "absolute",
    top: 1,
    right: 1,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.red,
  },

  notificationBadgeText: {
    fontFamily: fonts.extraBold,
    fontSize: 10,
    color: colors.white,
  },

  mainScroll: {
    flex: 1,
  },

  mainScrollContent: {
    paddingBottom: 26,
  },

  filterContainer: {
    paddingHorizontal: spacing.screen,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 9,
  },

  filterButton: {
    minHeight: 38,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.orange,
    borderRadius: 22,
    backgroundColor: colors.background,
  },

  filterButtonSelected: {
    borderColor: colors.orange,
    backgroundColor: colors.orange,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 3,
  },

  filterText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.text,
  },

  filterTextSelected: {
    fontFamily: fonts.extraBold,
    color: colors.white,
  },

  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: spacing.screen,
  },

  section: {
    marginBottom: 22,
  },

  sectionTitle: {
    marginBottom: 10,
    fontFamily: fonts.extraBold,
    fontSize: 12,
    lineHeight: 17,
    color: colors.red,
  },

  featuredCard: {
    overflow: "hidden",
    width: "100%",
    borderWidth: 2,
    borderColor: colors.text,
    borderRadius: 4,
    backgroundColor: colors.background,
  },

  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D9D9D9",
  },

  placeholderText: {
    marginTop: 4,
    fontFamily: fonts.semiBold,
    fontSize: 9,
    color: colors.textSecondary,
  },

  featuredImage: {
    width: "100%",
    aspectRatio: 1.9,
  },

  featuredContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 13,
  },

  featuredTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  featuredTitle: {
    flex: 1,
    paddingRight: 10,
    fontFamily: fonts.extraBold,
    fontSize: 16,
    lineHeight: 23,
    color: colors.text,
  },

  featuredTag: {
    flexShrink: 0,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 2,
    backgroundColor: colors.green,
  },

  featuredTagText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.white,
  },

  featuredDescription: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  availableSection: {
    width: "100%",
  },

  questList: {
    width: "100%",
    gap: 12,
  },

  questCard: {
    width: "100%",
    minHeight: 100,
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
      height: 3,
    },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 3,
  },

  questImage: {
    width: 77,
    height: 77,
    flexShrink: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.textSecondary,
    borderRadius: 3,
  },

  questContent: {
    flex: 1,
    marginLeft: 13,
  },

  questTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  questTitle: {
    flex: 1,
    paddingRight: 7,
    fontFamily: fonts.extraBold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },

  questTag: {
    flexShrink: 0,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 2,
    backgroundColor: colors.green,
  },

  questTagText: {
    fontFamily: fonts.regular,
    fontSize: 9,
    color: colors.white,
  },

  questMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },

  difficultyDots: {
    flexDirection: "row",
    gap: 4,
    marginRight: 14,
  },

  difficultyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#AEB6C0",
  },

  difficultyDotActive: {
    backgroundColor: colors.text,
  },

  questDuration: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
  },

  emptyState: {
    width: "100%",
    minHeight: 90,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 4,
  },

  emptyStateText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },

  upcomingSection: {
    width: "100%",
    marginTop: 28,
    marginBottom: 8,
  },

  upcomingHeadingRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  upcomingHeadingText: {
    flex: 1,
    paddingRight: 18,
  },

  upcomingIntro: {
    marginTop: -3,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  upcomingButton: {
    width: "100%",
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: colors.orange,
    borderRadius: 4,
    backgroundColor: colors.background,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },

  upcomingButtonLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 10,
  },

  upcomingIcon: {
    width: 48,
    height: 48,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: colors.green,
  },

  upcomingButtonCopy: {
    flex: 1,
    marginLeft: 13,
  },

  upcomingButtonTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },

  upcomingButtonSubtitle: {
    marginTop: 4,
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 14,
    color: colors.textSecondary,
  },

  bottomNav: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "stretch",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.background,
    paddingHorizontal: 15,
    paddingTop: 8,
    paddingBottom: 5,
  },

  navItem: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 3,
  },

  navItemSelected: {
    borderTopWidth: 2,
    borderTopColor: colors.green,
  },

  navImage: {
    width: 28,
    height: 28,
    tintColor: colors.text,
  },

  navProfileCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.text,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },

  navProfileImage: {
    width: "100%",
    height: "100%",
  },

  navText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.text,
    textAlign: "center",
  },

  navTextSelected: {
    fontFamily: fonts.extraBold,
    color: colors.green,
  },

  pressed: {
    opacity: 0.82,
  },
});