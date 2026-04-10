export interface WorthScoreWaterfallResponse {
	status: string;
	message: string;
	data: WorthScoreData;
}

export interface WorthScoreData {
	id: string;
	created_at: Date;
	case_id: string;
	status: string;
	base_score: number;
	weighted_score_100: string;
	weighted_score_850: string;
	risk_level: string;
	score_decision: string;
	score_distribution: ScoreDistribution[];
	is_score_calculated: boolean;
	version: string;
}

export interface WorthScoreDateResponse {
	status: string;
	message: string;
	data: WorthScoreDateData[];
}

export interface WorthScoreDateData {
	year: string;
	month: string;
	fullDate: Date;
	score_trigger_id: string;
}

export interface ScoreDistribution {
	id: number;
	code: string;
	label: string;
	is_deleted: boolean;
	total_weightage: number;
	factors: Factor[];
	score: number;
	score_100: number;
	score_850: number;
}

export interface Factor {
	id: number;
	code: string;
	label: string;
	category_id: number;
	is_deleted: boolean;
	parent_factor_id: null;
	weightage: number | null;
	factor_id?: number;
	value?: number;
	score_100?: number;
	weighted_score_100?: number | string;
	score_850?: number;
	weighted_score_850?: number | string;
	status?: string;
	log?: string;
}

export interface ScoreTrendResponse {
	status: string;
	message: string;
	data: Data;
}

export interface Data {
	score_data?: ScoreDatum[];
	is_score_data_available?: boolean;
}

export interface ScoreDatum {
	id: string;
	created_at: Date;
	weighted_score_850: string;
	year: string;
	month: string;
}
