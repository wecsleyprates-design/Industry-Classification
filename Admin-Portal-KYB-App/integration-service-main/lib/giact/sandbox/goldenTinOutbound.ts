import { decryptData } from "#utils";
import type IBanking from "#api/v1/modules/banking/types";
import type { IntegrationMode } from "#api/v1/modules/customer-integration-settings/types";

import {
	GOLDEN_TIN_GIACT_SANDBOX_BANK_OUTBOUND,
	GOLDEN_TIN_GIACT_SANDBOX_BUSINESS_OUTBOUND,
	GOLDEN_TIN_GIACT_REMAP_FROM,
	GOLDEN_TIN_GIACT_REMAP_TO
} from "../giact.constants";
import type { BusinessEntity } from "../types";

/** Normalize TIN/EIN digits for comparison (strip non-digits). */
export function normalizeTinDigits(tin: string | undefined | null): string {
	if (tin == null || tin === "") return "";
	return tin.replace(/\D/g, "");
}

/**
 * When customer GIACT integration is in SANDBOX mode and business FEIN is the golden test EIN,
 * send GIACT sandbox persona TIN outbound only. Case/business records keep the original value.
 */
export function remapBusinessFeinForSandboxGiact(strategyMode: IntegrationMode | undefined, fein: string | undefined): string {
	if (fein == null || fein === "") {
		return "";
	}
	if (strategyMode !== "SANDBOX") {
		return fein;
	}
	const normalized = normalizeTinDigits(fein);
	if (normalized === GOLDEN_TIN_GIACT_REMAP_FROM) {
		return GOLDEN_TIN_GIACT_REMAP_TO;
	}
	return fein;
}

/**
 * When SANDBOX + golden TIN, replace outbound BusinessEntity with GIACT sandbox test persona
 * (name, address, phone, FEIN) so gAuthenticate can pass; case/business records are unchanged.
 */
export function applyGoldenTinSandboxBusinessOutboundOverrides(
	strategyMode: IntegrationMode | undefined,
	businessEntity: BusinessEntity,
	tin: string | undefined
): BusinessEntity {
	const normalizedCaseTin = normalizeTinDigits(tin);
	const tinMatchesGolden = normalizedCaseTin === GOLDEN_TIN_GIACT_REMAP_FROM;

	if (strategyMode !== "SANDBOX") {
		return businessEntity;
	}
	if (!tinMatchesGolden) {
		return businessEntity;
	}
	return {
		...businessEntity,
		BusinessName: GOLDEN_TIN_GIACT_SANDBOX_BUSINESS_OUTBOUND.BusinessName,
		FEIN: GOLDEN_TIN_GIACT_REMAP_TO,
		PhoneNumber: GOLDEN_TIN_GIACT_SANDBOX_BUSINESS_OUTBOUND.PhoneNumber,
		AddressEntity: {
			AddressLine1: GOLDEN_TIN_GIACT_SANDBOX_BUSINESS_OUTBOUND.AddressEntity.AddressLine1,
			City: GOLDEN_TIN_GIACT_SANDBOX_BUSINESS_OUTBOUND.AddressEntity.City,
			State: GOLDEN_TIN_GIACT_SANDBOX_BUSINESS_OUTBOUND.AddressEntity.State,
			ZipCode: GOLDEN_TIN_GIACT_SANDBOX_BUSINESS_OUTBOUND.AddressEntity.ZipCode,
			Country: GOLDEN_TIN_GIACT_SANDBOX_BUSINESS_OUTBOUND.AddressEntity.Country
		}
	};
}

/** SANDBOX + golden TIN: outbound bank fields must match GIACT test matrix for the Smith business persona. */
export function applyGoldenTinSandboxBankOutboundOverrides(
	strategyMode: IntegrationMode | undefined,
	bankAccount: IBanking.BankAccountRecord,
	businessTin: string | undefined
): { routingNumber: string; accountNumber: string; subtypeForAccountType: string | undefined } {
	const routingNumber = decryptData(bankAccount.routing_number);
	const accountNumber = decryptData(bankAccount.bank_account);
	const tinMatchesGolden = normalizeTinDigits(businessTin) === GOLDEN_TIN_GIACT_REMAP_FROM;

	if (strategyMode !== "SANDBOX") {
		return { routingNumber, accountNumber, subtypeForAccountType: bankAccount.subtype };
	}
	if (!tinMatchesGolden) {
		return { routingNumber, accountNumber, subtypeForAccountType: bankAccount.subtype };
	}
	const isSavings = String(bankAccount.subtype || "").toLowerCase() === "savings";
	return {
		routingNumber: GOLDEN_TIN_GIACT_SANDBOX_BANK_OUTBOUND.RoutingNumber,
		accountNumber: isSavings
			? GOLDEN_TIN_GIACT_SANDBOX_BANK_OUTBOUND.SavingsAccountNumber
			: GOLDEN_TIN_GIACT_SANDBOX_BANK_OUTBOUND.CheckingAccountNumber,
		subtypeForAccountType: isSavings ? "savings" : "checking"
	};
}
