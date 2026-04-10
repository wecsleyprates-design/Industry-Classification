import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	CreateWorkflowRequest,
	GetAttributesCatalogParams,
	GetWorkflowsParams,
	UpdateWorkflowRequest,
} from "@/types/workflows";
import {
	createWorkflow,
	deleteWorkflow,
	exportExecutionLogs,
	getAttributesCatalog,
	getTriggers,
	getWorkflow,
	getWorkflows,
	updateWorkflow,
	updateWorkflowPriority,
	updateWorkflowStatus,
} from "../api/workflows.service";

export const useGetWorkflows = (params: GetWorkflowsParams) =>
	useQuery({
		queryKey: [
			"getWorkflows",
			params.customer_id,
			params.page,
			params.filter,
			params.search,
			params.sort,
		],
		queryFn: async () => await getWorkflows(params),
		enabled: !!params.customer_id,
		retry: 1,
	});

export const useGetWorkflow = (workflowId: string | undefined) =>
	useQuery({
		queryKey: ["getWorkflow", workflowId],
		queryFn: async () => await getWorkflow(workflowId as string),
		enabled: !!workflowId,
		retry: 1,
		refetchOnMount: true,
	});

export const useGetTriggers = () =>
	useQuery({
		queryKey: ["getTriggers"],
		queryFn: async () => await getTriggers(),
		retry: 1,
	});

export const useDeleteWorkflow = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (workflowId: string) => {
			await deleteWorkflow(workflowId);
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["getWorkflows"] });
		},
	});
};

export const useUpdateWorkflowPriority = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({
			workflowId,
			priority,
		}: {
			workflowId: string;
			priority: number;
		}) => {
			await updateWorkflowPriority(workflowId, priority);
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["getWorkflows"] });
		},
	});
};

export const useUpdateWorkflowStatus = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({
			workflowId,
			status,
		}: {
			workflowId: string;
			status: boolean;
		}) => {
			await updateWorkflowStatus(workflowId, status);
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["getWorkflows"] });
		},
	});
};

export const useCreateWorkflow = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({
			customerId,
			payload,
		}: {
			customerId: string;
			payload: CreateWorkflowRequest;
		}) => {
			return await createWorkflow(customerId, payload);
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["getWorkflows"] });
		},
	});
};

export const useUpdateWorkflow = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({
			workflowId,
			payload,
		}: {
			workflowId: string;
			payload: UpdateWorkflowRequest;
		}) => {
			return await updateWorkflow(workflowId, payload);
		},
		onSuccess: (_, variables) => {
			void queryClient.invalidateQueries({ queryKey: ["getWorkflows"] });
			void queryClient.invalidateQueries({
				queryKey: ["getWorkflow"],
			});
		},
	});
};

export const useGetAttributesCatalog = (
	customerId: string | undefined,
	enabled = true,
	params: GetAttributesCatalogParams,
) =>
	useQuery({
		queryKey: ["getAttributesCatalog", customerId, params.operators],
		queryFn: async () =>
			await getAttributesCatalog(customerId as string, params),
		enabled: enabled && !!customerId,
		staleTime: 5 * 60 * 1000,
		retry: 2,
	});

export const useExportExecutionLogs = () => {
	return useMutation({
		mutationFn: exportExecutionLogs,
	});
};
