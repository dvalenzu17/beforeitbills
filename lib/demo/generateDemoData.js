// utils/generateDemoData.js

const NAMES = [
  "Michael Johnson", "Emily Davis", "Chris Martinez", "Jessica Brown",
  "David Wilson", "Sarah Miller", "Daniel Anderson", "Ashley Thomas",
  "Matthew Taylor", "Amanda Moore"
];

const MERCHANTS = [
  { name: "Netflix", price: 15.49, category: "Entertainment" },
  { name: "Spotify", price: 9.99, category: "Music" },
  { name: "Amazon Prime", price: 14.99, category: "Shopping" },
  { name: "Hulu", price: 11.99, category: "Entertainment" },
  { name: "Apple iCloud", price: 2.99, category: "Storage" },
  { name: "YouTube Premium", price: 13.99, category: "Entertainment" },
  { name: "Gym Membership", price: 29.99, category: "Fitness" },
  { name: "Dropbox", price: 9.99, category: "Storage" }
];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomAmount(base) {
  return (base + Math.random() * 3).toFixed(2);
}

export function generateDemoUser() {
  const name = randomFrom(NAMES);

  const subs = Array.from({ length: 3 + Math.floor(Math.random() * 4) }).map(() => {
    const m = randomFrom(MERCHANTS);
    return {
      id: Math.random().toString(36).substring(7),
      name: m.name,
      amount: parseFloat(randomAmount(m.price)),
      category: m.category,
      nextBilling: randomFutureDate(),
    };
  });

  const total = subs.reduce((acc, s) => acc + s.amount, 0);

  return {
    name,
    subscriptions: subs,
    totalMonthly: parseFloat(total.toFixed(2)),
  };
}

function randomFutureDate() {
  const now = new Date();
  const future = new Date(now);
  future.setDate(now.getDate() + Math.floor(Math.random() * 30));
  return future.toISOString();
}