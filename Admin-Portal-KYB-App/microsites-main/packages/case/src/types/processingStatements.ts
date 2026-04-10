export interface StepByStepItem {
	step: number;
	action: string;
	result: string;
}

export interface BusinessInfo {
	businessName: string;
	businessAddress: string;
	incorporationDate: string;
}

export interface Financials {
	netIncome: number;
	totalWages: number;
	totalAssets: number;
	grossRevenue: number;
	costOfGoodsSold: number;
	totalLiabilities: number;
	operatingExpenses: number;
}

export interface TaxReturnData {
	ein: string;
	taxYear: number;
	formType: string;
	filingFor: "personal" | "business";
	financials: Financials;
	businessInfo: BusinessInfo;
	businessType: string;
}

export interface CardProcessingVolume {
	planCodes: string[];
	desiredLimit: number;
	monthlyVolume: number;
	highTicketSize: number;
	averageTicketSize: number;
	numberOfTransactions: number;
}

export interface PointOfSaleVolume {
	eCommerce: number;
	typedCards: number;
	swipedCards: number;
}

export interface PlanSummaryData {
	visa: CardProcessingVolume;
	discover: CardProcessingVolume;
	mastercard: CardProcessingVolume;
	americanExpress: CardProcessingVolume;
	pointOfSaleVolume: PointOfSaleVolume;
}

export interface AggregatedData {
	combinedDesiredLimit: number;
	combinedHighestTicket: number;
	combinedMonthlyVolume: number;
	visaMastercardDiscover: {
		desiredLimit: number;
		monthlyVolume: number;
		highTicketSize: number;
		averageTicketSize: number;
	};
	combinedAverageTicketSize: number;
}

export interface ExtractedData {
	stepByStep: StepByStepItem[];
	taxReturnData?: TaxReturnData;
	aggregatedData?: AggregatedData;
	planSummaryData?: PlanSummaryData;
	confidenceScore: number;
}

export interface ProcessingStatement {
	id: string;
	business_id: string;
	file_name: string;
	file_path: string;
	extracted_data: ExtractedData;
	created_at: string;
	updated_at: string;
	job_id: string;
	job_type: "extraction";
}

export interface ProcessingStatementsResponse {
	status: "success" | "error";
	message: string;
	data: ProcessingStatement[];
}
