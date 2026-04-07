// app/bills.js
// Back-compat route: bills live under the unified recurring list.
import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function BillsRedirect() {
  const r = useRouter();
  useEffect(() => {
    r.replace('/recurring');
  }, [r]);
  return null;
}
