import {
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  useEffect,
  useState,
} from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, fonts } from "../theme/theme";

export default function LandingScreen() {
  const [activeDot, setActiveDot] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveDot((currentDot) => (currentDot + 1) % 3);
    }, 450);

    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "bottom"]}
    >
      <View style={styles.screen}>
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

          {/* JIMNY ILLUSTRATION */}
          <View style={styles.illustrationSection}>
            <Image
              source={require("../../assets/images/jimny-ill.png")}
              style={styles.illustration}
              resizeMode="contain"
            />
          </View>

          {/* INTRO */}
          <View style={styles.bottomContent}>
            <View style={styles.introSection}>
              <Text style={styles.title}>
                Discover, collect, and connect.
              </Text>

              <Text style={styles.description}>
                Find nearby trails and short side quests, collect stamps in your
                adventure passport, and meet fellow Jimny owners through upcoming
                meet-ups and experiences.
              </Text>
            </View>

            {/* LOADING DOTS */}
            <View style={styles.loadingSection}>
              <View style={styles.loadingDots}>
                {[0, 1, 2].map((dot) => (
                  <View
                    key={dot}
                    style={[
                      styles.loadingDot,
                      activeDot === dot &&
                        styles.loadingDotActive,
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>
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

  content: {
    flex: 1,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },

  /* BRAND */

  brandSection: {
    width: "100%",
    alignItems: "center",
    paddingTop: "30%",
  },

  logo: {
    width: "58%",
    maxWidth: 230,
    minWidth: 175,
    height: 95,
  },

  tagline: {
    marginTop: -3,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.orange,
    textAlign: "center",
  },

  /* ILLUSTRATION */

  illustrationSection: {
    width: "100%",
    flex: 1,
    minHeight: 190,
    alignItems: "center",
    justifyContent: "center",
  },

  illustration: {
    width: "76%",
    maxWidth: 250,
    height: 220,
  },

  /* BOTTOM CONTENT */

  bottomContent: {
    width: "100%",
    alignItems: "center",
    marginBottom: 30,
  },

  /* INTRO */

  introSection: {
    width: "100%",
    alignItems: "center",
    marginBottom: 50,
  },

  title: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
    textAlign: "center",
    marginBottom: 11,
  },

  description: {
    width: "100%",
    maxWidth: 390,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 50,
  },

  /* LOADING DOTS */

  loadingSection: {
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },

  loadingDots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },

  loadingDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#FFD5AE",
  },

  loadingDotActive: {
    backgroundColor: colors.orange,
  },
});