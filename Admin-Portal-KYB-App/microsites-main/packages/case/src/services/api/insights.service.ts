import { api } from "@/lib/api";
import {
	type InsightsChatbotPayload,
	type InsightsChatbotResponse,
	type InsightsReportResponse,
} from "@/types/insights";

import MICROSERVICE from "@/constants/Microservices";

export const submitQueryToInsightsChatbot = async (
	payload: InsightsChatbotPayload,
): Promise<InsightsChatbotResponse> => {
	const { data } = await api.post(
		`${MICROSERVICE.INTEGRATION}/insights-chatbot`,
		payload,
	);
	return data;
};

export const getInsightsReport = async (
	caseId: string,
): Promise<InsightsReportResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/insights/${caseId}`,
	);
	return data;
};
