// Shared by skills, trials and stats without a skills -> stats -> trials cycle.
export const LEVEL_CAP = 99;
export const ASCENDED_LEVEL = 100;
// Existing saves may legitimately be above 99. The new path never lowers them.
export const levelOf = (s) => Math.max(s.level || 1, s.ascended ? ASCENDED_LEVEL : 1);
