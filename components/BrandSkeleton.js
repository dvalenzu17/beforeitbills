// components/BrandSkeleton.js
import React from "react";
import { View } from "react-native";
import Glass from "./Glass";
import Skeleton from "./Skeleton";
import { SPACING } from "../lib/ui/tokens";
export default function BrandSkeleton() {
  return (
    <View style={{ padding: 16, gap: 14 }}>
      <Glass intensity={22} style={{ padding: SPACING.screen }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Skeleton h={44} w={44} r={16} />
          <View style={{ flex: 1, gap: 10 }}>
            <Skeleton h={16} w={"55%"} r={10} />
            <Skeleton h={12} w={"35%"} r={10} />
          </View>
        </View>

        <View style={{ marginTop: 14, gap: 10 }}>
          <Skeleton h={12} w={140} r={10} />
          <Skeleton h={44} w={"100%"} r={14} />
        </View>
      </Glass>

      <Glass intensity={22} style={{ padding: 14 }}>
        <Skeleton h={14} w={160} r={10} />
        <View style={{ marginTop: 12, gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ gap: 8 }}>
              <Skeleton h={12} w={"70%"} r={10} />
              <Skeleton h={10} w={"90%"} r={10} />
            </View>
          ))}
        </View>
      </Glass>
    </View>
  );
}
