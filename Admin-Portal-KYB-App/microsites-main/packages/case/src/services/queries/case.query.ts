import { useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePermission } from "@/hooks/usePermission";
import {
	archiveCase,
	cloneBusiness,
	createAdditionalInformationRequest,
	createBusiness,
	createCaseAuditTrailComment,
	createTransactionExportAuditTrail,
	exportCases,
	getAllStandaloneCases,
	getCaseById,
	getCases,
	getCaseStatuses,
	getCaseTypes,
	getCurrentTemplateFields,
	getCustomerApplicantConfig,
	getCustomerCaseById,
	getCustomerOnboardingInvite,
	getCustomerOnboardingInviteStatus,
	getCustomerUsers,
	getCustomerWorkflows,
	getDecryptSSN,
	getOnboardingSetup,
	getOwnerTitles,
	getStandaloneCaseByCaseId,
	getWorkflowConditions,
	getWorthScoreByCaseId,
	patchBusinessFactsOverride,
	refreshScore,
	scoreRefreshTime,
	selectAssigneeUser,
	updateCaseByCaseId,
	updateCaseValuesGeneratedAt,
	updateCustomFields,
} from "@/services/api/case.service";
import {
	type AdditionalInformationRequestPayload,
	type ArchiveCaseBody,
	type CloneBusinessPayload,
	type CreateBusinessRequest,
	type CreateCaseAuditTrailCommentPayload,
	type CustomerOnboardingInvitePayload,
	type DecryptSSNPayload,
	type GetCaseByIdResponse,
	type GetCaseRequest,
	type GetCasesRequest,
	type GetCasesResponse,
	type GetCaseStatusesResponse,
	type GetCaseTypesResponse,
	type GetCustomerUserResponse,
	type GetCustomerWorkflowsListResponse,
	type GetOwnerTitlesResponse,
	type GetWorkflowConditionsResponse,
	type PatchBusinessFactsOverrideRequestPayload,
	type RefreshScorePayload,
	type SelectAssigneeUserPayload,
	type UpdateCaseByCaseIdRequestPayload,
	type UpdateCustomFieldsRequestPayload,
} from "@/types/case";
import { type IPayload } from "@/types/common";

export const useCreateBusinessQuery = () =>
	useMutation({
		mutationKey: ["createBusiness"],
		mutationFn: async (body: CreateBusinessRequest) => {
			const res = await createBusiness(body);
			return res;
		},
	});

export const useGetCasesQuery = (payload: GetCasesRequest) => {
	const { slug: paramCustomerId } = useParams();
	const customerId =
		paramCustomerId ??
		localStorage.getItem("customerId") ??
		"VALUE_NOT_AVAILABLE";
	return useQuery<GetCasesResponse>({
		queryKey: ["getcases", payload],
		queryFn: async () => {
			const res = await getCases(payload);
			return res;
		},
		enabled: !!customerId,
	});
};

export const useGetCaseByIdQuery = (
	body: GetCaseRequest,
	options?: { enabled?: boolean },
) => {
	const { caseId, customerId, moduleType, businessId, platformType } = body;
	let isEnabled = false;
	if (moduleType === "customer_case") {
		isEnabled = !!(caseId && customerId);
	} else if (moduleType === "standalone_case") {
		isEnabled = !!caseId;
	} else if (moduleType === "business_case" && platformType === "admin") {
		isEnabled = !!(caseId && businessId);
	}
	isEnabled = options?.enabled ?? isEnabled;

	return useQuery<GetCaseByIdResponse>({
		queryKey: ["getCaseById", customerId, caseId, moduleType],
		queryFn: async () => {
			if (
				moduleType === "standalone_case" ||
				(moduleType === "business_case" && platformType === "admin")
			)
				return await getCaseById(body);
			else {
				return await getCustomerCaseById(body);
			}
		},
		enabled: isEnabled,
		retry: 1,
		refetchOnWindowFocus: false,
	});
};

export const useUpdateCaseByCaseIdQuery = () =>
	useMutation({
		mutationKey: ["updateCaseByCaseId"],
		mutationFn: async (body: UpdateCaseByCaseIdRequestPayload) => {
			const res = await updateCaseByCaseId(body);
			return res;
		},
	});

export const useGetWorthScoreByCaseId = (
	caseId: string,
	params?: Record<string, any>,
) => {
	return useQuery({
		queryKey: ["getScoreByCaseId", caseId, params],
		queryFn: async () => {
			const res = await getWorthScoreByCaseId(caseId, params);
			return res;
		},

		enabled: !!caseId,
	});
};

/** Updates values_generated_at (Re-verify Data Now). Merges PATCH response into cache so "Regenerated on" shows without overwriting full score. */
export const useUpdateCaseValuesGeneratedAt = (
	caseId: string,
	params?: Record<string, any>,
) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: ["updateCaseValuesGeneratedAt", caseId],
		mutationFn: async (valuesGeneratedAt: string) => {
			const res = await updateCaseValuesGeneratedAt(
				caseId,
				valuesGeneratedAt,
			);
			return res;
		},
		onSuccess: (data) => {
			// Merge PATCH response into existing cache so we get values_generated_at without losing is_score_calculated, score, etc. (PATCH may return partial)
			queryClient.setQueryData(
				["getScoreByCaseId", caseId, params],
				(previous: typeof data | undefined) => {
					if (!previous?.data) return data;
					return {
						...data,
						data: { ...previous.data, ...data.data },
					};
				},
			);
		},
	});
};

export const useGetCaseTypes = (payload: IPayload) =>
	useQuery<GetCaseTypesResponse>({
		queryKey: ["getCaseTypes", payload],
		queryFn: async () => {
			const res = await getCaseTypes(payload);
			return res;
		},
	});

export const useArchiveCaseQuery = () =>
	useMutation({
		mutationKey: ["archiveCaseQuery"],
		mutationFn: async (body: ArchiveCaseBody) => {
			const res = await archiveCase(body);
			return res;
		},
	});

export const useGetCaseStatuses = () =>
	useQuery<GetCaseStatusesResponse>({
		queryKey: ["getCaseStatuses"],
		queryFn: async () => {
			const res = await getCaseStatuses();
			return res;
		},
	});

export const useCreateCaseAuditTrailComment = () =>
	useMutation({
		mutationKey: ["add comment - updateCaseAuditTrail"],
		mutationFn: async (body: CreateCaseAuditTrailCommentPayload) => {
			const res = await createCaseAuditTrailComment(body);
			return res;
		},
	});

export const useScoreRefresh = () =>
	useMutation({
		mutationKey: ["refreshScore"],
		mutationFn: async (payload: RefreshScorePayload) => {
			const res = await refreshScore(payload);
			return res;
		},
	});

export const useScoreRefreshTime = (businessId: string) =>
	useQuery({
		queryKey: ["scoreRefreshTime"],
		queryFn: async () => {
			const res = await scoreRefreshTime(businessId);
			return res;
		},

		enabled: !!businessId,
	});

export const useGetOnboardingSetup = (customerId: string) =>
	useQuery({
		queryKey: ["getOnboardingSetup", customerId],
		queryFn: async () => {
			const res = await getOnboardingSetup(customerId);
			return res;
		},
		enabled: !!customerId,
	});

export const useGetStandaloneCases = (params: IPayload) =>
	useQuery({
		queryKey: ["getAllStandaloneCases", params],
		queryFn: async () => {
			const res = await getAllStandaloneCases(params);
			return res;
		},
	});

export const useGetStandaloneCaseByIdQuery = (caseId: string) => {
	return useQuery({
		queryKey: ["getStandaloneCaseByCaseId", caseId],
		queryFn: async () => {
			const res = await getStandaloneCaseByCaseId(caseId);
			return res;
		},
		retry: 1,
	});
};

export const useGetCustomerOnboardingInvite = () =>
	useMutation({
		mutationKey: ["getCustomerOnboardingInvite"],
		mutationFn: async (body: CustomerOnboardingInvitePayload) => {
			const res = await getCustomerOnboardingInvite(body);
			return res;
		},
	});

export const useGetCustomerOnboardingInviteStatus = (
	payload: CustomerOnboardingInvitePayload,
) =>
	useQuery({
		queryKey: [
			"getCustomerOnboardingInviteStatus",
			payload?.caseId,
			payload?.customerId,
		],
		queryFn: async () => {
			const res = await getCustomerOnboardingInviteStatus(payload);
			return res;
		},
		enabled: !!payload?.caseId && !!payload?.customerId,
	});

export const useCreateAdditionalInformationRequest = () =>
	useMutation({
		mutationKey: ["createAdditionalInformationRequest"],
		mutationFn: async (payload: AdditionalInformationRequestPayload) => {
			const res = await createAdditionalInformationRequest(payload);
			return res;
		},
	});

export const useExportCases = () =>
	useMutation({
		mutationKey: ["exportCases"],
		mutationFn: async (customerId: string) => {
			const res = await exportCases(customerId);
			return res;
		},
	});

export const useCreateTransactionExportAuditTrail = () =>
	useMutation({
		mutationKey: ["createTransactionExportAuditTrail"],
		mutationFn: async (params: { caseID: string; businessID: string }) => {
			const res = await createTransactionExportAuditTrail(params);
			return res;
		},
	});

export const useGetCustomer = (customerId?: string) => {
	const hasAccess = usePermission("customer_user:read");

	return useQuery<GetCustomerUserResponse>({
		queryKey: ["getCustomerUsers", customerId],
		queryFn: async () => {
			return await getCustomerUsers({ customerId: customerId as string });
		},
		enabled: !!customerId && hasAccess,
	});
};

export const useSelectAssigneeUser = () => {
	return useMutation({
		mutationKey: ["selectAssigneeUser"],
		mutationFn: async (body: SelectAssigneeUserPayload) => {
			const res = await selectAssigneeUser(body);
			return res;
		},
	});
};

export const useGetDecryptSSN = () =>
	useMutation({
		mutationKey: ["getDecryptSSN"],
		mutationFn: async (body: DecryptSSNPayload) => {
			const res = await getDecryptSSN(body);
			return res;
		},
	});

export const useCloneBusiness = () =>
	useMutation({
		mutationKey: ["cloneBusiness"],
		mutationFn: async (payload: CloneBusinessPayload) => {
			const res = await cloneBusiness(payload);
			return res;
		},
	});

export const useGetCustomerApplicantConfig = (customerId: string) =>
	useQuery({
		queryKey: ["getCustomerApplicantConfig", customerId],
		queryFn: async () => {
			const res = await getCustomerApplicantConfig(customerId);
			return res;
		},
		enabled: !!customerId,
		retry: 0,
	});

export const usePatchBusinessFactsOverride = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: ["patchBusinessFactsOverride"],
		mutationFn: async (
			payload: PatchBusinessFactsOverrideRequestPayload,
		) => {
			const res = await patchBusinessFactsOverride(payload);
			return res;
		},
		onSuccess: (_data, variables) => {
			const overrideKeys = Object.keys(variables.overrides ?? {});
			const touchesDisplayProfile = overrideKeys.some(
				(key) => key === "legal_name" || key === "dba",
			);
			if (!touchesDisplayProfile) {
				return;
			}
			const { businessId } = variables;
			void queryClient.invalidateQueries({
				queryKey: ["getKybFacts", businessId],
			});
			void queryClient.invalidateQueries({
				queryKey: ["getCaseById"],
			});
			void queryClient.invalidateQueries({
				queryKey: ["getcases"],
			});
		},
	});
};

/**
 * Fetch owner titles from the case management API.
 * Results are cached and sorted alphabetically.
 */
export const useGetOwnerTitles = () =>
	useQuery<GetOwnerTitlesResponse>({
		queryKey: ["getOwnerTitles"],
		queryFn: async () => {
			const res = await getOwnerTitles(true);
			return res;
		},
		staleTime: 24 * 60 * 60 * 1000, // 1 day
		refetchOnWindowFocus: false,
	});

export const useGetWorkflowConditions = (
	caseId: string,
	options?: { enabled?: boolean },
) =>
	useQuery<GetWorkflowConditionsResponse>({
		queryKey: ["getWorkflowConditions", caseId],
		queryFn: async () => {
			const res = await getWorkflowConditions({ caseId });
			return res;
		},
		enabled: options?.enabled ?? true,
		staleTime: 5 * 60 * 1000, // 5 minutes
		refetchOnWindowFocus: false,
	});

/**
 * Fetches workflows list for customer to determine if at least one workflow is set up (existence, not execution).
 */
export const useGetCustomerWorkflows = (
	customerId: string,
	options?: { enabled?: boolean },
) =>
	useQuery<GetCustomerWorkflowsListResponse>({
		queryKey: ["getCustomerWorkflows", customerId],
		queryFn: async () => await getCustomerWorkflows(customerId),
		enabled: (options?.enabled ?? true) && !!customerId,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
	});

/**
 * Fetch current template field definitions for a business.
 * Used to determine which custom fields are editable when the template has changed.
 */
export const useGetCurrentTemplateFields = (businessId: string) =>
	useQuery({
		queryKey: ["currentTemplateFields", businessId],
		queryFn: () => getCurrentTemplateFields(businessId),
		enabled: !!businessId,
		staleTime: 5 * 60 * 1000,
	});

/**
 * Update custom field values for a case.
 * Used for inline editing of custom fields in case management.
 */
export const useUpdateCustomFields = () =>
	useMutation({
		mutationKey: ["updateCustomFields"],
		mutationFn: async (payload: UpdateCustomFieldsRequestPayload) => {
			const res = await updateCustomFields(payload);
			return res;
		},
	});
