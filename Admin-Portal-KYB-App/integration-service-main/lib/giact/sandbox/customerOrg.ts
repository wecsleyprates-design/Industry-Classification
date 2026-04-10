/**
 * Detects whether an auth "customer basic" payload represents a sandbox **organization**.
 *
 * The internal `/customers/:id/basic` response shape varies (field names, nesting), so we check
 * common patterns instead of one typed model.
 */

const FIELDS_THAT_MAY_HOLD_ORG_KIND = [
	"customer_type",
	"type",
	"environment",
	"org_type",
	"account_type",
	"tier"
] as const;

function stringIsSandbox(value: unknown): boolean {
	return typeof value === "string" && value.toUpperCase() === "SANDBOX";
}

/** True if this object itself carries a sandbox signal (no recursion). */
function objectShowsSandboxOrg(o: Record<string, unknown>): boolean {
	if (o.is_sandbox === true) {
		return true;
	}
	for (const key of FIELDS_THAT_MAY_HOLD_ORG_KIND) {
		if (stringIsSandbox(o[key])) {
			return true;
		}
	}
	return false;
}

export function customerRecordIndicatesSandbox(record: unknown): boolean {
	if (record == null || typeof record !== "object") {
		return false;
	}
	const o = record as Record<string, unknown>;

	if (objectShowsSandboxOrg(o)) {
		return true;
	}

	// Nested shapes seen on some auth responses
	if (o.customer && typeof o.customer === "object") {
		return customerRecordIndicatesSandbox(o.customer);
	}
	if (o.data && typeof o.data === "object") {
		return customerRecordIndicatesSandbox(o.data);
	}

	return false;
}
