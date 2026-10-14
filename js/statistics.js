const Stats = {
  fmtMs: ms => ms < 1 ? '<1 ms' : ms.toFixed(1) + ' ms',
  // Estimate only: IDDLS stores the recursion path plus a set of path states.
  memoryEstimate(depth) { return `~${((depth + 1) * 120 / 1024).toFixed(1)} KB (estimate)`; }
};
