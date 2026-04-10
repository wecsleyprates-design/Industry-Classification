/**
 * Visibility of onboarding result rows based on customer integration settings (Worth Admin).
 * If a row is controlled by an integration that is disabled for the customer, we hide that row.
 * Rows with no mapping are shown by default.
 */

import type { CustomerIntegrationSettingResponseDataSettings } from "@/types/integrations";
import type { OnboardingResultRowId } from "./caseDecisioningResults";
import { ONBOARDING_RESULT_ROW_IDS } from "./caseDecisioningResults";

function isSettingEnabled(
	settings: CustomerIntegrationSettingResponseDataSettings | undefined,
	key: string,
): boolean {
	const setting = settings?.[key];
	if (!setting) return true; // no config = show
	if (setting.status !== "ACTIVE") return false;
	if (setting.isEnabled === false) return false;
	return true;
}

/**
 * Row IDs that are gated by a single integration setting key.
 * If the setting is disabled for the customer, the row is hidden.
 * BJL (Bankruptcies, Judgements, Liens) is one feature in Worth Admin: config -> features -> standard.
 */
const ROW_TO_SETTING_KEY: Partial<Record<OnboardingResultRowId, string>> = {
	idv_verification: "identity_verification",
	adverse_media: "adverse_media",
	website_parked_domain: "website",
	website_status: "website",
	bankruptcies: "bjl",
	judgements: "bjl",
	liens: "bjl",
};

/**
 * Row IDs gated by multiple settings (row is visible if ANY of the settings is enabled).
 * Used for e.g. GIACT rows (gverify or gauthenticate).
 */
const ROW_TO_SETTING_KEYS: Partial<Record<OnboardingResultRowId, string[]>> = {
	giact_account_status: ["gverify", "gauthenticate"],
	giact_account_name: ["gverify", "gauthenticate"],
	giact_contact_verification: ["gverify", "gauthenticate"],
};

/**
 * Returns the list of onboarding result row IDs that should be shown for this customer,
 * based on their integration settings from Worth Admin.
 * Rows not mapped to any setting are always included.
 */
export function getVisibleOnboardingResultRowIds(
	settings: CustomerIntegrationSettingResponseDataSettings | undefined,
): OnboardingResultRowId[] {
	const visible: OnboardingResultRowId[] = [];
	for (const rowId of ONBOARDING_RESULT_ROW_IDS) {
		const singleKey = ROW_TO_SETTING_KEY[rowId];
		if (singleKey != null) {
			if (!isSettingEnabled(settings, singleKey)) continue;
			visible.push(rowId);
			continue;
		}
		const keys = ROW_TO_SETTING_KEYS[rowId];
		if (keys != null && keys.length > 0) {
			const anyEnabled = keys.some((k) => isSettingEnabled(settings, k));
			if (!anyEnabled) continue;
			visible.push(rowId);
			continue;
		}
		// No mapping: show by default
		visible.push(rowId);
	}
	return visible;
}
