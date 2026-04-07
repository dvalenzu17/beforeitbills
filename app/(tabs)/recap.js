// app/(tabs)/recap.js
// Legacy route: Recap lives inside Insights now.
import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function RecapRedirect() {
  const r = useRouter();
  useEffect(() => {
    r.replace('/(tabs)/insights?recap=1');
  }, [r]);
  return null;
}
