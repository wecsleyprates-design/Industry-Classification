export type FieldSourceType = "applicant" | "internal" | "system";

export interface FieldSource {
	type: FieldSourceType;
	userName?: string;
	timestamp?: string;
}

export interface PerFieldOverrideEntry {
	userID: string;
	timestamp: string;
	comment: string | null;
}

export type FieldOverridesMap = Record<string, PerFieldOverrideEntry>;

export const SYSTEM_SOURCE: FieldSource = { type: "system" };
