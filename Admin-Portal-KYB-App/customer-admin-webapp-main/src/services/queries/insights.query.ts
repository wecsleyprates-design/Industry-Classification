import { useMutation, useQuery } from "@tanstack/react-query";
import { type InsightsChatbotPayload } from "@/types/insights";
import {
	getInsightsReport,
	submitQueryToInsightsChatbot,
} from "../api/insights.service";

export const useInsightsChatBotMutation = () =>
	useMutation({
		mutationFn: async (payload: InsightsChatbotPayload) =>
			await submitQueryToInsightsChatbot(payload),
	});

export const useGetInsightsReport = (caseId: string) =>
	useQuery({
		queryKey: [`insights_report_${caseId}`],
		queryFn: async () => await getInsightsReport(caseId),
	});
