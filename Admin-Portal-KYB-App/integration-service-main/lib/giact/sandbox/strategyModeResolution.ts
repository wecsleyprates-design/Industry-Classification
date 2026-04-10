import { customerIntegrationSettings } from "#api/v1/modules/customer-integration-settings/customer-integration-settings";
import type { IntegrationMode } from "#api/v1/modules/customer-integration-settings/types";
import { INTEGRATION_ENABLE_STATUS } from "#constants";
import { getBusinessDetails, getCustomerBasicDetails, logger, TIN_BEHAVIOR } from "#helpers/index";
import type { UUID } from "crypto";

import { GOLDEN_TIN_GIACT_REMAP_FROM } from "../giact.constants";
import { normalizeTinDigits } from "./goldenTinOutbound";
import { customerRecordIndicatesSandbox } from "./customerOrg";

export type GiactStrategyResolution = {
	strategyMode: IntegrationMode;
};

/**
 * Legacy gVerify mode + optional upgrade to SANDBOX when GIACT integrations are active and auth indicates
 * a sandbox org. TIN comes from `getBusinessDetails` (case-service). Golden match upgrades when applicable;
 * if TIN is missing, auth-only upgrade when org is sandbox.
 */
export async function resolveGiactStrategyModeForCustomer(
	customerID: UUID,
	businessID: UUID
): Promise<GiactStrategyResolution> {
	const settings = await customerIntegrationSettings.findById(customerID);
	const gv = settings?.settings?.gverify;
	const ga = settings?.settings?.gauthenticate;

	const legacyMode = (gv?.mode || "PRODUCTION") as IntegrationMode;
	let strategyMode: IntegrationMode = legacyMode;

	const gverifyActive = gv?.status === INTEGRATION_ENABLE_STATUS.ACTIVE;
	const gauthenticateActive = ga?.status === INTEGRATION_ENABLE_STATUS.ACTIVE;
	const anyGiactIntegrationActive = gverifyActive || gauthenticateActive;

	let resolvedTinDigits: string | null = null;

	if (anyGiactIntegrationActive && legacyMode === "PRODUCTION") {
		try {
			const res = await getBusinessDetails(businessID, undefined, TIN_BEHAVIOR.PLAIN);
			if (res.status === "success" && res.data?.tin) {
				resolvedTinDigits = normalizeTinDigits(res.data.tin);
			}
		} catch (err) {
			// TIN unavailable from case API; may still upgrade on sandbox org below.

			logger.warn(
				{ businessID, err: err instanceof Error ? err.message : String(err) },
				"GIACT: getBusinessDetails failed; defaulting GIACT strategy to PRODUCTION"
			);
		}

		const goldenMatch = resolvedTinDigits === GOLDEN_TIN_GIACT_REMAP_FROM;
		const tinUnavailable = resolvedTinDigits == null;

		try {
			const basic = await getCustomerBasicDetails(customerID);
			const customerOrgIndicatesSandbox = customerRecordIndicatesSandbox(basic);

			if (customerOrgIndicatesSandbox) {
				if (goldenMatch || tinUnavailable) {
					strategyMode = "SANDBOX";
				}
			}
		} catch (err) {
			logger.warn(
				{ customerID, err: err instanceof Error ? err.message : String(err) },
				"GIACT: getCustomerBasicDetails failed; defaulting GIACT strategy to PRODUCTION"
			);
		}
	}

	return { strategyMode };
}
