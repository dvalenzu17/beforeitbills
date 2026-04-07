// components/HomeSkeleton.js
import React from "react";
import { View } from "react-native";
import Glass from "./Glass";
import Skeleton from "./Skeleton";

export default function HomeSkeleton() {
  return (
    <View style={{ gap: 14 }}>
      {/* Scan summary card skeleton */}
      <Glass intensity={22} style={{ padding: 14 }}>
        <Skeleton h={18} w={140} r={10} />
        <Skeleton h={12} w={170} r={10} style={{ marginTop: 10 }} />

        <View style={{ flexDirection: "row", gap: 14, marginTop: 14 }}>
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton h={10} w={60} r={10} />
            <Skeleton h={18} w={"70%"} r={10} />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton h={10} w={60} r={10} />
            <Skeleton h={18} w={"70%"} r={10} />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton h={10} w={60} r={10} />
            <Skeleton h={18} w={"70%"} r={10} />
          </View>
        </View>

        <Skeleton h={48} w={"100%"} r={14} style={{ marginTop: 14 }} />
      </Glass>

      {/* Upcoming list skeleton */}
      <Glass intensity={22} style={{ padding: 14 }}>
        <Skeleton h={16} w={120} r={10} />
        <View style={{ marginTop: 12, gap: 12 }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Skeleton h={34} w={34} r={12} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton h={12} w={"55%"} r={10} />
                <Skeleton h={10} w={"35%"} r={10} />
              </View>
              <Skeleton h={12} w={60} r={10} />
            </View>
          ))}
        </View>
      </Glass>

      {/* Action feed skeleton */}
      <Glass intensity={22} style={{ padding: 14 }}>
        <Skeleton h={16} w={110} r={10} />
        <View style={{ marginTop: 12, gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Skeleton h={30} w={30} r={10} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton h={12} w={"60%"} r={10} />
                <Skeleton h={10} w={"40%"} r={10} />
              </View>
            </View>
          ))}
        </View>
      </Glass>
    </View>
  );
}
