import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";
import { colors, fonts } from "../theme/theme";

type Tab = "explore" | "hibernate" | "passport" | "profile";
type BottomNavProps = {
  selected: Tab;
  onExplore?: () => void;
  onHibernate?: () => void;
  onPassport?: () => void;
  onProfile?: () => void;
};

// Visual sizes can be tuned independently if PNGs contain transparent margins.
const ICON_SIZE = { explore: 31, hibernate: 30, passport: 30, profile: 30 };

export default function BottomNav({ selected, onExplore, onHibernate, onPassport, onProfile }: BottomNavProps) {
  const [profilePhotoURL, setProfilePhotoURL] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (active) setProfilePhotoURL(null);
        return;
      }
      if (active) setProfilePhotoURL(user.photoURL ?? null);
      try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        const photo = snapshot.data()?.profilePhotoURL;
        if (active && typeof photo === "string" && photo) setProfilePhotoURL(photo);
      } catch (error) {
        console.warn("Could not load navigation profile photo:", error);
      }
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  const tabs: { key: Tab; label: string; onPress?: () => void }[] = [
    { key: "explore", label: "Explore", onPress: onExplore },
    { key: "hibernate", label: "Hibernate", onPress: onHibernate },
    { key: "passport", label: "Passport", onPress: onPassport },
    { key: "profile", label: "My Profile", onPress: onProfile },
  ];

  return (
    <View style={styles.bottomNav}>
      {tabs.map(({ key, label, onPress }) => {
        const active = selected === key;
        const tintColor = active ? colors.green : colors.text;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.navItem, active && styles.navItemSelected]}
            onPress={onPress}
          >
            {key === "explore" ? (
              <Image source={require("../../assets/nav-icons/explore.png")} style={{ width: ICON_SIZE.explore, height: ICON_SIZE.explore, tintColor }} resizeMode="contain" />
            ) : key === "hibernate" ? (
              <Image source={require("../../assets/nav-icons/hibernate.png")} style={{ width: ICON_SIZE.hibernate, height: ICON_SIZE.hibernate, tintColor }} resizeMode="contain" />
            ) : key === "passport" ? (
              <Image source={require("../../assets/nav-icons/passport.png")} style={{ width: ICON_SIZE.passport, height: ICON_SIZE.passport, tintColor }} resizeMode="contain" />
            ) : (
              <View style={[styles.profileCircle, { borderColor: tintColor, width: ICON_SIZE.profile, height: ICON_SIZE.profile, borderRadius: ICON_SIZE.profile / 2 }]}>
                {profilePhotoURL ? <Image source={{ uri: profilePhotoURL }} style={styles.profileImage} resizeMode="cover" /> : <MaterialIcons name="person" size={23} color={tintColor} />}
              </View>
            )}
            <Text style={[styles.navText, active && styles.navTextSelected]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: { minHeight: 86, flexDirection: "row", alignItems: "stretch", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, backgroundColor: colors.background, paddingHorizontal: 15, paddingTop: 8, paddingBottom: 5 },
  navItem: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 3, borderTopWidth: 2, borderTopColor: "transparent" },
  navItemSelected: { borderTopColor: colors.green },
  profileCircle: { borderWidth: 2, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  profileImage: { width: "100%", height: "100%" },
  navText: { fontFamily: fonts.medium, fontSize: 11, color: colors.text, textAlign: "center" },
  navTextSelected: { fontFamily: fonts.extraBold, color: colors.green },
});
