/**
 * Generic type to create a type that can be null or undefined.
 *
 * @param T The type.
 *
 * @example
 * type MaybeString = Maybe<string>; // string | null | undefined
 *
 */
export type Maybe<T> = T | null | undefined;

/**
 * Generic type to create a type that can be nullified.
 *
 * @param T The type.
 *
 * @example
 * type NullableString = Nullable<string>; // string | null
 *
 */
export type Nullable<T> = T | null;

/**
 * Used to override default function signatures
 *
 * @param BaseFunction - The function to override
 * @param T - Custom arguments
 *
 * @example
 * const calculateAreaOfSquare: (a: number) => number = (a: number) => a * a;
 * const calculateAreaofRectangle: DerivedFunction<typeof calculateAreaOfSquare, [number]> = (a: number, b: number) => a * b;
 * typeof calculateAreaofRectangle // (a: number, b: number) => number
 *
 * */
export type DerivedFunction<
	BaseFunction extends (...args: any[]) => unknown,
	T extends unknown[] = unknown[],
> = BaseFunction extends (...a: infer U) => infer R
	? (...a: [...U, ...T]) => R
	: never;

/**
 * Converts string or template literals to UPPER_SNAKE_CASE
 *
 * @param S - String or template literal
 * @param D - Delimiter
 *
 * @example
 * type NewType = UpperSnakecase<'hello world'>; // HELLO_WORLD
 * type NewType = UpperSnakecase<'hello:world' | 'test:arg', ':'>; // HELLO_WORLD | TEST_ARG
 *
 */
export type UpperSnakecase<
	S extends string,
	D extends string = "",
> = S extends `${infer FirstWord}${D}${infer Rest}`
	? D extends ""
		? Uppercase<S>
		: `${Uppercase<FirstWord>}_${Uppercase<Rest>}`
	: never;

export interface CasesByApprovalStatusResponse {
	status: string;
	message: string;
	data: CasesByApprovalStatusData;
}

export interface CasesByApprovalStatusData {
	decisions: Decisions;
	total_case_count: number;
}

export interface CaseInProgressResponse {
	status: string;
	message: string;
	data: CaseInProgressData;
}

export interface CaseInProgressData {
	decisions: Inprogress;
	total_case_count: number;
}

export interface Decisions {
	AUTO_APPROVED: StatusDataObject;
	MANUALLY_APPROVED: StatusDataObject;
	AUTO_REJECTED: StatusDataObject;
	MANUALLY_REJECTED: StatusDataObject;
}
export interface Inprogress {
	ONBOARDING: StatusDataObject;
	UNDER_MANUAL_REVIEW: StatusDataObject;
	PENDING_DECISION: StatusDataObject;
	ABANDONED: StatusDataObject;
	CREATED: StatusDataObject;
	INVITED: StatusDataObject;
	SUBMITTED: StatusDataObject;
}

export interface StatusDataObject {
	percentage: number;
	count: number;
}

export interface AverageWorthScoreResponse {
	status: string;
	message: string;
	data: AverageWorthScoreData;
}

export interface AverageWorthScoreData {
	risk_levels: AverageWorthScoreCategoryData;
	total: AverageWorthScoreDataObject;
}

export interface AverageWorthScoreCategoryData {
	low: AverageWorthScoreDataObject;
	moderate: AverageWorthScoreDataObject;
	high: AverageWorthScoreDataObject;
}

export interface AverageWorthScoreDataObject {
	average: number;
	count: number;
}

export interface BusinessesScoreStatsResponse {
	status: string;
	message: string;
	data: BusinessesScoreStatsData;
}

export interface BusinessesScoreStatsData {
	score_range: {
		"0-499"?: ScoreObject;
		"500-649"?: ScoreObject;
		"650-XXX"?: ScoreObject;
	};
}

export interface ScoreObject {
	count: number;
}

export interface IndustryExposureResponse {
	status: string;
	message: string;
	data?: IndustryExposureDataObject[];
}

export interface IndustryExposureDataObject {
	industry: string;
	count: number;
	average_score: string;
	min_score: number | null;
	max_score: number | null;
}

export interface CustomerPortfolioResponse {
	status: string;
	message: string;
	data: CustomerPortfolioData;
}

export interface CustomerPortfolioData {
	monthly_data: MonthlyDatum[];
	period: string;
}

export interface MonthlyDatum {
	month:
		| "January"
		| "February"
		| "March"
		| "April"
		| "May"
		| "June"
		| "July"
		| "August"
		| "September"
		| "October"
		| "November"
		| "December";
	average_score: string;
	total_businesses_count: string;
}

export interface RiskAlertsStats {
	status: string;
	message: string;
	data: RiskAlertData;
}

export interface RiskAlertData {
	result: Array<{
		credit_score: number;
		worth_score: number;
		judgements_liens: number;
		others: number;
		month:
			| "January"
			| "February"
			| "March"
			| "April"
			| "May"
			| "June"
			| "July"
			| "August"
			| "September"
			| "October"
			| "November"
			| "December";
	}>;
	period: "2024";
}

export type AnyObject = Record<string, any>;

export interface TeamPerformanceStats {
	data: {
		application_count: number;
		average_turnaround: number;
		approval_rate: number;
		application_percentage_change: number;
		average_turnaround_percentage_change: number;
		approval_rate_percentage_change: number;
	};
}

interface TimeToApprovalPeriodData {
	count: number;
	period: string;
}

interface TimeToApprovalItem {
	label: string;
	current: TimeToApprovalPeriodData;
	previous: TimeToApprovalPeriodData;
}

export interface TimeToApprovalResponse {
	data: {
		data: TimeToApprovalItem[];
	};
}

interface TotalApplicationChartItem {
	label: string;
	percentage: number;
	current: {
		count: number;
		period: string;
	};
	previous: {
		count: number;
		period: string;
	};
}

export interface TotalApplicationStatsResponse {
	data: {
		data: {
			application_count: number;
			percentage_change: number;
			chart_data: TotalApplicationChartItem[];
		};
	};
}
