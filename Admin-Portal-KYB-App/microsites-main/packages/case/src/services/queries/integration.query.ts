import {
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
	type UseQueryResult,
} from "@tanstack/react-query";
import {
	type BusinessApplicantVerificationResponse,
	type UpdateBusinessEntityRequest,
} from "@/types/businessEntityVerification";
import { type IPayload } from "@/types/common";
import {
	type createMerchantProfilePayload,
	type onboardPaymentProcessorAccountsPayload,
	type RerunIntegrationsRequestBody,
	type RunMatchProParams,
} from "@/types/integrations";
import {
	acknowledgeCaseTabValues,
	createMerchantProfile,
	getAccountingBalanceSheet,
	getAccountingBalanceSheetUpdate,
	getAccountingIncomeStatement,
	getAccountingIncomeStatementUpdate,
	getAccountingUploads,
	getAdverseMedia,
	getAdverseMediaByBusinessId,
	getAllDocuments,
	getApplicantVerificationDetails,
	getBankingIntegration,
	getBankingUploads,
	getBusinessEntity,
	getBusinessNpi,
	getBusinessPublicRecords,
	getBusinessTradeLines,
	getBusinessVerificationDetails,
	getBusinessWebsite,
	getCaseTabValues,
	getCustomerBusinessOwnerScores,
	getCustomerIntegrationSettings,
	getEquifax,
	getEquifaxCreditReport,
	getFactsBusinessBJL,
	getFactsBusinessDetails,
	getFactsBusinessFinancials,
	getFactsKyb,
	getFactsKyc,
	getGoogleProfileByBusinessId,
	getIntegrations,
	getMatchProConnectionStatus,
	getMatchProData,
	getMerchantAccount,
	getMerchantProfiles,
	getNpiDoctors,
	getPaymentProcessorDetails,
	getProcessingHistory,
	getProcessingHistoryFacts,
	getProcessingStatementsExtraction,
	getProxyFacts,
	getSubDomainInfo,
	getTaxStatus,
	getTransaction,
	getTransactionsAccounts,
	getVerificationBusinessPeopleWatchlist,
	getVerificationUploads,
	getWebsiteScreenshotUrl,
	onboardPaymentProcessorAccounts,
	rerunIntegrations,
	runMatchProAndGetData,
	submitBusinessVerificationOrder,
	updateBusinessEntityDetails,
} from "../api/integration.service";

import { VALUE_NOT_AVAILABLE } from "@/constants";

export const useGetIntegrations = (caseId: string) =>
	useQuery({
		queryKey: ["getIntegrations", caseId],
		queryFn: async () => {
			const res = await getIntegrations(caseId);
			return res;
		},
		enabled: !!caseId,
	});

export const useGetBusinessPublicRecords = (payload: {
	businessId: string;
	caseId?: string;
	scoreTriggerId?: string;
}) => {
	const { businessId, caseId, scoreTriggerId } = payload;
	return useQuery({
		queryKey: [
			"useGetBusinessPublicRecords",
			caseId,
			businessId,
			scoreTriggerId,
		],
		queryFn: async () => {
			const res = await getBusinessPublicRecords(payload);
			return res;
		},
		enabled: !!businessId,
	});
};

export const useGetAdverseMedia = (caseId: string) =>
	useQuery({
		queryKey: ["getAdverseMedia", caseId],
		queryFn: async () => {
			const res = await getAdverseMedia(caseId);
			return res;
		},
		enabled: !!caseId && caseId !== VALUE_NOT_AVAILABLE,
		retry: false,
		refetchOnWindowFocus: false,
	});

export const useGetAdverseMediaByBusinessId = (businessId: string) =>
	useQuery({
		queryKey: ["getAdverseMediaByBusinessId", businessId],
		queryFn: async () => {
			const res = await getAdverseMediaByBusinessId(businessId);
			return res;
		},
		enabled: !!businessId && businessId !== VALUE_NOT_AVAILABLE,
		retry: false,
		refetchOnWindowFocus: false,
	});

export const useGetGoogleProfileByBusinessId = (businessId: string) =>
	useQuery({
		queryKey: ["getGoogleProfileByBusinessId", businessId],
		queryFn: async () => {
			const res = await getGoogleProfileByBusinessId(businessId);
			return res;
		},
		enabled: !!businessId && businessId !== VALUE_NOT_AVAILABLE,
		retry: false,
		refetchOnWindowFocus: false,
	});

export const useGetBankingIntegration = (payload: {
	businessId: string;
	caseId?: string;
	scoreTriggerId?: string;
}) => {
	const { businessId, caseId, scoreTriggerId } = payload;
	return useQuery({
		queryKey: ["getBanking", businessId, caseId, scoreTriggerId],
		queryFn: async () => {
			const res = await getBankingIntegration(payload);
			return res;
		},
		enabled: !!businessId,
	});
};

export const useGetTaxStatus = (payload: {
	businessId: string;
	caseId?: string;
	scoreTriggerId?: string;
}) => {
	const { businessId, caseId, scoreTriggerId } = payload;
	return useQuery({
		queryKey: ["getTaxStatus", businessId, caseId, scoreTriggerId],
		queryFn: async () => {
			const res = await getTaxStatus(payload);
			return res;
		},
		enabled: !!businessId,
		retry: 1,
	});
};

export const useGetAccountingBalanceSheet = (businessId: string) =>
	useQuery({
		queryKey: ["getBalanceSheet", businessId],
		queryFn: async () => {
			const res = await getAccountingBalanceSheet(businessId);
			return res;
		},
		enabled: !!businessId,
	});

export const useGetAccountingIncomeStatement = (businessId: string) =>
	useQuery({
		queryKey: ["getIncomeStatement", businessId],
		queryFn: async () => {
			const res = await getAccountingIncomeStatement(businessId);
			return res;
		},
		enabled: !!businessId,
	});

export const useGetEquifax = ({
	customerId,
	businessId,
	caseId,
	scoreTriggerId,
}: {
	customerId: string;
	businessId: string;
	caseId?: string;
	scoreTriggerId?: string;
}) =>
	useQuery({
		queryKey: [
			"getEquifax",
			businessId,
			caseId ?? "",
			scoreTriggerId ?? "",
		],
		queryFn: async () => {
			const res = await getEquifax({
				customerId,
				businessId,
				caseId,
				scoreTriggerId,
			});
			return res;
		},
		enabled: !!businessId,
		retry: 1,
	});

export const useGetBusinessEntity = (businessId: string) =>
	useQuery({
		queryKey: ["getBusinessEntity", businessId],
		queryFn: async () => {
			const res = await getBusinessEntity(businessId);
			return res;
		},
		enabled: !!businessId,
	});

export const useGetBusinessVerificationDetails = (businessId: string) =>
	useQuery({
		queryKey: ["getBusinessVerificationDetails", businessId],
		queryFn: async () => {
			const res = await getBusinessVerificationDetails(businessId);
			return res;
		},
		enabled: !!businessId,
	});
export const useGetVerificationBusinessPeopleWatchlist = (businessId: string) =>
	useQuery({
		queryKey: ["getVerificationBusinessPeopleWatchlist", businessId],
		queryFn: async () => {
			const res =
				await getVerificationBusinessPeopleWatchlist(businessId);

			return res;
		},
		enabled: !!businessId && businessId !== VALUE_NOT_AVAILABLE,
	});

export const useGetApplicantVerificationDetails = (
	businessId: string,
	applicantId: string,
) => {
	return useQuery({
		queryKey: ["getApplicantVerificationDetails", businessId, applicantId],
		queryFn: async () => {
			const res = await getApplicantVerificationDetails(
				businessId,
				applicantId,
			);
			return res;
		},
		enabled: !!businessId && !!applicantId,
	});
};

// multi-query to fetch several applicants verification details in one go
export const useGetApplicantsVerificationDetails = (payload: {
	businessId: string;
	applicantIds: string[];
}): Array<UseQueryResult<BusinessApplicantVerificationResponse, unknown>> => {
	const { businessId, applicantIds } = payload;
	const queries: Array<{ queryKey: string[]; queryFn: () => Promise<any> }> =
		[];
	applicantIds.forEach((applicantId) => {
		queries.push({
			queryKey: [
				"getApplicantVerificationDetails",
				businessId,
				applicantId,
			],
			queryFn: async () => {
				const res = await getApplicantVerificationDetails(
					businessId,
					applicantId,
				);
				return res;
			},
		});
	});
	return useQueries({ queries });
};

export const useUpdateBusinessEntityDetails = (
	businessId: string,
	body: Partial<UpdateBusinessEntityRequest>,
) => {
	return useMutation({
		mutationKey: ["updateBusinessEntityDetails", businessId],
		mutationFn: async () => {
			const res = await updateBusinessEntityDetails({ businessId, body });
			return res;
		},
	});
};

export const useSubmitBusinessVerificationOrder = (businessId: string) =>
	useMutation({
		mutationKey: ["submitBusinessVerificationOrder", businessId],
		mutationFn: async () => {
			const res = await submitBusinessVerificationOrder(businessId);
			return res;
		},
	});

export const useGetBusinessTradeLines = (payload: {
	businessId: string;
	caseId?: string;
	scoreTriggerId?: string;
}) => {
	const { businessId, caseId, scoreTriggerId } = payload;
	return useQuery({
		queryKey: [
			"useGetBusinessTradeLines",
			businessId,
			caseId,
			scoreTriggerId,
		],
		queryFn: async () => {
			const res = await getBusinessTradeLines(payload);
			return res;
		},
		enabled: !!businessId,
	});
};

export const useGetExtractedVerificationUploads = (businessId: string) =>
	useQuery({
		queryKey: ["getExtractedVerificationUploads", businessId],
		queryFn: async () => {
			const res = await getVerificationUploads(businessId);
			return res;
		},
		enabled: !!businessId,
	});

export const useGetProcessingStatementsExtraction = (businessId: string) =>
	useQuery({
		queryKey: ["getProcessingStatementsExtraction", businessId],
		queryFn: async () => {
			const res = await getProcessingStatementsExtraction(businessId);
			return res;
		},
		enabled: !!businessId,
	});

export const useGetBusinessWebsite = (payload: {
	businessId: string;
	caseId?: string;
	scoreTriggerId?: string;
}) => {
	const { businessId, caseId, scoreTriggerId } = payload;
	return useQuery({
		queryKey: ["getBusinessWebsite", businessId, caseId, scoreTriggerId],
		queryFn: async () => {
			const res = await getBusinessWebsite(payload);
			return res;
		},
		enabled: !!businessId,
	});
};

export const useGetAccountingBalanceSheetUpdated = (businessId: string) =>
	useQuery({
		queryKey: ["getBalanceSheetUpdated", businessId],
		queryFn: async () => {
			const res = await getAccountingBalanceSheetUpdate(businessId);
			return res;
		},
		enabled: !!businessId,
		retry: 1,
	});

export const useGetAccountingIncomeStatementUpdated = (businessId: string) =>
	useQuery({
		queryKey: ["getIncomeStatementUpdated", businessId],
		queryFn: async () => {
			const res = await getAccountingIncomeStatementUpdate(businessId);
			return res;
		},
		enabled: !!businessId,
		retry: 1,
	});

export const useGetFactsKyb = (businessId: string, isProxyFlag: boolean) =>
	useQuery({
		queryKey: ["getKybFacts", businessId],
		queryFn: async () => {
			if (isProxyFlag) {
				const res = await getProxyFacts(businessId, "kyb");
				return res;
			}
			const res = await getFactsKyb(businessId);
			return res;
		},
		enabled: !!businessId && businessId !== VALUE_NOT_AVAILABLE,
		retry: 1,
		refetchOnWindowFocus: false,
	});

export const useGetFactsBusinessFinancials = (
	businessId: string,
	isProxyFlag: boolean,
) =>
	useQuery({
		queryKey: ["getFactsBusinessFinancials", businessId],
		queryFn: async () => {
			if (isProxyFlag) {
				const res = await getProxyFacts(businessId, "financials");
				return res;
			}
			const res = await getFactsBusinessFinancials(businessId);
			return res;
		},
		enabled: !!businessId && businessId !== VALUE_NOT_AVAILABLE,
		retry: 1,
	});

export const useGetFactsBusinessBJL = (
	businessId: string,
	isProxyFlag: boolean,
) =>
	useQuery({
		queryKey: ["getFactsBusinessBJL", businessId],
		queryFn: async () => {
			if (isProxyFlag) {
				const res = await getProxyFacts(businessId, "bjl");
				return res;
			}
			const res = await getFactsBusinessBJL(businessId);
			return res;
		},
		enabled: !!businessId && businessId !== VALUE_NOT_AVAILABLE,
		retry: 1,
	});

export const useGetFactsBusinessDetails = (
	businessId: string,
	isProxyFlag: boolean,
) =>
	useQuery({
		queryKey: ["getFactsBusinessDetails", businessId],
		queryFn: async () => {
			if (isProxyFlag) {
				const res = await getProxyFacts(businessId, "business-details");
				return res;
			}
			const res = await getFactsBusinessDetails(businessId);
			return res;
		},
		enabled: !!businessId,
		retry: 1,
	});

export const useGetTransactions = (payload: {
	businessId: string;
	params: IPayload;
}) =>
	useQuery({
		queryKey: ["gettransactions", payload, payload.businessId],
		queryFn: async () => {
			const res = await getTransaction(payload);
			return res;
		},
		enabled: !!payload.businessId,
		retry: 1,
	});

export const useGetTransactionsAccounts = (
	businessId: string,
	caseId?: string,
) =>
	useQuery({
		queryKey: ["getTransactionsAccounts", businessId, caseId],
		queryFn: async () => {
			const res = await getTransactionsAccounts(businessId, caseId);
			return res;
		},
		enabled: !!businessId,
		retry: 1,
		refetchOnWindowFocus: false,
	});

export const useGetEquifaxCreditReport = (
	businessId: string,
	caseId?: string,
) =>
	useQuery({
		queryKey: ["getEquifaxCreditScore", businessId, caseId ?? ""],
		queryFn: async () => {
			const res = await getEquifaxCreditReport(businessId, caseId);
			return res;
		},
		enabled: !!businessId,
	});

export const useGetCustomerBusinessOwnerScores = (
	customerId: string,
	businessId: string,
) =>
	useQuery({
		queryKey: ["getEquifaxCustomerCreditScore", customerId, businessId],
		queryFn: async () =>
			await getCustomerBusinessOwnerScores(customerId, businessId),
		enabled: !!businessId && !!customerId,
	});

export const useGetProcessingHistory = (businessId: string, caseId: string) =>
	useQuery({
		queryKey: ["getProcessingHistory", businessId, caseId],
		queryFn: async () => await getProcessingHistory(businessId, caseId),
		enabled: !!businessId && !!caseId,
	});

/**
 * Get processing history facts with overrides applied
 * Returns facts like processing_history_general_annual_volume with override values
 */
export const useGetProcessingHistoryFacts = (businessId: string) =>
	useQuery({
		queryKey: ["getProcessingHistoryFacts", businessId],
		queryFn: async () => await getProcessingHistoryFacts(businessId),
		enabled: !!businessId,
	});

export const useGetSubDomainInfoMutate = (customerId?: string) =>
	useMutation({
		mutationKey: ["getSubDomainInfo", customerId],
		mutationFn: async (customerId: string) => {
			const res = await getSubDomainInfo(customerId ?? "");
			return res;
		},
		retry: 0,
	});

export const useGetAllDocuments = ({
	businessId,
	caseId,
}: {
	businessId: string;
	caseId?: string;
}) =>
	useQuery({
		queryKey: ["getAllDocuments", businessId, caseId],
		queryFn: async () => {
			const res = await getAllDocuments({ businessId, caseId });
			return res;
		},
		enabled: !!businessId,
		retry: false,
		refetchOnWindowFocus: false,
	});

/** Single cache entry per (businessId, caseId). Tab filtering is done when rendering, not in the request. */
export const useGetCaseTabValues = ({
	businessId,
	caseId,
	enabled: enabledOption = true,
}: {
	businessId: string;
	caseId: string;
	/** When false, the query is not run. Use to avoid calling the values endpoint unless CaseDecisioningResults is rendered. */
	enabled?: boolean;
}) =>
	useQuery({
		queryKey: ["getCaseTabValues", businessId, caseId],
		queryFn: async () => {
			const res = await getCaseTabValues({ businessId, caseId });
			return res;
		},
		enabled: !!businessId && !!caseId && enabledOption,
	});

/** PATCH .../values/acknowledge — sets case_results_executions baseline to now (call when Re-verify Data Now succeeds). */
export const useAcknowledgeCaseTabValues = () =>
	useMutation({
		mutationKey: ["acknowledgeCaseTabValues"],
		mutationFn: async ({
			businessId,
			caseId,
		}: {
			businessId: string;
			caseId: string;
		}) => await acknowledgeCaseTabValues({ businessId, caseId }),
	});

export const useGetBusinessNpi = (businessId: string) => {
	return useQuery({
		queryKey: ["geBusinesstNpi", businessId],
		queryFn: async () => {
			const res = await getBusinessNpi(businessId);
			return res;
		},
		enabled: !!businessId,
	});
};

export const useGetNpiDoctors = (
	businessId: string,
	isEnabled: boolean,
	params?: Record<string, string | number | boolean>,
) => {
	return useQuery({
		queryKey: ["getNpiDoctors", businessId, params],
		queryFn: async () => await getNpiDoctors(businessId, params),
		enabled: Boolean(businessId && isEnabled),
	});
};

export const useGetBusinessWebsiteScreenshotUrl = (s3Key: string) =>
	useQuery({
		queryKey: ["getBusinessWebsiteScreenshotUrl", s3Key],
		queryFn: async () => await getWebsiteScreenshotUrl(s3Key),
		enabled: !!s3Key,
		retry: 0,
		refetchOnWindowFocus: false,
	});

export const useGetBankingUploads = (payload: {
	businessId: string;
	caseId?: string;
}) => {
	const { businessId, caseId } = payload;
	return useQuery({
		queryKey: ["getBankingUploads", businessId, caseId],
		queryFn: async () => {
			const res = await getBankingUploads(payload);
			return res;
		},
		enabled: !!businessId && businessId !== VALUE_NOT_AVAILABLE,
	});
};

export const useGetAccountingUploads = (payload: {
	businessId: string;
	caseId?: string;
}) => {
	const { businessId, caseId } = payload;
	return useQuery({
		queryKey: ["getAccountingUploads", businessId, caseId],
		queryFn: async () => {
			const res = await getAccountingUploads(payload);
			return res;
		},
		enabled: !!businessId,
	});
};

export const useGetCustomerIntegrationSettings = (customerId: string) =>
	useQuery({
		queryKey: ["getCustomerIntegrationSettings", customerId],
		queryFn: async () => await getCustomerIntegrationSettings(customerId),
		enabled: !!customerId,
	});

export const useGetMatchProData = (businessId: string) =>
	useQuery({
		queryKey: ["getMatchProData", businessId],
		queryFn: async () => await getMatchProData(businessId),
		enabled: !!businessId,
	});

export const useGetMatchProConnectionStatus = (customerId: string) =>
	useQuery({
		queryKey: ["getMatchProConnectionStatus", customerId],
		queryFn: async () => await getMatchProConnectionStatus(customerId),
		enabled: !!customerId,
	});

export const useGetMerchantAccount = (payload: {
	businessId: string;
	customerId: string;
}) => {
	const { businessId, customerId } = payload;
	return useQuery({
		queryKey: ["getMerchantAccount", businessId, customerId],
		queryFn: async () => {
			const res = await getMerchantAccount(payload);
			return res;
		},
		enabled: !!businessId && !!customerId,
		retry: 1,
	});
};

export const useGetMerchantProfiles = (payload: {
	businessId?: string;
	customerId?: string;
}) => {
	const { businessId, customerId } = payload;
	return useQuery({
		queryKey: ["getMerchantProfiles", businessId, customerId],
		queryFn: async () => {
			const res = await getMerchantProfiles(payload);
			return res;
		},
		enabled: !!businessId && !!customerId,
		retry: 1,
	});
};

export const useGetPaymentProcessorDetails = (customerId: string) =>
	useQuery({
		queryKey: ["getPaymentProcessorDetails", customerId],
		queryFn: async () => await getPaymentProcessorDetails({ customerId }),
		enabled: !!customerId,
	});

export const useCreateMerchantProfile = () =>
	useMutation({
		mutationKey: ["createMerchantProfile"],
		mutationFn: async ({
			customerId,
			body,
		}: {
			customerId: string;
			body: createMerchantProfilePayload;
		}) => {
			const res = await createMerchantProfile({ customerId, body });
			return res;
		},
	});

export const useOnboardPaymentProcessorAccounts = () =>
	useMutation({
		mutationKey: ["onboardPaymentProcessorAccounts"],
		mutationFn: async ({
			customerId,
			body,
		}: {
			customerId: string;
			body: onboardPaymentProcessorAccountsPayload;
		}) => {
			const res = await onboardPaymentProcessorAccounts({
				customerId,
				body,
			});
			return res;
		},
	});

export const useRerunIntegrations = () =>
	useMutation({
		mutationKey: ["rerunIntegrations"],
		mutationFn: async ({
			businessId,
			body,
		}: {
			businessId: string;
			body: RerunIntegrationsRequestBody;
		}) => await rerunIntegrations(businessId, body),
	});

/**
 * Hook to fetch KYC facts for a business
 * Returns owners_submitted and owner_verification data
 */
export const useGetFactsKyc = (businessId: string) =>
	useQuery({
		queryKey: ["getKycFacts", businessId],
		queryFn: async () => await getFactsKyc(businessId),
		enabled: !!businessId,
	});

export const useRunMatchPro = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({
			customerId,
			businessId,
			icas,
		}: RunMatchProParams) =>
			await runMatchProAndGetData({ customerId, businessId, icas }),
		onSuccess: (_data, variables) => {
			void queryClient.invalidateQueries({
				queryKey: ["getMatchProData", variables.businessId],
			});
		},
	});
};
