export interface SharedRuleRow {
	id: string;
	context_type: string;
	context_id: string;
	name: string | null;
	description: string | null;
	created_at: Date;
	updated_at: Date;
}

export interface SharedRuleVersionRow {
	id: string;
	rule_id: string;
	version_number: number;
	conditions: Record<string, unknown>;
	created_at: Date;
	created_by: string | null;
}

export interface CreateRulePayload {
	context_type: string;
	context_id: string;
	name: string;
	description?: string | null;
	conditions: Record<string, unknown>;
	created_by?: string | null;
}

export interface UpdateRuleMetadataPayload {
	name?: string;
	description?: string | null;
}

export interface AddRuleVersionPayload {
	conditions: Record<string, unknown>;
	created_by?: string | null;
}

export interface UpdateRulePayload {
	name?: string;
	description?: string | null;
	conditions?: Record<string, unknown>;
	created_by?: string | null;
}

export interface UpdateRuleResult {
	version_id?: string;
	version_number?: number;
}

/** Rule with latest version conditions, for evaluation (monitoring). */
export interface SharedRuleWithLatestConditions {
	id: string;
	name: string;
	conditions: Record<string, unknown>;
}

export interface SharedRuleDetailBatchItem {
	rule_id: string;
	name: string | null;
	description: string | null;
	latest_version_number: number;
	conditions: Record<string, unknown>;
	rule_created_at: Date;
	version_created_at: Date;
}

export interface SharedRuleDetailBatchResult {
	rules: SharedRuleDetailBatchItem[];
	missing_rule_ids: string[];
}
