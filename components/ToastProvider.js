// components/ToastProvider.js
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useTheme } from "../lib/theme";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const t = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  const timerRef = useRef(null);

  const [toast, setToast] = useState({
    visible: false,
    message: "",
    actionLabel: null,
    onAction: null,
    duration: 3200,
  });

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setToast((x) => ({ ...x, visible: false }));
  }, []);

  const show = useCallback(
    ({ message, actionLabel = null, onAction = null, duration = 3200 } = {}) => {
      if (!message) return;
      if (timerRef.current) clearTimeout(timerRef.current);

      setToast({
        visible: true,
        message,
        actionLabel,
        onAction,
        duration,
      });

      timerRef.current = setTimeout(() => hide(), duration);
    },
    [hide]
  );

  useEffect(() => {
    Animated.timing(anim, {
      toValue: toast.visible ? 1 : 0,
      duration: toast.visible ? 180 : 160,
      useNativeDriver: true,
    }).start();
  }, [toast.visible, anim]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);
  const api = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <ToastCtx.Provider value={api}>
      <View style={{ flex: 1 }}>
        {children}

        {toast.visible ? (
          <Animated.View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              left: 16,
              right: 16,
              bottom: 18,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }),
                },
              ],
              opacity: anim,
            }}
          >
            <View
              style={{
                backgroundColor: t.surface,
                borderWidth: 1,
                borderColor: t.hairline,
                borderRadius: 16,
                paddingVertical: 12,
                paddingHorizontal: 14,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <Text
                style={{ color: t.text, fontWeight: "800", flex: 1 }}
                numberOfLines={2}
              >
                {toast.message}
              </Text>

              {toast.actionLabel ? (
                <Pressable
                  onPress={() => {
                    try {
                      toast.onAction?.();
                    } finally {
                      hide();
                    }
                  }}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    backgroundColor: t.accent,
                  }}
                >
                  <Text style={{ color: "#0B0B10", fontWeight: "900" }}>
                    {toast.actionLabel}
                  </Text>
                </Pressable>
              ) : null}

              <Pressable onPress={hide} hitSlop={10}>
                <Text style={{ color: t.subtext, fontWeight: "900" }}>✕</Text>
              </Pressable>
            </View>
          </Animated.View>
        ) : null}
      </View>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    throw new Error("useToast must be used within <ToastProvider />");
  }
  return ctx;
}
