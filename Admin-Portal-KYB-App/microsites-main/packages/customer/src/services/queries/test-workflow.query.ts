import { useMutation, useQuery } from "@tanstack/react-query";
import type {
	BusinessSearchParams,
	TestWorkflowMutationParams,
} from "@/types/test-workflow";
import { searchBusinesses, testWorkflow } from "../api/test-workflow.service";

export const useSearchBusinesses = (
	params: BusinessSearchParams,
	enabled = true,
) =>
	useQuery({
		queryKey: ["searchBusinesses", params.customer_id, params.query],
		queryFn: async () => await searchBusinesses(params),
		enabled: enabled && !!params.customer_id,
		staleTime: 30000,
		retry: 1,
	});

export const useTestWorkflow = () =>
	useMutation({
		mutationFn: async ({ request, options }: TestWorkflowMutationParams) =>
			await testWorkflow(request, options),
	});
