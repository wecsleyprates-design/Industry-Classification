export interface Message {
	id: number;
	role: "user" | "assistant";
	content: string;
}

export interface InsightsChatbotPayload {
	messages: Message[];
	additionalContext?: string;
	reportSummary?: string;
	impactOfCompanyProfileScore?: string;
	actionItemsForCompanyProfile?: string[];
	impactOfFinancialTrendsScore?: string;
	actionItemsForFinancialTrends?: string[];
	impactOfPublicRecordsScore?: string;
	actionItemsForPublicRecords?: string[];
	impactOfWorthScore?: string;
	actionItemsForWorth?: string[];
}

export interface StatusResponse {
	status: "success" | "error";
	message: string;
}

export interface InsightsChatbotResponse extends StatusResponse {
	data: string;
}

export interface InsightsReport {
	impactOfCompanyProfileScore: string;
	actionItemsForCompanyProfile: string[];
	impactOfFinancialTrendsScore: string;
	actionItemsForFinancialTrends: string[];
	impactOfLiquidityScore: string;
	actionItemsForLiquidity: string[];
	impactOfPublicRecordsScore: string;
	actionItemsForPublicRecords: string[];
	impactOfBaseScore: string;
	actionItemsForBase: string[];
	impactOfWorthScore: string;
	actionItemsForWorth: string[];
}

export interface InsightsReportResponse extends StatusResponse {
	data: {
		reportBreakDown: InsightsReport;
		summary: string;
		suggestedQuestions?: string[];
	};
}
