// components/ToastProvider.js
import React, { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useTheme } from "../lib/theme";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const t = useTheme();

  const [toast, setToast] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;

  const hide = useCallback(() => {
    Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      setToast(null);
    });
  }, [opacity]);

  useEffect(() => {
    if (!toast) return;
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();

    const ms = toast?.durationMs ?? 2200;
    const id = setTimeout(() => hide(), ms);
    return () => clearTimeout(id);
  }, [toast, opacity, hide]);

  const show = useCallback((opts) => {
    // opts: { message: string, actionLabel?: string, onAction?: () => void, durationMs?: number }
    setToast({
      message: opts?.message ?? "",
      actionLabel: opts?.actionLabel,
      onAction: opts?.onAction,
      durationMs: opts?.durationMs,
    });
  }, []);

  const api = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <ToastCtx.Provider value={api}>
      {children}

      {!!toast && (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 18,
            opacity,
            transform: [
              {
                translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }),
              },
            ],
          }}
        >
          <View
            style={{
              backgroundColor: t.surface,
              borderColor: t.hairline,
              borderWidth: 1,
              borderRadius: 16,
              paddingVertical: 12,
              paddingHorizontal: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Text style={{ color: t.text, fontWeight: "800", flex: 1 }} numberOfLines={2}>
              {toast.message}
            </Text>

            {toast.actionLabel && toast.onAction ? (
              <Pressable
                onPress={() => {
                  toast.onAction?.();
                  hide();
                }}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: t.accent,
                }}
              >
                <Text style={{ color: "#0B0B10", fontWeight: "900" }}>{toast.actionLabel}</Text>
              </Pressable>
            ) : null}

            <Pressable onPress={hide} hitSlop={10}>
              <Text style={{ color: t.subtext, fontWeight: "900" }}>✕</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider />");
  return ctx;
}
