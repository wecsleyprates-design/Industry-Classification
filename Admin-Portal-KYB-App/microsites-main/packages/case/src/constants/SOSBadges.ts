export const SOS_BADGE_TEXT = {
	VERIFIED: "Verified",
	UNVERIFIED: "Unverified",
	MISSING_ACTIVE_FILING: "Missing Active Filing",
	INVALIDATED: "Needs Re-verification",
} as const;

export const SOS_BADGE_TOOLTIPS = {
	VERIFIED: "An active filing was found and is in good standing.",
	UNVERIFIED: "A filing was found but its status is unknown.",
	MISSING_ACTIVE_FILING_INACTIVE:
		"A filing was found but is not currently active.",
	MISSING_ACTIVE_FILING_NONE:
		"No active Secretary of State filing found for this business.",
	INVALIDATED:
		"These findings were invalidated because business registration details were changed. Re-verification is required.",
} as const;

export const SOS_BADGE_TYPES = {
	VERIFIED: "green_tick",
	UNVERIFIED: "warning",
	MISSING_ACTIVE_FILING: "red_exclamation_circle",
} as const;
