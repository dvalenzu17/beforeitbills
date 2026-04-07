// lib/ui/matte.js
export function matteCard(t) {
    return {
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.hairline,
      borderRadius: t.radius ?? 18,
      ...(t.shadowMd || {}),
    };
  }
  
  export function matteField(t) {
    return {
      backgroundColor: t.surface2,
      borderWidth: 1,
      borderColor: t.hairline,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      ...(t.shadowSm || {}),
    };
  }
  
  export function mattePill(t, active) {
    return {
      backgroundColor: active ? t.accent : t.surface2,
      borderWidth: 1,
      borderColor: active ? "rgba(255,255,255,0.18)" : t.hairline,
      borderRadius: 999,
      paddingVertical: 10,
      paddingHorizontal: 14,
      ...(t.shadowSm || {}),
    };
  }
  