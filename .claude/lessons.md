| Date | What went wrong | Rule to prevent it |
|------|----------------|-------------------|
| 2026-03-30 | Claude over-flagged one-time charges as recurring | Check for >= 2 occurrences with consistent interval before flagging |
| 2026-04-01 | axError | After editing JS files that contain single-quoted strings, verify no non-ASCII quote chars were introduced (codes 8216/8217) |
| 2026-04-17 | Hermes VM segfault (arrayPrototypeSome) on iOS launch | Array methods called on null/undefined during initial render before async data resolves — always initialise state as [] not null for arrays; guard all .some()/.filter()/.map()/.reduce() calls on store state or async data with ?.method() or (val \|\| []).method() |