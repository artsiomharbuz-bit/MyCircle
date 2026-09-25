// Shared, dependency-free poll constants — imported by both the Convex
// functions (which validate against them) and the screens (which render
// them), same pattern as adPricing.ts / moderationOptions.ts.

export const MIN_POLL_OPTIONS = 2;
export const MAX_POLL_OPTIONS = 6;
export const MAX_POLL_QUESTION_LENGTH = 140;
export const MAX_POLL_OPTION_LENGTH = 40;
