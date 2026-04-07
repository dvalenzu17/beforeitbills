import React, { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';

export default function AddBillRedirect() {
  const r = useRouter();
  const redirected = useRef(false);

  useEffect(() => {
    if (redirected.current) return;
    redirected.current = true;
    r.replace('/add-recurring?kind=bill');
  }, []);

  return null;
}