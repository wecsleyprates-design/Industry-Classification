import type {
	FieldOverridesMap,
	FieldSource,
	PerFieldOverrideEntry,
} from "./fieldSource.types";
import { SYSTEM_SOURCE } from "./fieldSource.types";

export interface FieldOverrideInfo {
	userID: string;
	timestamp: string;
}

export function extractOverride(fact: unknown): FieldOverrideInfo | null {
	if (!fact || typeof fact !== "object" || !("override" in fact)) return null;
	const override = (fact as Record<string, unknown>).override;
	if (!override || typeof override !== "object") return null;
	const o = override as Record<string, unknown>;
	if (!o.userID || !o.timestamp) return null;
	return { userID: String(o.userID), timestamp: String(o.timestamp) };
}

export function extractFieldOverrides(fact: unknown): FieldOverridesMap | null {
	if (!fact || typeof fact !== "object" || !("override" in fact)) return null;
	const override = (fact as Record<string, unknown>).override;
	if (!override || typeof override !== "object") return null;
	const o = override as Record<string, unknown>;
	if (!o.fieldOverrides || typeof o.fieldOverrides !== "object") return null;
	return o.fieldOverrides as FieldOverridesMap;
}

export function resolveFieldSource(
	isApplicantProvided: boolean,
	override: FieldOverrideInfo | null | undefined,
	userNameMap: Map<string, string> = new Map(),
): FieldSource {
	if (override) {
		return {
			type: "internal",
			userName: userNameMap.get(override.userID),
			timestamp: override.timestamp,
		};
	}
	if (isApplicantProvided) {
		return { type: "applicant" };
	}
	return SYSTEM_SOURCE;
}

/**
 * Resolve field source using per-field override entries from fieldOverrides map.
 * Used for compound facts like owners_submitted where the override applies to the
 * whole fact but each field needs independent provenance.
 */
export function resolveFieldSourceFromFieldOverrides(
	isApplicantProvided: boolean,
	fieldOverrideEntry: PerFieldOverrideEntry | null | undefined,
	userNameMap: Map<string, string> = new Map(),
): FieldSource {
	if (fieldOverrideEntry) {
		return {
			type: "internal",
			userName: userNameMap.get(fieldOverrideEntry.userID),
			timestamp: fieldOverrideEntry.timestamp,
		};
	}
	if (isApplicantProvided) {
		return { type: "applicant" };
	}
	return SYSTEM_SOURCE;
}

export interface ResolveCompoundFieldSourceParams {
	fieldKey: string;
	ownerId: string | undefined;
	isApplicantProvided: boolean;
	internallyEditedFields: string[];
	fieldOverridesMap: FieldOverridesMap | null | undefined;
	factLevelOverride: FieldOverrideInfo | null | undefined;
	userNameMap: Map<string, string>;
}

/**
 * Resolves the field source for a compound fact (e.g. owners_submitted) with
 * three resolution tiers:
 *
 * 1. Optimistic — field was edited this session → blue immediately
 * 2. Persistent — field has a per-field override in the DB → blue after refresh
 * 3. Fallback — applicant-provided → yellow, else → system
 */
export function resolveCompoundFieldSource({
	fieldKey,
	ownerId,
	isApplicantProvided,
	internallyEditedFields,
	fieldOverridesMap,
	factLevelOverride,
	userNameMap,
}: ResolveCompoundFieldSourceParams): FieldSource {
	const compositeKey = ownerId ? `${ownerId}:${fieldKey}` : undefined;
	const persistedEntry = compositeKey
		? (fieldOverridesMap?.[compositeKey] ?? null)
		: null;

	if (internallyEditedFields.includes(fieldKey)) {
		const resolvedUserID =
			persistedEntry?.userID ?? factLevelOverride?.userID;
		return {
			type: "internal",
			userName: resolvedUserID
				? userNameMap.get(resolvedUserID)
				: undefined,
			timestamp:
				persistedEntry?.timestamp ?? factLevelOverride?.timestamp,
		};
	}

	if (fieldOverridesMap && ownerId) {
		return resolveFieldSourceFromFieldOverrides(
			isApplicantProvided,
			persistedEntry,
			userNameMap,
		);
	}

	if (isApplicantProvided) {
		return { type: "applicant" };
	}
	return SYSTEM_SOURCE;
}
