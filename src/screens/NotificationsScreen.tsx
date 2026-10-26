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

import {
  colors,
  fonts,
  spacing,
} from "../theme/theme";

export type NotificationItem = {
  id: string;
  section:
    | "TODAY"
    | "YESTERDAY"
    | "EARLIER";

  type:
    | "invite"
    | "wave"
    | "experience"
    | "eventUpdate"
    | "appUpdate"
    | "stamp";

  label: string;
  title: string;
  body: string;
  time: string;
  isRead: boolean;

  experienceId?: string;
};

type NotificationsScreenProps = {
  notifications: NotificationItem[];

  onBack: () => void;

  onMarkAllAsRead: () => void;

  onNotificationPress: (
    notification: NotificationItem
  ) => void;

  onExplore: () => void;
  onAdventures: () => void;
  onPassport: () => void;
  onProfile: () => void;
};

const sections: NotificationItem["section"][] = [
  "TODAY",
  "YESTERDAY",
  "EARLIER",
];

export default function NotificationsScreen({
  notifications,
  onBack,
  onMarkAllAsRead,
  onNotificationPress,
  onExplore,
  onAdventures,
  onPassport,
  onProfile,
}: NotificationsScreenProps) {
  const unreadCount =
    notifications.filter(
      (notification) =>
        !notification.isRead
    ).length;

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "bottom"]}
    >
      <View style={styles.screen}>
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={onBack}
            hitSlop={10}
          >
            <MaterialIcons
              name="arrow-back"
              size={22}
              color={colors.text}
            />

            <Text style={styles.backText}>
              Back
            </Text>
          </Pressable>

          <Text style={styles.headerTitle}>
            Notifications
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        {/* CONTENT */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={
            styles.scrollContent
          }
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.content}>
            {/* INTRO */}
            <Text style={styles.intro}>
              Your community, quests and next adventures.
            </Text>

            {/* UNREAD */}
            <View style={styles.unreadRow}>
              <View style={styles.unreadLeft}>
                {unreadCount > 0 && (
                  <View style={styles.unreadDot} />
                )}

                <Text style={styles.unreadCount}>
                  {unreadCount > 0
                    ? `${unreadCount} unread`
                    : "All caught up"}
                </Text>
              </View>

              {unreadCount > 0 && (
                <Pressable
                  hitSlop={10}
                  onPress={onMarkAllAsRead}
                >
                  <Text
                    style={
                      styles.markAllText
                    }
                  >
                    Mark all as read
                  </Text>
                </Pressable>
              )}
            </View>

            {/* SECTIONS */}
            {sections.map((section) => {
              const sectionNotifications =
                notifications.filter(
                  (notification) =>
                    notification.section ===
                    section
                );

              if (
                sectionNotifications.length ===
                0
              ) {
                return null;
              }

              return (
                <View
                  key={section}
                  style={
                    styles.notificationSection
                  }
                >
                  <Text
                    style={
                      styles.sectionTitle
                    }
                  >
                    {section}
                  </Text>

                  <View
                    style={
                      styles.notificationList
                    }
                  >
                    {sectionNotifications.map(
                      (notification) => (
                        <NotificationCard
                          key={
                            notification.id
                          }
                          notification={
                            notification
                          }
                          onPress={() =>
                            onNotificationPress(
                              notification
                            )
                          }
                        />
                      )
                    )}
                  </View>
                </View>
              );
            })}

            <Text style={styles.endText}>
              You’re up to date with your Side Quests.
            </Text>
          </View>
        </ScrollView>

        {/* BOTTOM NAV */}
        <BottomNav selected="explore" onExplore={onExplore} onHibernate={onAdventures} onPassport={onPassport} onProfile={onProfile} />
      </View>
    </SafeAreaView>
  );
}

function NotificationCard({
  notification,
  onPress,
}: {
  notification: NotificationItem;
  onPress: () => void;
}) {
  const icon = getNotificationIcon(
    notification.type
  );

  const actionLabel =
    getActionLabel(notification.type);

  return (
    <View style={styles.notificationCard}>
      <View style={styles.cardTopRow}>
        {/* ICON */}
        <View style={styles.notificationIcon}>
          <MaterialIcons
            name={icon}
            size={23}
            color={colors.white}
          />
        </View>

        {/* CONTENT */}
        <View style={styles.cardContent}>
          <View style={styles.cardLabelRow}>
            <Text
              style={styles.cardLabel}
              numberOfLines={1}
            >
              {notification.label}
            </Text>

            <View style={styles.readStatus}>
              {!notification.isRead && (
                <View
                  style={
                    styles.statusDot
                  }
                />
              )}

              <Text
                style={[
                  styles.statusText,
                  !notification.isRead &&
                    styles.statusTextUnread,
                ]}
              >
                {notification.isRead
                  ? "Read"
                  : "Unread"}
              </Text>
            </View>
          </View>

          <Text style={styles.cardTitle}>
            {notification.title}
          </Text>

          <Text style={styles.cardBody}>
            {notification.body}
          </Text>

          <Text style={styles.cardTime}>
            {notification.time}
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              notification.type ===
                "invite" &&
                styles.actionButtonFilled,
              pressed &&
                styles.pressed,
            ]}
            onPress={onPress}
          >
            <Text
              style={[
                styles.actionButtonText,
                notification.type ===
                  "invite" &&
                  styles.actionButtonTextFilled,
              ]}
            >
              {actionLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function getNotificationIcon(
  type: NotificationItem["type"]
): keyof typeof MaterialIcons.glyphMap {
  switch (type) {
    case "invite":
      return "groups";

    case "wave":
      return "waving-hand";

    case "experience":
      return "terrain";

    case "eventUpdate":
      return "calendar-month";

    case "appUpdate":
      return "groups";

    case "stamp":
      return "workspace-premium";

    default:
      return "notifications";
  }
}

function getActionLabel(
  type: NotificationItem["type"]
) {
  switch (type) {
    case "invite":
      return "View invite";

    case "wave":
      return "Wave back";

    case "experience":
      return "View experience";

    case "eventUpdate":
      return "View experience";

    case "appUpdate":
      return "Find nearby Jimnys";

    case "stamp":
      return "View stamp";

    default:
      return "View";
  }
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
    paddingHorizontal: spacing.screen,
    borderBottomWidth:
      StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },

  backButton: {
    width: 90,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
  },

  backText: {
    marginLeft: 5,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
  },

  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: fonts.extraBold,
    fontSize: 16,
    lineHeight: 23,
    color: colors.red,
  },

  headerSpacer: {
    width: 90,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 30,
  },

  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: spacing.screen,
    paddingTop: 23,
  },

  intro: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  unreadRow: {
    width: "100%",
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 9,
  },

  unreadLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  unreadDot: {
    width: 8,
    height: 8,
    marginRight: 7,
    borderRadius: 4,
    backgroundColor: colors.red,
  },

  unreadCount: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    color: colors.text,
  },

  markAllText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.green,
    textDecorationLine: "underline",
  },

  notificationSection: {
    width: "100%",
    marginTop: 20,
  },

  sectionTitle: {
    marginBottom: 10,
    fontFamily: fonts.extraBold,
    fontSize: 12,
    color: colors.red,
  },

  notificationList: {
    width: "100%",
    gap: 12,
  },

  notificationCard: {
    width: "100%",
    paddingHorizontal: 13,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: colors.green,
    borderRadius: 4,
    backgroundColor: colors.background,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },

  cardTopRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
  },

  notificationIcon: {
    width: 46,
    height: 46,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    backgroundColor: colors.green,
  },

  cardContent: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
  },

  cardLabelRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  cardLabel: {
    flex: 1,
    paddingRight: 8,
    fontFamily: fonts.extraBold,
    fontSize: 9,
    color: colors.textSecondary,
  },

  readStatus: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
  },

  statusDot: {
    width: 6,
    height: 6,
    marginRight: 4,
    borderRadius: 3,
    backgroundColor: colors.red,
  },

  statusText: {
    fontFamily: fonts.medium,
    fontSize: 9,
    color: colors.textSecondary,
  },

  statusTextUnread: {
    color: colors.red,
  },

  cardTitle: {
    marginTop: 5,
    fontFamily: fonts.extraBold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },

  cardBody: {
    marginTop: 5,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  cardTime: {
    marginTop: 8,
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.textSecondary,
  },

  actionButton: {
    alignSelf: "flex-start",
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    paddingHorizontal: 13,
    borderWidth: 1.5,
    borderColor: colors.orange,
    borderRadius: 4,
    backgroundColor: colors.background,
  },

  actionButtonFilled: {
    borderColor: colors.green,
    backgroundColor: colors.green,
  },

  actionButtonText: {
    fontFamily: fonts.extraBold,
    fontSize: 11,
    color: colors.text,
  },

  actionButtonTextFilled: {
    color: colors.white,
  },

  endText: {
    marginTop: 30,
    marginBottom: 6,
    paddingHorizontal: 20,
    textAlign: "center",
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  bottomNav: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "stretch",
    borderTopWidth:
      StyleSheet.hairlineWidth,
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