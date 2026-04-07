// components/Skeleton.js
import React, { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import { useTheme } from "../lib/theme";

export default function Skeleton({ h = 14, w = "100%", r = 12, style }) {
  const t = useTheme();
  const a = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 0.95, duration: 700, useNativeDriver: true }),
        Animated.timing(a, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [a]);

  return (
    <Animated.View style={{ opacity: a }}>
      <View
        style={[
          {
            height: h,
            width: w,
            borderRadius: r,
            backgroundColor: t.hairline,
          },
          style,
        ]}
      />
    </Animated.View>
  );
}
