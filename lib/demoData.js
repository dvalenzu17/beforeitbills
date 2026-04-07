// lib/demoData.js

function iso(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  
  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + Number(days || 0));
    return d;
  }
  
  function clampDay(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 1;
    return Math.max(1, Math.min(28, Math.floor(x)));
  }
  
  export function buildDemoRecurring() {
    const now = new Date();
  
    return [
      {
        kind: "subscription",
        title: "Netflix",
        merchant: "Netflix",
        amount: 15.99,
        currency: "USD",
        cadence: "monthly",
        nextRenewal: iso(addDays(now, 6)),
        category: "Streaming",
        tags: ["demo"],
      },
      {
        kind: "subscription",
        title: "Spotify",
        merchant: "Spotify",
        amount: 10.99,
        currency: "USD",
        cadence: "monthly",
        nextRenewal: iso(addDays(now, 11)),
        category: "Music",
        tags: ["demo"],
      },
      {
        kind: "subscription",
        title: "iCloud+",
        merchant: "iCloud+",
        amount: 2.99,
        currency: "USD",
        cadence: "monthly",
        nextRenewal: iso(addDays(now, 18)),
        category: "Storage",
        tags: ["demo"],
      },
      {
        kind: "bill",
        title: "Wi-Fi",
        name: "Wi-Fi",
        merchant: "Wi-Fi",
        amount: 35,
        currency: "USD",
        dueDay: clampDay(now.getDate() + 3),
        category: "Bills",
        tags: ["demo"],
      },
      {
        kind: "bill",
        title: "Electricity",
        name: "Electricity",
        merchant: "Electricity",
        amount: 55,
        currency: "USD",
        dueDay: clampDay(now.getDate() + 9),
        category: "Bills",
        tags: ["demo"],
      },
    ];
  }
  