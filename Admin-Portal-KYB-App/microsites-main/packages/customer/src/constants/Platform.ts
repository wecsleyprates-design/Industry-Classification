export const PLATFORM = {
	admin: "admin",
	customer: "customer",
} as const;

export type PlatformType = (typeof PLATFORM)[keyof typeof PLATFORM];
