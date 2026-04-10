import {
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { type UpdateBusinessEntityRequest } from "@/types/businessEntityVerification";
import { type IPayload } from "@/types/common";
import type { CreateProcessorRequest } from "@/types/paymentProcessor";
import {
	createPaymentProcessor,
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
	getBusinessTradeLines,
	getBusinessVerificationDetails,
	getBusinessWebsite,
	getCaseTabValues,
	getEquifax,
	getEquifaxCreditReport,
	getFactsBusinessDetails,
	getFactsKyb,
	getIndividualWatchlistDetails,
	getIntegrations,
	getPaymentProcessors,
	getProcessingHistory,
	getProcessingStatementsExtraction,
	getTaxStatus,
	getTransaction,
	getTransactionsAccounts,
	getVerdata,
	getVerificationUploads,
	getWebsiteScreenshotUrl,
	rerunIntegrations,
	submitBusinessVerificationOrder,
	updateBusinessEntityDetails,
} from "../api/integration.service";

export const useGetIntegrations = (caseId: string) =>
	useQuery({
		queryKey: ["getIntegrations", caseId],
		queryFn: async () => {
			const res = await getIntegrations(caseId);
			return res;
		},
		enabled: !!caseId,
	});

export const useGetVerdata = (payload: {
	businessId: string;
	caseId?: string;
	scoreTriggerId?: string;
}) => {
	const { businessId, caseId, scoreTriggerId } = payload;
	return useQuery({
		queryKey: ["getVerdata", caseId, businessId, scoreTriggerId],
		queryFn: async () => {
			const res = await getVerdata(payload);
			return res;
		},
		enabled: !!businessId,
	});
};

export const useGetBankingIntegration = (paylaod: {
	businessId: string;
	caseId?: string;
	scoreTriggerId?: string;
}) => {
	const { businessId, caseId, scoreTriggerId } = paylaod;
	return useQuery({
		queryKey: ["getBanking", businessId, caseId, scoreTriggerId],
		queryFn: async () => {
			const res = await getBankingIntegration(paylaod);
			return res;
		},
		enabled: !!businessId,
	});
};

export const useGetBankingUploads = (paylaod: {
	businessId: string;
	caseId?: string;
}) => {
	const { businessId, caseId } = paylaod;
	return useQuery({
		queryKey: ["getBankingUploads", businessId, caseId],
		queryFn: async () => {
			const res = await getBankingUploads(paylaod);
			return res;
		},
		enabled: !!businessId,
	});
};

/** Case tab values (decisioning/onboarding results), including the three GIACT rows. */
export const useCaseTabValuesQuery = (params: {
	businessId: string | null;
	caseId: string | null;
}) => {
	const { businessId, caseId } = params;
	return useQuery({
		queryKey: ["caseTabValues", businessId, caseId],
		queryFn: () =>
			getCaseTabValues({ businessId: businessId!, caseId: caseId! }),
		enabled: !!businessId && !!caseId,
	});
};

/** Re-run integrations for a business. Invalidates case tab values on success. */
export const useRerunIntegrationsMutation = (params: {
	businessId: string | null;
	caseId: string | null;
}) => {
	const queryClient = useQueryClient();
	const { businessId, caseId } = params;
	return useMutation({
		mutationFn: () => rerunIntegrations(businessId!),
		onSuccess: () => {
			if (businessId != null && caseId != null) {
				queryClient.invalidateQueries({
					queryKey: ["caseTabValues", businessId, caseId],
				});
			}
		},
	});
};

export const useGetAccountingUploads = (paylaod: {
	businessId: string;
	caseId?: string;
}) => {
	const { businessId, caseId } = paylaod;
	return useQuery({
		queryKey: ["getAccountingUploads", businessId, caseId],
		queryFn: async () => {
			const res = await getAccountingUploads(paylaod);
			return res;
		},
		enabled: !!businessId,
	});
};

export const useGetTaxStatus = (paylaod: {
	businessId: string;
	caseId?: string;
	scoreTriggerId?: string;
}) => {
	const { businessId, caseId, scoreTriggerId } = paylaod;
	return useQuery({
		queryKey: ["getTaxStatus", businessId, caseId, scoreTriggerId],
		queryFn: async () => {
			const res = await getTaxStatus(paylaod);
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
		queryKey: ["getEquifax", businessId, caseId ?? "", scoreTriggerId ?? ""],
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
export const useGetIndividualWatchlistDetails = (businessId: string) =>
	useQuery({
		queryKey: ["getIndividualWatchlistDetails", businessId],
		queryFn: async () => {
			const res = await getIndividualWatchlistDetails(businessId);

			return res;
		},
		enabled: !!businessId,
	});
// multi-query to fetch several applicants verification details in one go
export const useGetApplicantsVerificationDetails = (payload: {
	businessId: string;
	applicantIds: string[];
}) => {
	const { businessId, applicantIds } = payload;
	const queries = applicantIds.map((applicantId) => ({
		queryKey: ["getApplicantVerificationDetails", businessId, applicantId],
		queryFn: async () => {
			const res = await getApplicantVerificationDetails(
				businessId,
				applicantId,
			);
			return res;
		},
	}));
	return useQueries({ queries });
};

export const useUpdateBusinessEntityDetails = (
	businessId: string,
	body: Partial<UpdateBusinessEntityRequest>,
) => {
	return useMutation({
		mutationFn: async () => {
			const res = await updateBusinessEntityDetails({ businessId, body });
			return res;
		},
	});
};

export const useSubmitBusinessVerificationOrder = (businessId: string) =>
	useMutation({
		mutationFn: async () => {
			const res = await submitBusinessVerificationOrder(businessId);
			return res;
		},
	});

export const useGetBusinessTradeLines = (paylaod: {
	businessId: string;
	caseId?: string;
	scoreTriggerId?: string;
}) => {
	const { businessId, caseId, scoreTriggerId } = paylaod;
	return useQuery({
		queryKey: ["useGetBusinessTradeLines", businessId, caseId, scoreTriggerId],
		queryFn: async () => {
			const res = await getBusinessTradeLines(paylaod);
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

export const useGetBusinessWebsite = (paylaod: {
	businessId: string;
	caseId?: string;
	scoreTriggerId?: string;
}) => {
	const { businessId, caseId, scoreTriggerId } = paylaod;
	return useQuery({
		queryKey: ["getBusinessWebsite", businessId, caseId, scoreTriggerId],
		queryFn: async () => {
			const res = await getBusinessWebsite(paylaod);
			return res;
		},
		enabled: !!businessId,
	});
};

export const useGetBusinessNpi = (paylaod: { businessId: string }) => {
	const { businessId } = paylaod;
	return useQuery({
		queryKey: ["geBusinesstNpi", businessId],
		queryFn: async () => {
			const res = await getBusinessNpi(paylaod);
			return res;
		},
		enabled: !!businessId,
	});
};

export const useGetAccountingBalanceSheetUpdated = (paylaod: {
	businessId: string;
	caseId?: string;
}) =>
	useQuery({
		queryKey: ["getBalanceSheetUpdated", paylaod?.businessId],
		queryFn: async () => {
			const res = await getAccountingBalanceSheetUpdate(paylaod);
			return res;
		},
		enabled: !!paylaod.businessId,
		retry: 1,
	});

export const useGetAccountingIncomeStatementUpdated = (payload: {
	businessId: string;
	caseId?: string;
}) =>
	useQuery({
		queryKey: ["getIncomeStatementUpdated", payload.businessId],
		queryFn: async () => {
			const res = await getAccountingIncomeStatementUpdate(payload);
			return res;
		},
		enabled: !!payload.businessId,
		retry: 1,
	});

export const useGetFactsKyb = (businessId: string) =>
	useQuery({
		queryKey: ["getKybFacts", businessId],
		queryFn: async () => {
			const res = await getFactsKyb(businessId);
			return res;
		},
		enabled: !!businessId,
		retry: 1,
	});

export const useGetFactsBusinessDetails = (businessId: string) =>
	useQuery({
		queryKey: ["getFactsBusinessDetails", businessId],
		queryFn: async () => {
			const res = await getFactsBusinessDetails(businessId);
			return res;
		},
		enabled: !!businessId,
		retry: 1,
	});
export const useGetTransactions = (payload: {
	businessId: string;
	params: IPayload;
	caseId?: string;
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

export const useGetTransactionsAccounts = ({
	businessId,
	caseId,
}: {
	businessId: string;
	caseId?: string;
}) =>
	useQuery({
		queryKey: ["getTransactionsAccounts", businessId],
		queryFn: async () => {
			const res = await getTransactionsAccounts({ businessId, caseId });
			return res;
		},
		enabled: !!businessId,
		retry: 1,
		refetchOnWindowFocus: false,
	});

export const useGetEquifaxCreditReport = (businessId: string, caseId: string) =>
	useQuery({
		queryKey: ["getEquifaxCreditScore", businessId, caseId],
		queryFn: async () => {
			const res = await getEquifaxCreditReport(businessId, caseId);
			return res;
		},
		enabled: !!businessId,
	});

export const useGetProcessingHistory = (businessId: string, caseId: string) =>
	useQuery({
		queryKey: ["getProcessingHistory", businessId, caseId],
		queryFn: async () => await getProcessingHistory(businessId, caseId),
		enabled: !!businessId && !!caseId,
	});

export const useGetAdverseMedia = (caseId: string) =>
	useQuery({
		queryKey: ["getAdverseMedia", caseId],
		queryFn: async () => await getAdverseMedia(caseId),
		enabled: !!caseId,
		retry: false,
		refetchOnWindowFocus: false,
	});

export const useGetAdverseMediaByBusinessId = (businessId: string) =>
	useQuery({
		queryKey: ["getAdverseMediaByBusinessId", businessId],
		queryFn: async () => await getAdverseMediaByBusinessId(businessId),
		enabled: !!businessId,
		retry: false,
		refetchOnWindowFocus: false,
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
		queryFn: async () => await getAllDocuments({ businessId, caseId }),
		enabled: !!businessId,
		retry: false,
		refetchOnWindowFocus: false,
	});

export const useGetBusinessWebsiteScreenshotUrl = (s3Key: string) =>
	useQuery({
		queryKey: ["getBusinessWebsiteScreenshotUrl", s3Key],
		queryFn: async () => await getWebsiteScreenshotUrl(s3Key),
		enabled: !!s3Key,
		retry: 0,
		refetchOnWindowFocus: false,
	});

export const useGetPaymentProcessors = (customerId: string | null) =>
	useQuery({
		queryKey: ["getPaymentProcessors", customerId],
		queryFn: async () => {
			if (!customerId) throw new Error("Customer ID is required");
			return await getPaymentProcessors(customerId);
		},
		enabled: !!customerId,
		retry: 1,
		refetchOnWindowFocus: false,
	});

export const useCreatePaymentProcessor = () =>
	useMutation({
		mutationFn: async ({
			customerId,
			payload,
		}: {
			customerId: string;
			payload: CreateProcessorRequest;
		}) => {
			return await createPaymentProcessor(customerId, payload);
		},
	});
