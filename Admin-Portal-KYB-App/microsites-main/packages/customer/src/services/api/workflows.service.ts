import { api } from "@/lib/api";
import type {
	CreateWorkflowRequest,
	CreateWorkflowResponse,
	ExportExecutionLogsParams,
	ExportExecutionLogsResponse,
	GetAttributesCatalogParams,
	GetAttributesCatalogResponse,
	GetTriggersResponse,
	GetWorkflowResponse,
	GetWorkflowsParams,
	GetWorkflowsResponse,
	UpdateWorkflowRequest,
	UpdateWorkflowResponse,
} from "@/types/workflows";

import MICROSERVICE from "@/constants/Microservices";

export const getWorkflows = async (
	params: GetWorkflowsParams,
): Promise<GetWorkflowsResponse> => {
	const { customer_id: customerId, ...queryParams } = params;
	const url: string = `${MICROSERVICE.WORKFLOW}/workflows/customers/${customerId}/workflows`;
	const { data } = await api.get(url, { params: queryParams });
	return data;
};

export const deleteWorkflow = async (workflowId: string): Promise<void> => {
	const url: string = `${MICROSERVICE.WORKFLOW}/workflows/${workflowId}`;
	await api.delete(url);
};

export const updateWorkflowPriority = async (
	workflowId: string,
	priority: number,
): Promise<void> => {
	const url: string = `${MICROSERVICE.WORKFLOW}/workflows/${workflowId}/priority`;
	await api.put(url, { priority });
};

export const updateWorkflowStatus = async (
	workflowId: string,
	status: boolean,
): Promise<void> => {
	const url: string = `${MICROSERVICE.WORKFLOW}/workflows/${workflowId}/status`;
	await api.patch(url, { active: status });
};

export const getTriggers = async (): Promise<GetTriggersResponse> => {
	const url: string = `${MICROSERVICE.WORKFLOW}/triggers/`;
	const { data } = await api.get(url);
	return data;
};

export const createWorkflow = async (
	customerId: string,
	payload: CreateWorkflowRequest,
): Promise<CreateWorkflowResponse> => {
	const url: string = `${MICROSERVICE.WORKFLOW}/workflows/customers/${customerId}/workflows`;
	const { data } = await api.post(url, payload);
	return data;
};

export const updateWorkflow = async (
	workflowId: string,
	payload: UpdateWorkflowRequest,
): Promise<UpdateWorkflowResponse> => {
	const url: string = `${MICROSERVICE.WORKFLOW}/workflows/${workflowId}`;
	const { data } = await api.put(url, payload);
	return data;
};

export const getAttributesCatalog = async (
	customerId: string,
	params: GetAttributesCatalogParams,
): Promise<GetAttributesCatalogResponse> => {
	const { operators } = params;
	const url: string = `${MICROSERVICE.WORKFLOW}/attributes/customers/${customerId}/catalog`;
	const { data } = await api.get(url, { params: { operators } });
	return data;
};

export const getWorkflow = async (
	workflowId: string,
): Promise<GetWorkflowResponse> => {
	const url: string = `${MICROSERVICE.WORKFLOW}/workflows/${workflowId}`;
	const { data } = await api.get(url);
	return data;
};

export const exportExecutionLogs = async (
	params: ExportExecutionLogsParams,
): Promise<ExportExecutionLogsResponse> => {
	const url: string = `${MICROSERVICE.WORKFLOW}/audit/customers/${params.customerId}/execution-logs`;
	const { data, headers } = await api.get(url, {
		responseType: "blob",
		params: {
			workflow_id: params.workflowId,
			start_date: params.startDate,
			end_date: params.endDate,
		},
	});

	return {
		data,
		filename: headers["content-disposition"],
	};
};
