import { getCustomerBasicDetails } from "#helpers/index";
import type { UUID } from "crypto";

import { customerRecordIndicatesSandbox } from "./customerOrg";

/**
 * Whether to add `customer_org_sandbox=true` on internal case-service getBusinessDetails.
 * Integration-service asserts sandbox org from auth; case-service does not call auth.
 */
export async function getCustomerOrgSandboxFlagForCaseBusinessDetails(
	customerID: UUID | undefined
): Promise<boolean | undefined> {
	if (!customerID) {
		return undefined;
	}
	try {
		const basic = await getCustomerBasicDetails(customerID);
		return customerRecordIndicatesSandbox(basic) ? true : undefined;
	} catch {
		return undefined;
	}
}
