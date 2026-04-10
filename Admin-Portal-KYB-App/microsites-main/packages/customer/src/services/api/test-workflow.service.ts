import { api } from "@/lib/api";
import type {
	BusinessSearchParams,
	BusinessSearchResponse,
	PreviewEvaluationResponse,
	PreviewEvaluationResult,
	TestWorkflowOptions,
	WorkflowTestRequest,
	WorkflowTestResponse,
	WorkflowTestResult,
} from "@/types/test-workflow";

import MICROSERVICE from "@/constants/Microservices";
import { transformPreviewToTestResult } from "@/helpers/test-workflow.helper";

interface NormalizedBusinessResult {
	businessId: string;
	evaluationResult: PreviewEvaluationResult;
}

export const searchBusinesses = async (
	params: BusinessSearchParams,
): Promise<BusinessSearchResponse> => {
	const { customer_id: customerId, query, limit = 10 } = params;
	const url = `${MICROSERVICE.CASE}/customers/${customerId}/businesses/search`;

	const queryParams: Record<string, string | number> = { limit };
	if (query) {
		queryParams.query = query;
	}

	const { data } = await api.get(url, { params: queryParams });
	return data;
};

function normalizeBusinessResults(
	previewData: PreviewEvaluationResponse,
): NormalizedBusinessResult[] {
	if (previewData.business_results?.length) {
		return previewData.business_results.map((result) => ({
			businessId: result.business_id,
			evaluationResult: result.evaluation_result,
		}));
	}

	const businessId = Array.isArray(previewData.business_id)
		? previewData.business_id[0]
		: (previewData.business_id ?? "");

	return [
		{
			businessId,
			evaluationResult: previewData.evaluation_result,
		},
	];
}

function transformBusinessResults(
	previewData: PreviewEvaluationResponse,
	businessNames: Map<string, string>,
): WorkflowTestResult[] {
	const normalizedResults = normalizeBusinessResults(previewData);

	return normalizedResults.map((item) =>
		transformPreviewToTestResult(item.businessId, item.evaluationResult, {
			businessName: businessNames.get(item.businessId) ?? "",
		}),
	);
}

export const testWorkflow = async (
	request: WorkflowTestRequest,
	options: TestWorkflowOptions = {},
): Promise<WorkflowTestResponse> => {
	const { workflow_id: workflowId, business_ids: businessIds } = request;
	const { businessNames = new Map() } = options;

	if (!workflowId) {
		throw new Error("workflow_id is required");
	}

	const url = `${MICROSERVICE.WORKFLOW}/workflows/${workflowId}/preview`;
	const { data: response } = await api.post<{
		data: PreviewEvaluationResponse;
	}>(url, {
		business_id: businessIds,
	});

	const results = transformBusinessResults(response.data, businessNames);

	return {
		status: "success",
		message: "Workflow test completed",
		data: { results },
	};
};
