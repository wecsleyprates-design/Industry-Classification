import qs from "qs";
import { api } from "@/lib/api";
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
import type {
	CaseTabValuesApiResponse,
	CaseTabValuesResponse,
} from "@/types/caseTabValues";
import { type IPayload } from "@/types/common";
import {
	type APIResponseType,
	type BalanceSheetUpdatedResponse,
	type BusinessNpiResponse,
	type BusinessWebsiteResponse,
	type eqifaxCreditReportDataResponse,
	type FactBusinessDetailsResponseType,
	type GetAllDocumentsResponse,
	type GetProcessingStatementsResponse,
	type IncomeStatementUpdatedResponse,
	type KybUpdatedResponseTypeData,
} from "@/types/integrations";
import {
	type IntegrationSettingsResponse,
	type RunMatchBulkRequestBody,
	type RunMatchBulkResponse,
} from "@/types/integrationSettings";
import {
	type CreateProcessorRequest,
	type CreateProcessorResponse,
	type GetProcessorsResponse,
} from "@/types/paymentProcessor";
import { type ProcessingStatementsResponse } from "@/types/processingStatements";
import {
	type AdverseMediaResponse,
	type PublicRecordsResponse,
} from "@/types/publicRecords";
import { type TaxesResponseType } from "@/types/taxes";

import MICROSERVICE from "@/constants/Microservices";

export const getIntegrations = async (businessID: string) => {
	const url: string = `${MICROSERVICE.INTEGRATION}/businesses/${businessID}/integrations`;
	const { data } = await api.get(url);
	return data;
};

/** Trigger re-run of integrations for a business. Used by the Case results "Retry" button. */
export const rerunIntegrations = async (businessID: string): Promise<void> => {
	const url = `${MICROSERVICE.INTEGRATION}/businesses/${businessID}/integrations/rerun`;
	await api.post(url);
};

export const getVerdata = async (paylaod: {
	businessId: string;
	caseId?: string;
	scoreTriggerId?: string;
}): Promise<PublicRecordsResponse> => {
	const { businessId, caseId, scoreTriggerId } = paylaod;
	const url: string = `${MICROSERVICE.INTEGRATION}/business/${businessId}/public-records`;
	const { data } = await api.get(url, {
		params: {
			...(scoreTriggerId
				? { score_trigger_id: scoreTriggerId }
				: caseId && { case_id: caseId }),
		},
	});
	return data;
};

export const getBankingIntegration = async (paylaod: {
	businessId: string;
	caseId?: string;
	scoreTriggerId?: string;
}): Promise<GetBankingIntegrationResponse> => {
	const { scoreTriggerId, caseId, businessId } = paylaod;
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

export const getBankingUploads = async (paylaod: {
	businessId: string;
	caseId?: string;
}): Promise<GetBankingUploadsResponse> => {
	const { caseId, businessId } = paylaod;
	const url = `${MICROSERVICE.INTEGRATION}/banking/business/${businessId}/bank-statements`;
	const { data } = await api.get(url, {
		params: {
			...(caseId && { caseID: caseId }),
		},
	});
	return data;
};

export const getAccountingUploads = async (paylaod: {
	businessId: string;
	caseId?: string;
}): Promise<GetBankingUploadsResponse> => {
	const { caseId, businessId } = paylaod;
	const url = `${MICROSERVICE.INTEGRATION}/accounting/business/${businessId}/accounting-statements`;
	const { data } = await api.get(url, {
		params: {
			...(caseId && { caseID: caseId }),
		},
	});
	return data;
};

export const getTaxStatus = async (paylaod: {
	businessId: string;
	caseId?: string;
	scoreTriggerId?: string;
}): Promise<TaxesResponseType> => {
	const { businessId, caseId, scoreTriggerId } = paylaod;
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

export const getIndividualWatchlistDetails = async (
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

export const getBusinessTradeLines = async (paylaod: {
	businessId: string;
	caseId?: string;
	scoreTriggerId?: string;
}): Promise<GetBusinessTradeLinesResponse> => {
	const { businessId, caseId, scoreTriggerId } = paylaod;
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

export const getBusinessWebsite = async (paylaod: {
	businessId: string;
	caseId?: string;
	scoreTriggerId?: string;
}): Promise<BusinessWebsiteResponse> => {
	const { businessId } = paylaod;
	const url = `${MICROSERVICE.INTEGRATION}/verification/businesses/${businessId}/website-data`;
	const { data } = await api.get(url);
	return data;
};

export const getBusinessNpi = async (paylaod: {
	businessId: string;
}): Promise<BusinessNpiResponse> => {
	const { businessId } = paylaod;
	const url = `${MICROSERVICE.INTEGRATION}/verification/businesses/${businessId}/healthcare`;
	const { data } = await api.get(url);
	return data;
};

export const getAccountingBalanceSheetUpdate = async (payload: {
	businessId: string;
	caseId?: string;
}): Promise<BalanceSheetUpdatedResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/accounting/${payload.businessId}/financials/balancesheet`,
		{ params: { caseID: payload.caseId } },
	);
	return data;
};

export const getAccountingIncomeStatementUpdate = async (payload: {
	businessId: string;
	caseId?: string;
}): Promise<IncomeStatementUpdatedResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/accounting/${payload.businessId}/financials/income-statement`,
		{ params: { caseID: payload.caseId } },
	);
	return data;
};

export const getFactsKyb = async (
	businessId: string,
): Promise<APIResponseType<KybUpdatedResponseTypeData>> => {
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/facts/business/${businessId}/kyb`,
	);
	return data;
};

export const getFactsBusinessDetails = async (
	businessId: string,
): Promise<APIResponseType<FactBusinessDetailsResponseType>> => {
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/facts/business/${businessId}/details`,
	);
	return data;
};

export const getTransaction = async (payload: {
	businessId: string;
	params: IPayload;
	caseId?: string;
}) => {
	const { businessId, params, caseId } = payload;
	const response = await api.get(
		`${MICROSERVICE.INTEGRATION}/banking/business/${businessId}/transactions${
			params ? `?${qs.stringify(params)}` : ""
		}`,
		{ params: { caseID: caseId } },
	);
	return response.data;
};

export const getTransactionsAccounts = async ({
	businessId,
	caseId,
}: {
	businessId: string;
	caseId?: string;
}) => {
	const url: string = `${MICROSERVICE.INTEGRATION}/banking/business/${businessId}/transactions/accounts`;
	const { data } = await api.get(url, { params: { caseID: caseId } });
	return data;
};

export const getEquifaxCreditReport = async (
	businessId: string,
	caseId: string,
): Promise<eqifaxCreditReportDataResponse> => {
	const response = await api.get(
		`${MICROSERVICE.INTEGRATION}/bureau/business/${businessId}/report`,
		{
			params: {
				case_id: caseId,
			},
		},
	);
	return response.data;
};

export const getProcessingHistory = async (
	businessId: string,
	caseId: string,
): Promise<GetProcessingStatementsResponse> => {
	const url = `${MICROSERVICE.INTEGRATION}/business/${businessId}/processing-history`;
	const { data } = await api.get(url, { params: { case_id: caseId } });
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

export const getSubDomainInfo = async (customerId: string) => {
	const { data } = await api.get(
		`${MICROSERVICE.NOTIFICATION}/customers/${customerId}/settings`,
	);
	return data;
};

export const getWebsiteScreenshotUrl = async (fileKey: string) => {
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/file/website-screenshot?key=${fileKey}`,
	);
	return data;
};

export const getCredentials = async (
	customerId: string,
): Promise<IntegrationSettingsResponse | null> => {
	try {
		const { data } = await api.get(
			`${MICROSERVICE.INTEGRATION}/match-pro/${customerId}/credentials`,
		);
		return data;
	} catch (error: unknown) {
		console.warn(error);
		return null;
	}
};

export const saveIntegrationSettings = async (
	customerId: string,
	payload: FormData,
): Promise<IntegrationSettingsResponse> => {
	const { data } = await api.post(
		`${MICROSERVICE.INTEGRATION}/match-pro/${customerId}/credentials`,
		payload,
		{
			headers: {
				"Content-Type": "multipart/form-data",
			},
		},
	);
	return data;
};

export const updateIntegrationSettings = async (
	customerId: string,
	payload: FormData,
): Promise<IntegrationSettingsResponse> => {
	const { data } = await api.put(
		`${MICROSERVICE.INTEGRATION}/match-pro/${customerId}/credentials`,
		payload,
		{
			headers: {
				"Content-Type": "multipart/form-data",
			},
		},
	);
	return data;
};

export const checkConnectionStatus = async (
	customerId: string,
	acquirerId?: string,
) => {
	try {
		const { data } = await api.get(
			`${MICROSERVICE.INTEGRATION}/match-pro/${customerId}/check-connection-status`,
			acquirerId ? { params: { acquirerId } } : undefined,
		);
		return data;
	} catch (error: unknown) {
		throw new Error("Error checking connection status");
	}
};

export const runMatchBulk = async ({
	body,
}: {
	body: RunMatchBulkRequestBody;
}): Promise<RunMatchBulkResponse> => {
	const { data } = await api.post(
		`${MICROSERVICE.INTEGRATION}/verification/bulk-match/match-pro`,
		body,
	);
	return data;
};

const getPaymentProcessorUrl = (customerId: string) =>
	`${MICROSERVICE.INTEGRATION}/payment-processors/${customerId}/processors`;

export const getPaymentProcessors = async (
	customerId: string,
): Promise<GetProcessorsResponse> => {
	const { data } = await api.get(getPaymentProcessorUrl(customerId));
	return data;
};

export const createPaymentProcessor = async (
	customerId: string,
	payload: CreateProcessorRequest,
): Promise<CreateProcessorResponse> => {
	const { data } = await api.post(getPaymentProcessorUrl(customerId), payload);
	return data;
};

/**
 * Fetches case tab values (decisioning/onboarding results) for the case.
 * Includes the three GIACT rows: giact_account_status, giact_account_name, giact_contact_verification.
 */
export const getCaseTabValues = async (params: {
	businessId: string;
	caseId: string;
}): Promise<CaseTabValuesResponse> => {
	const { businessId, caseId } = params;
	const url = `${MICROSERVICE.INTEGRATION}/business/${businessId}/case/${caseId}/values`;
	const { data } = await api.get<CaseTabValuesApiResponse>(url);
	const payload = data?.data ?? data;
	return payload as CaseTabValuesResponse;
};
