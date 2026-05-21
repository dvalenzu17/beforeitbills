import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";

const TEAL  = "#1FBDA8";
const GREEN = "#2DC653";
const NAVY  = "#0F2659";

export default function SplashLoadingScreen() {
  return (
    <View style={styles.container}>
      {/* Teal glow — top-right */}
      <View style={styles.blobTeal} />
      {/* Green glow — bottom-left */}
      <View style={styles.blobGreen} />

      <View style={styles.content}>
        <Image
          source={require("../assets/splash.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.tagline}>
          Stay ahead of your bills with BeforeItBills.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FB",
  },
  blobTeal: {
    position: "absolute",
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: TEAL,
    opacity: 0.15,
  },
  blobGreen: {
    position: "absolute",
    bottom: -80,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: GREEN,
    opacity: 0.13,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    gap: 20,
  },
  logo: {
    width: 240,
    height: 240,
  },
  tagline: {
    fontSize: 14,
    fontWeight: "600",
    // #0F2659 at AA (170/255 ≈ 0.667) opacity
    color: "rgba(15, 38, 89, 0.667)",
    letterSpacing: 0.2,
    lineHeight: 21,
    textAlign: "center",
  },
});
