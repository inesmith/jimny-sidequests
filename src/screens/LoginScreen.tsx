import { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";

import { auth } from "../firebase/firebase";
import { colors, fonts, spacing } from "../theme/theme";

type LoginScreenProps = {
  onSignUp: () => void;
  onLogin: () => void;
};

export default function LoginScreen({
  onSignUp,
  onLogin,
}: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const trimmedEmail = email.trim();

  const handleLogin = async () => {
    if (!trimmedEmail || !password) {
      Alert.alert(
        "Missing details",
        "Please enter your email address and password."
      );
      return;
    }

    setIsLoggingIn(true);

    try {
      await signInWithEmailAndPassword(
        auth,
        trimmedEmail,
        password
      );

      onLogin();
    } catch (error: any) {
      let message =
        "We couldn't log you in. Please check your details and try again.";

      switch (error?.code) {
        case "auth/invalid-email":
          message = "Please enter a valid email address.";
          break;

        case "auth/invalid-credential":
        case "auth/user-not-found":
        case "auth/wrong-password":
          message =
            "The email address or password you entered is incorrect.";
          break;

        case "auth/too-many-requests":
          message =
            "Too many login attempts were made. Please wait a little while and try again.";
          break;

        case "auth/network-request-failed":
          message =
            "We couldn't connect to the internet. Please check your connection and try again.";
          break;
      }

      Alert.alert("Unable to log in", message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!trimmedEmail) {
      Alert.alert(
        "Enter your email",
        "Enter your email address first, then tap Forgot password?"
      );
      return;
    }

    setIsResettingPassword(true);

    try {
      await sendPasswordResetEmail(auth, trimmedEmail);

      Alert.alert(
        "Reset email sent",
        "Check your email for instructions to reset your password."
      );
    } catch (error: any) {
      let message =
        "We couldn't send the password reset email. Please try again.";

      switch (error?.code) {
        case "auth/invalid-email":
          message = "Please enter a valid email address.";
          break;

        case "auth/network-request-failed":
          message =
            "We couldn't connect to the internet. Please check your connection and try again.";
          break;

        case "auth/too-many-requests":
          message =
            "Too many requests were made. Please wait a little while and try again.";
          break;
      }

      Alert.alert("Unable to reset password", message);
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "bottom"]}
    >
      <View style={styles.screen}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* HEADER */}
          <View style={styles.header}>
            {/* <Pressable
              style={styles.backButton}
              hitSlop={12}
              onPress={() => {
                // Navigation will be connected later.
              }}
            >
              <Text style={styles.backArrow}>‹</Text>
              <Text style={styles.backText}>Back</Text>
            </Pressable> */}

            <View style={styles.header}>
              <Text style={styles.headerTitle}>Log in</Text>
            </View>

            {/* <Text style={styles.headerTitle}>Log in</Text> */}

            {/* Keeps title perfectly centred */}
            {/* <View style={styles.headerSpacer} /> */}
          </View>

          {/* CONTENT */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
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

              {/* LOGIN FORM */}
              <View style={styles.formSection}>
                <View style={styles.intro}>
                  <Text style={styles.heading}>
                    Welcome back, Adventurer!
                  </Text>

                  <Text style={styles.body}>
                    Log in to your profile, passport and the adventures still
                    to come.
                  </Text>
                </View>

                {/* EMAIL */}
                <View style={styles.field}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>
                      Email address
                    </Text>

                    <Text style={styles.required}>
                      Required
                    </Text>
                  </View>

                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Enter your email address"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="emailAddress"
                    autoComplete="email"
                    style={styles.input}
                    returnKeyType="next"
                    editable={!isLoggingIn}
                  />
                </View>

                {/* PASSWORD */}
                <View style={styles.field}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>
                      Password
                    </Text>

                    <Text style={styles.required}>
                      Required
                    </Text>
                  </View>

                  <View style={styles.passwordInput}>
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Enter your password"
                      placeholderTextColor={colors.textSecondary}
                      secureTextEntry={!showPassword}
                      textContentType="password"
                      autoComplete="password"
                      style={styles.passwordTextInput}
                      returnKeyType="done"
                      editable={!isLoggingIn}
                      onSubmitEditing={handleLogin}
                    />

                    <Pressable
                      onPress={() =>
                        setShowPassword((current) => !current)
                      }
                      hitSlop={10}
                      style={styles.eyeButton}
                      accessibilityRole="button"
                      accessibilityLabel={
                        showPassword
                          ? "Hide password"
                          : "Show password"
                      }
                    >
                      <MaterialIcons
                        name={
                          showPassword
                            ? "visibility"
                            : "visibility-off"
                        }
                        size={21}
                        color={colors.text}
                      />
                    </Pressable>
                  </View>

                  <Pressable
                    style={styles.forgotButton}
                    onPress={handleForgotPassword}
                    disabled={
                      isResettingPassword || isLoggingIn
                    }
                  >
                    <Text style={styles.forgotText}>
                      {isResettingPassword
                        ? "Sending..."
                        : "Forgot password?"}
                    </Text>
                  </Pressable>
                </View>

                {/* LOGIN */}
                <Pressable
                  style={({ pressed }) => [
                    styles.loginButton,
                    pressed &&
                      !isLoggingIn &&
                      styles.buttonPressed,
                    isLoggingIn &&
                      styles.buttonDisabled,
                  ]}
                  onPress={handleLogin}
                  disabled={isLoggingIn}
                >
                  <Text style={styles.loginButtonText}>
                    {isLoggingIn
                      ? "LOGGING IN..."
                      : "LOG IN"}
                  </Text>
                </Pressable>

                {/* SIGN UP */}
                <View style={styles.signupSection}>
                  <Text style={styles.newUserText}>
                    New to Jimny Side Quests?
                  </Text>

                  <Pressable
                    style={({ pressed }) => [
                      styles.signupButton,
                      pressed &&
                        !isLoggingIn &&
                        styles.buttonPressed,
                    ]}
                    onPress={onSignUp}
                    disabled={isLoggingIn}
                  >
                    <Text style={styles.signupButtonText}>
                      SIGN UP
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* FOOTER */}
        <View style={styles.footer}>
          <Image
            source={require("../../assets/images/footer-pattern.png")}
            style={styles.footerPattern}
            resizeMode="stretch"
          />

          <Text style={styles.footerText}>
            South African Owners Network
          </Text>
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

  keyboardView: {
    flex: 1,
  },

  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  /* HEADER */

  header: {
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.medium,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },

  //   backButton: {
  //     width: 90,
  //     flexDirection: "row",
  //     alignItems: "center",
  //   },

  //   backArrow: {
  //     fontFamily: fonts.regular,
  //     fontSize: 30,
  //     lineHeight: 30,
  //     marginRight: 3,
  //     color: colors.text,
  //   },

  //   backText: {
  //     fontFamily: fonts.regular,
  //     fontSize: 15,
  //     color: colors.text,
  //   },

  headerTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.red,
    textAlign: "center",
  },

  //   headerSpacer: {
  //     width: 90,
  //   },

  /* SCROLL AREA */

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
  },

  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: spacing.screen,
    paddingBottom: 28,
  },

  /* BRAND */

  brandSection: {
    alignItems: "center",
    paddingTop: 23,
    marginBottom: 29,
  },

  logo: {
    width: "58%",
    maxWidth: 225,
    minWidth: 175,
    height: 72,
  },

  tagline: {
    marginTop: 10,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.orange,
    textAlign: "center",
  },

  /* INTRO */

  formSection: {
    width: "100%",
  },

  intro: {
    marginBottom: 19,
  },

  heading: {
    fontFamily: fonts.extraBold,
    fontSize: 22,
    lineHeight: 27,
    color: colors.text,
    marginBottom: 4,
  },

  body: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },

  /* FIELDS */

  field: {
    marginBottom: 17,
  },

  labelRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 6,
  },

  label: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.text,
  },

  required: {
    marginLeft: 7,
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.textSecondary,
  },

  input: {
    width: "100%",
    minHeight: 45,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.background,
  },

  passwordInput: {
    width: "100%",
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.background,
  },

  passwordTextInput: {
    flex: 1,
    minHeight: 45,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.text,
  },

  eyeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  forgotButton: {
    alignSelf: "flex-end",
    marginTop: 20,
  },

  forgotText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.text,
    textDecorationLine: "underline",
  },

  /* BUTTONS */

  loginButton: {
    width: "100%",
    minHeight: 45,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green,
    borderRadius: 4,
    marginTop: 1,

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.16,
    shadowRadius: 3,
    elevation: 3,
  },

  loginButtonText: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    color: colors.white,
  },

  buttonPressed: {
    opacity: 0.82,
  },

  buttonDisabled: {
    opacity: 0.65,
  },

  signupSection: {
    marginTop: 20,
    alignItems: "center",
  },

  newUserText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 15,
  },

  signupButton: {
    width: "100%",
    minHeight: 45,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.background,

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },

  signupButtonText: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    color: colors.text,
  },

  /* FOOTER */

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    backgroundColor: colors.background,
  },

  footerPattern: {
    width: "100%",
    height: 27,
  },

  footerText: {
    paddingTop: 20,
    paddingBottom: 7,
    textAlign: "center",
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
  },
});