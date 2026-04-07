// components/SetupChecklistCard.js
import React, { useMemo, useState } from "react";
import { Alert, View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import Card from "./Card";
import Button from "./Button";
import PressableScale from "./PressableScale";
import Tile from "./ui/Tile";
import { useTheme } from "../lib/theme";

export default function SetupChecklistCard({
  steps,
  demoMode,
  dismissed,
  isDone,
  onDismiss,
  onEnableDemo,
  onDisableDemo,
  onMarkReviewedUpcoming,
}) {
  const t = useTheme();
  const r = useRouter();
  const [busy, setBusy] = useState(false);

  const items = [
    {
      key: "addedFirst",
      title: "Add your first recurring item",
      done: !!steps?.addedFirst,
      action: () => r.push("/add-recurring"),
    },
    {
      key: "remindersOn",
      title: "Turn on reminders",
      done: !!steps?.remindersOn,
      action: () => r.push("/account/notifications"),
    },
    {
      key: "reviewedUpcoming",
      title: "Review what's coming up",
      done: !!steps?.reviewedUpcoming,
      action: () => {
        onMarkReviewedUpcoming?.();
        r.push("/recurring");
      },
    },
  ];

  const doneCount = useMemo(() => items.filter((x) => x.done).length, [items]);
  const pct = Math.round((doneCount / items.length) * 100);

  async function handleDemoToggle() {
    try {
      setBusy(true);
      if (!demoMode) {
        const res = await onEnableDemo?.();
        if (res?.added === 0) {
          Alert.alert("Demo data", "Nothing new was added.");
        }
      } else {
        await onDisableDemo?.();
      }
    } catch (e) {
      Alert.alert("Demo data", e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  // Show the card whenever demoMode is active (so remove button is always visible),
  // OR while checklist is not yet dismissed/done
  if ((dismissed || isDone) && !demoMode) return null;

  return (
    <Card>
      {/* Header — only show progress when checklist is still active */}
      {!dismissed && !isDone && (
        <>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>
              Getting set up
            </Text>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ color: t.subtext, fontWeight: "900", fontSize: 12 }}>
                {pct}%
              </Text>
              <Pressable onPress={onDismiss} hitSlop={12}>
                <Text style={{ color: t.tertiary, fontWeight: "900" }}>✕</Text>
              </Pressable>
            </View>
          </View>

          {/* Progress bar */}
          <View
            style={{
              height: 8,
              borderRadius: 999,
              overflow: "hidden",
              backgroundColor: t.surface2,
              marginTop: 12,
            }}
          >
            <View
              style={{
                width: `${pct}%`,
                height: "100%",
                backgroundColor: t.accent,
              }}
            />
          </View>

          {/* Checklist */}
          <View style={{ marginTop: 14, gap: 8 }}>
            {items.map((x) => (
              <PressableScale key={x.key} haptic="selection" onPress={x.action}>
                <Tile
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    opacity: x.done ? 0.55 : 1,
                  }}
                >
                  <Text style={{ fontSize: 16 }}>
                    {x.done ? "✅" : "⬜️"}
                  </Text>

                  <Text
                    style={{
                      color: t.text,
                      fontWeight: "900",
                      flex: 1,
                    }}
                  >
                    {x.title}
                  </Text>

                  <Feather name="chevron-right" size={18} color={t.subtext} />
                </Tile>
              </PressableScale>
            ))}
          </View>
        </>
      )}

      {/* Demo data section — always visible when demoMode is on */}
      <View style={{ marginTop: (!dismissed && !isDone) ? 16 : 0 }}>
        {demoMode && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: t.surface2,
              borderWidth: 1,
              borderColor: t.hairline,
              marginBottom: 12,
            }}
          >
            <Feather name="info" size={14} color={t.subtext} />
            <Text style={{ color: t.subtext, fontSize: 13, fontWeight: "700", flex: 1 }}>
              Sample subscriptions are shown — this is demo data, not real.
            </Text>
          </View>
        )}

        <Button
          title={
            busy
              ? demoMode
                ? "Removing…"
                : "Adding…"
              : demoMode
              ? "Remove demo data"
              : "Try demo data"
          }
          variant={demoMode ? "secondary" : "primary"}
          onPress={handleDemoToggle}
          disabled={busy}
          left={
            <Feather
              name={demoMode ? "trash-2" : "star"}
              size={16}
              color={demoMode ? t.text : "#fff"}
            />
          }
        />

        {!demoMode && (
          <Text
            style={{
              color: t.subtext,
              fontSize: 12,
              marginTop: 8,
              lineHeight: 16,
            }}
          >
            Loads sample subscriptions so you can see how everything works.
          </Text>
        )}
      </View>
    </Card>
  );
}