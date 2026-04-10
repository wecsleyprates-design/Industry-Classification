import qs from "qs";
import { api } from "@/lib/api";
import { type ApiResponse } from "@/types/api";
import {
	type GetBankingIntegrationResponse,
	type GetBankingUploadsResponse,
} from "@/types/banking";
import {
	type BusinessApplicantVerificationResponse,
	type BusinessEntityVerificationResponse,
	type BusinessVerificationEntityRecord,
	type ExtractedVerificationUploadsResponse,
	type GetBusinessTradeLinesResponse,
	type UpdateBusinessEntityRequest,
	type WatchlistPersonResponse,
} from "@/types/businessEntityVerification";
import { type AdverseMediaResponse } from "@/types/case";
import {
	type BalanceSheetUpdatedResponse,
	type BusinessNpiResponse,
	type BusinessWebsiteResponse,
	type CaseTabValuesData,
	type createMerchantProfilePayload,
	type CustomerIntegrationSettingsResponse,
	type EquifaxCreditReportDataResponse,
	type FactBusinessDetailsResponseType,
	type FactsBusinessFinancialsResponseType,
	type FactsBusinessKybResponseType,
	type FactsKycResponse,
	type GetAllDocumentsResponse,
	type GetCaseTabValuesResponse,
	type GetCustomerBusinessOwnerScoresResponse,
	type GetFactsBusinessBJLResponse,
	type getPaymentProcessorResponse,
	type GetProcessingStatementsResponse,
	type GoogleProfileResponse,
	type IncomeStatementUpdatedResponse,
	type MatchProConnectionStatusResponse,
	type MatchResultResponse,
	type MerchantAccountResponse,
	type MerchantProfileResponse,
	type NpiDoctorsResponse,
	type onboardPaymentProcessorAccountsPayload,
	type OnboardPaymentProcessorAccountsResponse,
	type PublicRecordsData,
	type RerunIntegrationsRequestBody,
	type RunMatchProParams,
} from "@/types/integrations";
import { type ProcessingStatementsResponse } from "@/types/processingStatements";
import { type TaxesResponseType } from "@/types/taxes";
import {
	type GetTransactionRequestPayload,
	type GetTransactionResponse,
	type GetTransactionsAccountsResponse,
} from "@/types/transactions";

import MICROSERVICE from "@/constants/Microservices";

export const getIntegrations = async (businessID: string) => {
	const url: string = `${MICROSERVICE.INTEGRATION}/businesses/${businessID}/integrations`;
	const { data } = await api.get(url);
	return data;
};

export const getBusinessPublicRecords = async (payload: {
	businessId: string;
	caseId?: string;
	scoreTriggerId?: string;
}) => {
	const { businessId, caseId, scoreTriggerId } = payload;
	const url: string = `${MICROSERVICE.INTEGRATION}/business/${businessId}/public-records`;
	const { data } = await api.get<ApiResponse<PublicRecordsData>>(url, {
		params: {
			...(scoreTriggerId
				? { score_trigger_id: scoreTriggerId }
				: caseId && { case_id: caseId }),
		},
	});
	return data;
};

export const getBankingIntegration = async (payload: {
	businessId: string;
	caseId?: string;
	scoreTriggerId?: string;
}): Promise<GetBankingIntegrationResponse> => {
	const { scoreTriggerId, caseId, businessId } = payload;
	const url = `${MICROSERVICE.INTEGRATION}/business/${businessId}/banking`;
	const { data } = await api.get(url, {
		params: {
			...(scoreTriggerId
				? { score_trigger_id: scoreTriggerId }
				: caseId && { caseID: caseId }),
		},
	});
	return data;
};

export const getTaxStatus = async (payload: {
	businessId: string;
	caseId?: string;
	scoreTriggerId?: string;
}): Promise<TaxesResponseType> => {
	const { businessId, caseId, scoreTriggerId } = payload;
	const url = `${MICROSERVICE.INTEGRATION}/accounting/tax-filing/business/${businessId}`;
	const { data } = await api.get(url, {
		params: {
			...(scoreTriggerId
				? { score_trigger_id: scoreTriggerId }
				: caseId && { caseID: caseId }),
		},
	});
	return data;
};

export const getAccountingBalanceSheet = async (businessId: string) => {
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/accounting/report/${businessId}/accounting_balancesheet/?groupBy=business`,
	);
	return data;
};

export const getVerificationBusinessPeopleWatchlist = async (
	businessId: string,
): Promise<WatchlistPersonResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/verification/businesses/${businessId}/people/watchlist`,
	);
	return data;
};

export const getAccountingIncomeStatement = async (businessId: string) => {
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/accounting/report/${businessId}/accounting_incomestatement/?groupBy=business`,
	);
	return data;
};

export const getAdverseMedia = async (
	caseId: string,
	sortFields: Array<{ field: string; order: "asc" | "desc" }> = [
		{ field: "entity_focus_score", order: "desc" },
		{ field: "risk_level", order: "asc" },
		{ field: "final_score", order: "desc" },
	],
): Promise<AdverseMediaResponse> => {
	const url = `${MICROSERVICE.INTEGRATION}/cases/${caseId}/adverse-media`;
	const { data } = await api.get(url, {
		params: { sortFields },
	});
	return data;
};

export const getAdverseMediaByBusinessId = async (
	businessId: string,
	sortFields: Array<{ field: string; order: "asc" | "desc" }> = [
		{ field: "entity_focus_score", order: "desc" },
		{ field: "risk_level", order: "asc" },
		{ field: "final_score", order: "desc" },
	],
): Promise<AdverseMediaResponse> => {
	const url = `${MICROSERVICE.INTEGRATION}/business/${businessId}/adverse-media`;
	const { data } = await api.get(url, {
		params: { sortFields },
	});
	return data;
};

export const getGoogleProfileByBusinessId = async (
	businessId: string,
): Promise<ApiResponse<GoogleProfileResponse>> => {
	const url = `${MICROSERVICE.INTEGRATION}/businesses/${businessId}/google-profile`;
	const { data } = await api.get(url);
	return data;
};

export const getEquifax = async ({
	customerId,
	businessId,
	caseId,
	scoreTriggerId,
}: {
	customerId: string;
	businessId: string;
	caseId?: string;
	scoreTriggerId?: string;
}) => {
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/bureau/score/customers/${customerId}/business/${businessId}/owners`,
		{
			params: {
				...(caseId ? { case_id: caseId } : null),
				...(scoreTriggerId
					? { business_score_trigger_id: scoreTriggerId }
					: {}),
			},
		},
	);
	return data;
};

export const getBusinessEntity = async (
	businessId: string,
): Promise<BusinessEntityVerificationResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/verification/businesses/${businessId}/business-entity`,
	);
	return data;
};

export const getApplicantVerificationDetails = async (
	businessId: string,
	applicantId: string,
): Promise<BusinessApplicantVerificationResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/verification/businesses/${businessId}/applicant/${applicantId}`,
	);
	return data;
};

export const getBusinessVerificationDetails = async (
	businessId: string,
): Promise<BusinessEntityVerificationResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/verification/businesses/${businessId}/business-entity`,
	);
	return data;
};

export const updateBusinessEntityDetails = async ({
	businessId,
	body,
}: {
	businessId: string;
	body: Partial<UpdateBusinessEntityRequest>;
}): Promise<BusinessVerificationEntityRecord> => {
	const { data } = await api.post(
		`${MICROSERVICE.INTEGRATION}/verification/businesses/${businessId}/update-business-entity`,
		body,
	);
	return data;
};

export const submitBusinessVerificationOrder = async (
	businessId: string,
): Promise<BusinessVerificationEntityRecord> => {
	const { data } = await api.post(
		`${MICROSERVICE.INTEGRATION}/verification/businesses/${businessId}/verify-business-entity`,
	);
	return data;
};

export const getBusinessTradeLines = async (payload: {
	businessId: string;
	caseId?: string;
	scoreTriggerId?: string;
}): Promise<GetBusinessTradeLinesResponse> => {
	const { businessId, caseId, scoreTriggerId } = payload;
	const url = `${MICROSERVICE.INTEGRATION}/businesses/${businessId}/trade-lines`;
	const response = await api.get(url, {
		params: {
			...(scoreTriggerId
				? { score_trigger_id: scoreTriggerId }
				: caseId && { case_id: caseId }),
		},
	});
	return response.data;
};

export const getVerificationUploads = async (
	businessId: string,
): Promise<ExtractedVerificationUploadsResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/business/${businessId}/extracted-verification-uploads`,
	);
	return data;
};

export const downloadVerificationUpload = async (
	businessId: string,
	uploadId: string,
	fileName: string,
): Promise<void> => {
	const response = await api.get(
		`${MICROSERVICE.INTEGRATION}/business/${businessId}/verification-file-uploaded/${uploadId}`,
		{ responseType: "blob" },
	);
	const blob = new Blob([response.data], {
		type: response.headers["content-type"],
	});
	const url = window.URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.setAttribute("download", fileName);
	document.body.appendChild(link);
	link.click();
	link.remove();
	window.URL.revokeObjectURL(url);
};

export const getProcessingStatementsExtraction = async (
	businessId: string,
): Promise<ProcessingStatementsResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/businesses/${businessId}/document-extractions`,
	);
	return data;
};

export const downloadOcrDocumentUpload = async (
	businessId: string,
	filePath: string,
	fileName: string,
): Promise<void> => {
	const response = await api.get(
		`${MICROSERVICE.INTEGRATION}/businesses/${businessId}/document-uploaded/extraction?filePath=${filePath}`,
		{ responseType: "blob" },
	);
	const blob = new Blob([response.data], {
		type: response.headers["content-type"],
	});
	const url = window.URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.setAttribute("download", fileName);
	document.body.appendChild(link);
	link.click();
	link.remove();
	window.URL.revokeObjectURL(url);
};

export const getBusinessWebsite = async (payload: {
	businessId: string;
	caseId?: string;
	scoreTriggerId?: string;
}): Promise<BusinessWebsiteResponse> => {
	const { businessId } = payload;
	const url = `${MICROSERVICE.INTEGRATION}/verification/businesses/${businessId}/website-data`;
	const { data } = await api.get(url);
	return data;
};

export const getAccountingBalanceSheetUpdate = async (businessId: string) => {
	const { data } = await api.get<BalanceSheetUpdatedResponse>(
		`${MICROSERVICE.INTEGRATION}/accounting/${businessId}/financials/balancesheet`,
	);
	return data;
};

export const getAccountingIncomeStatementUpdate = async (
	businessId: string,
): Promise<IncomeStatementUpdatedResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/accounting/${businessId}/financials/income-statement`,
	);
	return data;
};

export const getFactsBusinessFinancials = async (
	businessId: string,
): Promise<ApiResponse<FactsBusinessFinancialsResponseType>> => {
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/facts/business/${businessId}/financials`,
	);
	return data;
};

export const getFactsBusinessBJL = async (
	businessId: string,
): Promise<ApiResponse<GetFactsBusinessBJLResponse>> => {
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/facts/business/${businessId}/bjl`,
	);
	return data;
};

export const getFactsKyb = async (
	businessId: string,
): Promise<ApiResponse<FactsBusinessKybResponseType>> => {
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/facts/business/${businessId}/kyb`,
	);
	return data;
};

export const getFactsBusinessDetails = async (
	businessId: string,
): Promise<ApiResponse<FactBusinessDetailsResponseType>> => {
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/facts/business/${businessId}/details`,
	);
	return data;
};
export const getProxyFacts = async (
	businessId: string,
	category?: string,
): Promise<
	ApiResponse<FactBusinessDetailsResponseType> &
		ApiResponse<FactsBusinessKybResponseType> &
		ApiResponse<GetFactsBusinessBJLResponse> &
		ApiResponse<FactsBusinessFinancialsResponseType>
> => {
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/proxy/facts/business/${businessId}`,
		{ params: { category } },
	);
	return data;
};

export const getTransaction = async (
	payload: GetTransactionRequestPayload,
): Promise<GetTransactionResponse> => {
	const { businessId, params } = payload;
	const response = await api.get<GetTransactionResponse>(
		`${
			MICROSERVICE.INTEGRATION
		}/banking/business/${businessId}/transactions${
			params ? `?${qs.stringify(params)}` : ""
		}`,
	);
	return response.data;
};

export const getTransactionsAccounts = async (
	businessId: string,
	caseId?: string,
): Promise<GetTransactionsAccountsResponse> => {
	const params = new URLSearchParams();
	if (caseId) {
		params.append("caseID", caseId);
	}
	const url: string = `${
		MICROSERVICE.INTEGRATION
	}/banking/business/${businessId}/transactions/accounts${
		params.toString() ? `?${params.toString()}` : ""
	}`;
	const { data } = await api.get<GetTransactionsAccountsResponse>(url);
	return data;
};

export const exportTransactionsAsCSV = async (
	businessId: string,
	caseId?: string,
	filters?: {
		period?: string;
		accountName?: string;
	},
): Promise<string> => {
	const params = new URLSearchParams();
	if (caseId) {
		params.append("caseID", caseId);
	}
	if (filters?.period) {
		params.append("period", filters.period);
	}
	if (filters?.accountName && filters.accountName !== "All Accounts") {
		params.append("filter_account_name", filters.accountName);
	}

	const url: string = `${
		MICROSERVICE.INTEGRATION
	}/banking/business/${businessId}/transactions/export${
		params.toString() ? `?${params.toString()}` : ""
	}`;
	const response = await api.get<{ data: { file_path: string } }>(url);
	return response.data.data.file_path;
};

export const getEquifaxCreditReport = async (
	businessId: string,
	caseId?: string,
): Promise<EquifaxCreditReportDataResponse> => {
	const response = await api.get(
		`${MICROSERVICE.INTEGRATION}/bureau/business/${businessId}/report`,
		{ params: { ...(caseId ? { case_id: caseId } : {}) } },
	);
	return response.data;
};

export const getCustomerBusinessOwnerScores = async (
	customerId: string,
	businessId: string,
) => {
	const response = await api.get<GetCustomerBusinessOwnerScoresResponse>(
		`${MICROSERVICE.INTEGRATION}/bureau/score/customers/${customerId}/business/${businessId}/owners`,
	);
	return response.data;
};

export const getProcessingHistory = async (
	businessId: string,
	caseId: string,
): Promise<GetProcessingStatementsResponse> => {
	const url = `${MICROSERVICE.INTEGRATION}/business/${businessId}/processing-history`;
	const { data } = await api.get(url, {
		params: {
			case_id: caseId,
		},
	});
	return data;
};

/**
 * Get processing history facts with overrides applied via FactEngine
 * Use this endpoint to get values that include any fact overrides
 */
export const getProcessingHistoryFacts = async (
	businessId: string,
): Promise<ApiResponse<Record<string, any>>> => {
	const url = `${MICROSERVICE.INTEGRATION}/facts/business/${businessId}/processing-history`;
	const { data } = await api.get(url);
	return data;
};

export const getSubDomainInfo = async (customerId: string) => {
	const { data } = await api.get(
		`${MICROSERVICE.NOTIFICATION}/customers/${customerId}/settings`,
	);
	return data;
};

export const getAllDocuments = async ({
	businessId,
	caseId,
}: {
	businessId: string;
	caseId?: string;
}): Promise<GetAllDocumentsResponse> => {
	const url = `${MICROSERVICE.INTEGRATION}/documents/businesses/${businessId}`;
	const { data } = await api.get(url, { params: { caseID: caseId } });
	return data;
};

/**
 * Fetches case tab values (all properties for decisioning/onboarding results).
 * GET /business/:businessId/case/:caseId/values
 *
 * Design: Single request returns full values; no tab or rowIds query params.
 * This keeps one cache key per (businessId, caseId). The frontend filters
 * which rows to show per tab when rendering (see CaseDecisioningResults).
 */
export const getCaseTabValues = async ({
	businessId,
	caseId,
}: {
	businessId: string;
	caseId: string;
}): Promise<GetCaseTabValuesResponse> => {
	const url = `${MICROSERVICE.INTEGRATION}/business/${businessId}/case/${caseId}/values`;
	const { data } = await api.get<GetCaseTabValuesResponse>(url);
	return data;
};

/**
 * Sets case tab values baseline to now (Re-verify Data Now). Populates case_results_executions
 * so GET /values returns created_at = now, has_updates_since_generated = false, updates_count = 0.
 * PATCH /business/:businessId/case/:caseId/values/acknowledge
 */
export const acknowledgeCaseTabValues = async ({
	businessId,
	caseId,
}: {
	businessId: string;
	caseId: string;
}): Promise<ApiResponse<{ updated_at: string }>> => {
	const url = `${MICROSERVICE.INTEGRATION}/business/${businessId}/case/${caseId}/values/acknowledge`;
	const { data } = await api.patch<ApiResponse<{ updated_at: string }>>(url);
	return data;
};

export const getBusinessNpi = async (
	businessId: string,
): Promise<BusinessNpiResponse> => {
	const url = `${MICROSERVICE.INTEGRATION}/verification/businesses/${businessId}/healthcare`;
	const { data } = await api.get(url);
	return data;
};

export const getNpiDoctors = async (
	businessId: string,
	params: Record<string, string | number | boolean> = {},
): Promise<NpiDoctorsResponse> => {
	const queryString = qs.stringify({ doctor_licenses: true, ...params });

	const url = `${MICROSERVICE.INTEGRATION}/verification/businesses/healthcare/doctors?${queryString}`;

	const { data } = await api.post(url, {
		business_id: businessId,
	});
	return data;
};
export const getWebsiteScreenshotUrl = async (fileKey: string) => {
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/file/website-screenshot?key=${fileKey}`,
	);
	return data;
};

export const getBankingUploads = async (payload: {
	businessId: string;
	caseId?: string;
}): Promise<GetBankingUploadsResponse> => {
	const { caseId, businessId } = payload;
	const url = `${MICROSERVICE.INTEGRATION}/banking/business/${businessId}/bank-statements`;
	const { data } = await api.get(url, {
		params: {
			...(caseId && { caseID: caseId }),
		},
	});
	return data;
};

export const getAccountingUploads = async (payload: {
	businessId: string;
	caseId?: string;
}): Promise<GetBankingUploadsResponse> => {
	const { caseId, businessId } = payload;
	const url = `${MICROSERVICE.INTEGRATION}/accounting/business/${businessId}/accounting-statements`;
	const { data } = await api.get(url, {
		params: {
			...(caseId && { caseID: caseId }),
		},
	});
	return data;
};

export const getCustomerIntegrationSettings = async (customerId: string) => {
	const url = `${MICROSERVICE.INTEGRATION}/customer-integration-settings/${customerId}`;
	const { data } = await api.get<CustomerIntegrationSettingsResponse>(url);
	return data;
};

export const getMatchProData = async (
	businessId: string,
): Promise<MatchResultResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/verification/businesses/${businessId}/match-pro`,
	);
	return data;
};

export const runMatchProAndGetData = async ({
	customerId,
	businessId,
	icas,
}: RunMatchProParams) => {
	const { data } = await api.post(
		`${MICROSERVICE.INTEGRATION}/verification/customers/${customerId}/businesses/${businessId}/match-pro`,
		{ icas },
	);
	return data;
};

export const getMatchProConnectionStatus = async (
	customerId: string,
): Promise<MatchProConnectionStatusResponse> => {
	const { data } = await api.get<MatchProConnectionStatusResponse>(
		`${MICROSERVICE.INTEGRATION}/match-pro/${customerId}/check-connection-status`,
	);
	return data;
};

export const getMerchantAccount = async (payload: {
	businessId: string;
	customerId: string;
}): Promise<MerchantAccountResponse> => {
	const { businessId, customerId } = payload;
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/payment-processors/${customerId}/businesses/${businessId}/accounts`,
	);
	return data;
};

export const getMerchantProfiles = async (payload: {
	businessId?: string;
	customerId?: string;
}): Promise<MerchantProfileResponse> => {
	const { businessId, customerId } = payload;
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/payment-processors/${customerId}/merchant-profiles/${businessId}`,
		{ params: { platformId: "41", withAccountInfo: true } },
	);
	return data;
};

export const getPaymentProcessorDetails = async ({
	customerId,
}: {
	customerId: string;
}): Promise<getPaymentProcessorResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/payment-processors/${customerId}/processors`,
	);
	return data;
};

export const createMerchantProfile = async ({
	customerId,
	body,
}: {
	customerId: string;
	body: createMerchantProfilePayload;
}): Promise<BusinessVerificationEntityRecord> => {
	const { data } = await api.post(
		`${MICROSERVICE.INTEGRATION}/payment-processors/${customerId}/merchant-profiles`,
		body,
	);
	return data;
};

export const onboardPaymentProcessorAccounts = async ({
	customerId,
	body,
}: {
	customerId: string;
	body: onboardPaymentProcessorAccountsPayload;
}): Promise<OnboardPaymentProcessorAccountsResponse> => {
	const { data } = await api.post(
		`${MICROSERVICE.INTEGRATION}/payment-processors/${customerId}/accounts`,
		body,
	);
	return data;
};

export const rerunIntegrations = async (
	businessId: string,
	body: RerunIntegrationsRequestBody,
): Promise<ApiResponse<{ success: boolean }>> => {
	const url = `${MICROSERVICE.INTEGRATION}/businesses/${businessId}/integrations/rerun`;
	const { data } = await api.post<ApiResponse<{ success: boolean }>>(
		url,
		body,
	);
	return data;
};

/**
 * Get KYC facts for a business (owner/applicant information)
 * Returns owners_submitted and owner_verification data
 * @param businessId - The business ID
 * @param noCache - If true, bypasses backend cache (useful after saving overrides)
 */
export const getFactsKyc = async (
	businessId: string,
	noCache?: boolean,
): Promise<FactsKycResponse> => {
	const url = `${MICROSERVICE.INTEGRATION}/facts/business/${businessId}/kyc`;
	const { data } = await api.get<FactsKycResponse>(url, {
		params: noCache ? { noCache: true } : undefined,
	});
	return data;
};
