// app/subs.js
// Back-compat route: subscriptions live under the unified recurring list.
import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function SubsRedirect() {
  const r = useRouter();
  useEffect(() => {
    r.replace('/recurring');
  }, [r]);
  return null;
}
