/** Allowed values for business records, shared by the database schema, validation and the forms. */
export const BUSINESS_STATUSES = ["active", "paused"] as const;
export const LINK_KINDS = ["page", "social", "login", "tool", "other"] as const;
export const BILLING_CYCLES = ["monthly", "yearly", "quarterly", "one_time"] as const;
