import React, { useState } from "react";
import { View, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function PasswordInput({
  value,
  onChangeText,
  placeholder = "Password",
  style,
}) {
  const [secure, setSecure] = useState(true);

  return (
    <View style={[styles.container, style]}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secure}
        autoCapitalize="none"
      />

      <TouchableOpacity
        onPress={() => setSecure(!secure)}
        style={styles.icon}
      >
        <Ionicons
          name={secure ? "eye-off-outline" : "eye-outline"}
          size={22}
          color="#666"
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    justifyContent: "center",
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingRight: 45, // space for icon
  },
  icon: {
    position: "absolute",
    right: 15,
  },
});