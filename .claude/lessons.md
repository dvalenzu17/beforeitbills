| Date | What went wrong | Rule to prevent it |
|------|----------------|-------------------|
| 2026-03-30 | Claude over-flagged one-time charges as recurring | Check for >= 2 occurrences with consistent interval before flagging |
| 2026-04-01 | 
axError | After editing JS files that contain single-quoted strings, verify no non-ASCII quote chars were introduced (codes 8216/8217) |