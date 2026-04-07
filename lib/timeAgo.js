// lib/timeAgo.js
export function timeAgo(isoOrDate) {
    if (!isoOrDate) return null;
  
    const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return null;
  
    const diffMs = Date.now() - d.getTime();
    const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  
    if (diffSec < 10) return "just now";
    if (diffSec < 60) return `${diffSec}s ago`;
  
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;
  
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hr ago`;
  
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 14) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  
    try {
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return d.toISOString();
    }
  }
  