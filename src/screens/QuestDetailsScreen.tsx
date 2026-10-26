import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import BottomNav from "../components/BottomNav";

import { colors, fonts } from "../theme/theme";
import type { Quest } from "./HomeScreen";

type QuestDetailsScreenProps = {
  quest: Quest;
  isActive?: boolean;
  onBack: () => void;
  onStart?: (quest: Quest) => void;
  onExplore?: () => void;
  onAdventures?: () => void;
  onPassport?: () => void;
  onProfile?: () => void;
};

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

function ImagePlaceholder({
  label,
  style,
}: {
  label: string;
  style?: object;
}) {
  return (
    <View style={[styles.imagePlaceholder, style]}>
      <MaterialIcons
        name="image"
        size={28}
        color={colors.textSecondary}
      />

      <Text style={styles.placeholderText}>
        {label}
      </Text>
    </View>
  );
}

function FooterPattern() {
  return (
    <View style={styles.footerPattern}>
      {Array.from({ length: 12 }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.footerShape,
            index % 3 === 1 &&
              styles.footerShapeTilted,
          ]}
        />
      ))}
    </View>
  );
}

export default function QuestDetailsScreen({
  quest,
  isActive = false,
  onBack,
  onStart,
  onExplore,
  onAdventures,
  onPassport,
  onProfile,
}: QuestDetailsScreenProps) {
  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "bottom"]}
    >
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={onBack}
            hitSlop={10}
          >
            <MaterialIcons
              name="arrow-back"
              size={27}
              color={colors.text}
            />

            <Text style={styles.backText}>
              Back
            </Text>
          </Pressable>

          <Text style={styles.headerTitle}>
            Quest Details
          </Text>

          <Pressable
            style={styles.menuButton}
            hitSlop={10}
          >
            <MaterialIcons
              name="more-horiz"
              size={29}
              color={colors.text}
            />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={
            styles.scrollContent
          }
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <ImagePlaceholder
            label="QUEST IMAGE"
            style={styles.heroImage}
          />

          <View style={styles.content}>
            <View style={styles.categoryRow}>
              <View style={styles.categoryTag}>
                <Text style={styles.categoryTagText}>
                  {quest.category.toUpperCase()}
                </Text>
              </View>

              <DifficultyDots
                difficulty={quest.difficulty}
              />
            </View>

            <Text style={styles.questTitle}>
              {quest.title}
            </Text>

            <Text style={styles.questDescription}>
              {quest.description}
            </Text>

            <View style={styles.detailsBox}>
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>
                  DIFFICULTY:{" "}
                </Text>

                {quest.difficultyLabel} (
                {quest.difficulty}/5)
              </Text>

              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>
                  DURATION:{" "}
                </Text>

                {quest.duration}
              </Text>

              <Text
                style={[
                  styles.detailText,
                  styles.detailTextLast,
                ]}
              >
                <Text style={styles.detailLabel}>
                  WHAT YOU NEED:{" "}
                </Text>

                {quest.requirements}
              </Text>
            </View>

            <Text style={styles.sectionTitle}>
              HOW TO COMPLETE
            </Text>

            <View style={styles.steps}>
              {quest.steps.map((step, index) => (
                <View
                  key={`${quest.id}-${index}`}
                  style={styles.stepRow}
                >
                  <Text style={styles.stepNumber}>
                    {index + 1}.
                  </Text>

                  <Text style={styles.stepText}>
                    {step}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.stampCard}>
              <ImagePlaceholder
                label="STAMP"
                style={styles.stampPlaceholder}
              />

              <View style={styles.stampTextContainer}>
                <Text style={styles.stampHeading}>
                  Earn This Stamp
                </Text>

                <Text style={styles.stampDescription}>
                  "{quest.stampTitle}" added to your
                  digital booklet
                </Text>
              </View>
            </View>
          </View>

          <FooterPattern />
        </ScrollView>

        <View style={styles.startArea}>
          <Pressable
            style={({ pressed }) => [
              styles.startButton,
              pressed && styles.pressed,
            ]}
            onPress={() => onStart?.(quest)}
          >
            <Text style={styles.startButtonText}>
              {isActive
                ? "CONTINUE SIDE QUEST"
                : "START SIDE QUEST"}
            </Text>
          </Pressable>
        </View>

        <BottomNav selected="explore" onExplore={onExplore} onHibernate={onAdventures} onPassport={onPassport} onProfile={onProfile} />
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
    minHeight: 96,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    backgroundColor: colors.background,
  },

  backButton: {
    width: 100,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  backText: {
    fontFamily: fonts.regular,
    fontSize: 17,
    color: colors.text,
  },

  headerTitle: {
    flex: 1,
    fontFamily: fonts.extraBold,
    fontSize: 19,
    lineHeight: 24,
    textAlign: "center",
    color: colors.red,
  },

  menuButton: {
    width: 100,
    minHeight: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
  },

  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D9D9D9",
  },

  placeholderText: {
    marginTop: 5,
    fontFamily: fonts.semiBold,
    fontSize: 9,
    color: colors.textSecondary,
  },

  heroImage: {
    width: "100%",
    aspectRatio: 1.77,
  },

  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 18,
  },

  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  categoryTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 2,
    backgroundColor: colors.green,
  },

  categoryTagText: {
    fontFamily: fonts.extraBold,
    fontSize: 11,
    lineHeight: 14,
    color: colors.white,
  },

  difficultyDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginLeft: 10,
  },

  difficultyDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#AEB6C0",
  },

  difficultyDotActive: {
    backgroundColor: colors.text,
  },

  questTitle: {
    marginTop: 10,
    fontFamily: fonts.extraBold,
    fontSize: 28,
    lineHeight: 34,
    color: colors.text,
  },

  questDescription: {
    marginTop: 7,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 21,
    color: colors.textSecondary,
  },

  detailsBox: {
    width: "100%",
    marginTop: 20,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: 4,
    backgroundColor: colors.background,
  },

  detailText: {
    marginBottom: 8,
    fontFamily: fonts.extraBold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },

  detailTextLast: {
    marginBottom: 0,
  },

  detailLabel: {
    fontFamily: fonts.extraBold,
    color: colors.text,
  },

  sectionTitle: {
    marginTop: 21,
    marginBottom: 10,
    fontFamily: fonts.extraBold,
    fontSize: 15,
    lineHeight: 19,
    color: colors.red,
  },

  steps: {
    width: "100%",
    gap: 8,
  },

  stepRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
  },

  stepNumber: {
    width: 20,
    flexShrink: 0,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textSecondary,
  },

  stepText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textSecondary,
  },

  stampCard: {
    width: "100%",
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 19,
    marginBottom: 20,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 4,
    backgroundColor: colors.background,
  },

  stampPlaceholder: {
    width: 62,
    height: 62,
    flexShrink: 0,
    borderRadius: 31,
  },

  stampTextContainer: {
    flex: 1,
    marginLeft: 14,
  },

  stampHeading: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    lineHeight: 18,
    color: colors.text,
  },

  stampDescription: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  footerPattern: {
    width: "100%",
    height: 22,
    flexDirection: "row",
    alignItems: "flex-end",
    overflow: "hidden",
    paddingHorizontal: 20,
    gap: 8,
    backgroundColor: colors.background,
  },

  footerShape: {
    flex: 1,
    maxWidth: 28,
    height: 16,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: "#FF3042",
  },

  footerShapeTilted: {
    transform: [{ rotate: "8deg" }],
  },

  startArea: {
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.background,
  },

  startButton: {
    width: "100%",
    maxWidth: 520,
    minHeight: 60,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    borderRadius: 3,
    backgroundColor: colors.green,

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },

  startButtonText: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    lineHeight: 21,
    color: colors.white,
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
    backgroundColor: colors.orange,

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },

  navText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.text,
    textAlign: "center",
  },

  navTextSelected: {
    fontFamily: fonts.extraBold,
  },

  pressed: {
    opacity: 0.82,
  },
});