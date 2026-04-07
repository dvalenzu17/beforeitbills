// app/bill/[id].js
// Legacy route: bills are now unified under /recurring
import React, { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function BillRedirect() {
  const { id } = useLocalSearchParams();
  const r = useRouter();

  useEffect(() => {
    if (!id) return;
    r.replace(`/recurring/bill/${id}`);
  }, [id, r]);

  return null;
}
