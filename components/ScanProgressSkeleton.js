// components/ScanProgressSkeleton.js
import React from "react";
import { View } from "react-native";
import Card from "./Card";
import Skeleton from "./Skeleton";

export default function ScanProgressSkeleton() {
  return (
    <Card style={{ padding: 16 }}>
      <Skeleton h={16} w={180} r={10} />
      <Skeleton h={12} w={220} r={10} style={{ marginTop: 10 }} />

      <View style={{ marginTop: 16, gap: 12 }}>
        <Skeleton h={10} w={"80%"} r={10} />
        <Skeleton h={10} w={"65%"} r={10} />
        <Skeleton h={10} w={"72%"} r={10} />
      </View>

      <Skeleton h={44} w={"100%"} r={14} style={{ marginTop: 18 }} />
    </Card>
  );
}
