import type { IntegrationFactGetMetadata } from "../types";
import type { BusinessAddress } from "#helpers/api";
import { allFacts, FactEngineWithDefaultOverrides, FactRules } from "#lib/facts";
import type { FactName } from "#lib/facts/types";
import { createAdapter } from "../shared/createAdapter";
import { RerunVerdataTaskMetadata } from "#lib/verdata/types/RerunVerdataTaskMetadata";
import { AddressUtil } from "#utils";
import { isVerdataOrder, isCompleteVerdataOrder } from "#lib/verdata/typeguards";
import { defaultAdapterProcessFunction } from "../shared/defaultAdapterProcessFunction";
import { processWithExistingBusinessScoreTrigger } from "../shared/processWithExistingScoreTrigger";
import type { UUID } from "crypto";
import { CaseServiceClient } from "#clients";
import { getFlagValue } from "#helpers";
import { FEATURE_FLAGS } from "#constants";

const FACT_NAMES: FactName[] = ["business_name", "dba", "primary_address", "addresses", "tin"];

const getMetadata: IntegrationFactGetMetadata<RerunVerdataTaskMetadata> = async businessID => {
	const facts = allFacts.filter(fact => FACT_NAMES.includes(fact.name));
	const factEngine = new FactEngineWithDefaultOverrides(facts, { business: businessID });
	await factEngine.applyRules(FactRules.factWithHighestConfidence);

	const tin = factEngine.getResolvedFact<string>("tin")?.value;
	const businessName = factEngine.getResolvedFact<string>("business_name")?.value;
	const dba = factEngine.getResolvedFact<string[]>("dba")?.value;
	const primaryAddress = factEngine.getResolvedFact<BusinessAddress>("primary_address")?.value;
	const addresses = factEngine.getResolvedFact<string[]>("addresses")?.value;

	const order: RerunVerdataTaskMetadata = {
		business_id: businessID,
		name: "",
		address_line_1: "",
		city: "",
		state: "",
		zip5: ""
	};

	if (tin) order.ein = tin;

	const name = businessName || dba?.[0] || "";
	if (name) order.name = name;

	const nameDba = dba?.find(n => n.toLowerCase() !== name.toLowerCase());
	if (nameDba) order.name_dba = nameDba;

	if (primaryAddress) {
		order.address_line_1 = primaryAddress.line_1;
		if (primaryAddress.apartment) order.address_line_2 = primaryAddress.apartment;
		order.city = primaryAddress.city;
		order.state = primaryAddress.state;
		order.zip5 = primaryAddress.postal_code?.slice(0, 5) ?? "";
	} else if (addresses?.length) {
		const address = addresses[0];
		const parts = AddressUtil.stringToParts(address);
		order.address_line_1 = parts.line_1 ?? "";
		if (parts.line_2) order.address_line_2 = parts.line_2;
		order.city = parts.city ?? "";
		order.state = parts.state ?? "";
		order.zip5 = parts.postal_code?.slice(0, 5) ?? "";
	}

	return order;
};

const isValidMetadata = (metadata: RerunVerdataTaskMetadata | undefined): boolean =>
	metadata !== undefined && isVerdataOrder(metadata) && isCompleteVerdataOrder(metadata);

export const verdataAdapter = createAdapter<RerunVerdataTaskMetadata>({
	getMetadata,
	factNames: FACT_NAMES,
	isValidMetadata,
	process: async params => {
		const caseServiceClient = new CaseServiceClient();
		const { data: business } = await caseServiceClient.getBusinessById(params.business_id as UUID);
		if (!business) throw new Error(`Business not found for business_id: ${params.business_id}`);

		const isCaseManagementEditingFeatureFlagEnabled = await getFlagValue(FEATURE_FLAGS.PAT_874_CM_APP_EDITING, {
			key: "customer",
			kind: "customer",
			customer_id: business.customer_id
		});

		/**
		 * Q: Why is this here?
		 * A: @see https://worthcrew.slack.com/archives/C061K1T28QG/p1774968283880969
		 */
		if (isCaseManagementEditingFeatureFlagEnabled) {
			return defaultAdapterProcessFunction(params);
		} else {
			return processWithExistingBusinessScoreTrigger(params.business_id as UUID, "VERDATA", "fetch_public_records");
		}
	}
});
