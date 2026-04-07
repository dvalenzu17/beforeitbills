import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../lib/theme";

export default function ThemeBackground({ children }) {
  const t = useTheme();

  return (
    <LinearGradient
      colors={[t.grad1, t.grad2]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ flex: 1 }}
    >
      {children}
    </LinearGradient>
  );
}