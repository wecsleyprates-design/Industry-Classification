import { type APIResponse } from "./APIResponse";
import { type PaginatedApiRequest } from "./PaginatedAPIRequest";
import { type PaginatedAPIResponse } from "./PaginatedAPIResponse";

// Backend returns derived status based on workflow version and active flag:
// - "active": has PUBLISHED version (is_current=true) AND active=true
// - "inactive": otherwise (only ARCHIVED, or PUBLISHED but active=false, or no version)
export type WorkflowStatus = "active" | "inactive";

export interface Workflow {
	id: string;
	name: string;
	description: string;
	priority: number;
	cases: number;
	published_version: string | null;
	draft_version: string | null;
	status: WorkflowStatus;
	created_by: string; // UUID of the customer
	created_by_name?: string; // Name of the customer (optional, may be undefined if auth-service unavailable)
	created_at: string;
	updated_at?: string;
}

export interface GetWorkflowsParams extends PaginatedApiRequest {
	customer_id: string;
	// Filtering parameters
	filter?: {
		status?: WorkflowStatus | WorkflowStatus[];
		created_by?: string | string[];
	};
	// Search parameters
	search?: {
		name?: string;
		description?: string;
	};
	// Sorting parameters
	sort?: {
		name?: "ASC" | "DESC";
		priority?: "ASC" | "DESC";
		cases?: "ASC" | "DESC";
		version?: "ASC" | "DESC";
		status?: "ASC" | "DESC";
		created_at?: "ASC" | "DESC";
	};
}

export type GetWorkflowsResponse = PaginatedAPIResponse<Workflow>;

export interface TriggerCondition {
	field: string;
	value: string;
	operator: string;
}

export interface TriggerConditions {
	operator: "AND" | "OR";
	conditions: TriggerCondition[];
}

export interface Trigger {
	id: string;
	name: string;
	conditions: TriggerConditions;
	created_at: string;
	updated_at: string;
}

export interface GetTriggersResponseData {
	triggers: Trigger[];
	total: number;
}

export type GetTriggersResponse = APIResponse<GetTriggersResponseData>;

export interface BaseCondition {
	field: string;
	value: string | boolean | number | null | Array<string | number>;
	operator: string;
}

export interface NestedConditionGroup {
	operator: "OR";
	conditions: BaseCondition[];
}

export interface RootConditionGroup {
	operator: "AND";
	conditions: Array<BaseCondition | NestedConditionGroup>;
}

export interface ActionParameters {
	field: string;
	value: string | boolean | number | null;
	[key: string]: unknown;
}

export interface WorkflowAction {
	type: string;
	parameters: ActionParameters;
}

export interface WorkflowRule {
	name: string;
	conditions: RootConditionGroup;
	actions: WorkflowAction[];
}

export interface WorkflowDefaultAction {
	type: string;
	parameters: ActionParameters;
}

export interface CreateWorkflowRequest {
	name: string;
	description?: string;
	trigger_id: string;
	rules?: WorkflowRule[];
	default_action?: WorkflowDefaultAction;
	auto_publish?: boolean;
}

export interface UpdateWorkflowRequest {
	name?: string;
	description?: string;
	trigger_id?: string;
	rules?: WorkflowRule[];
	default_action?: WorkflowDefaultAction;
	auto_publish?: boolean;
}

export interface CreateWorkflowResponseData {
	workflow_id: string;
	version_id: string;
	message: string;
}

export type CreateWorkflowResponse = APIResponse<CreateWorkflowResponseData>;

export type UpdateWorkflowResponse = APIResponse<Workflow>;

export type AttributeDataType = "string" | "number" | "boolean" | "date";

export type ConditionOperator =
	| "="
	| "!="
	| ">"
	| "<"
	| ">="
	| "<="
	| "IN"
	| "NOT_IN"
	| "BETWEEN"
	| "CONTAINS"
	| "NOT_CONTAINS"
	| "IS_NULL"
	| "IS_NOT_NULL"
	| "ANY_EQUALS"
	| "ANY_CONTAINS"
	| "ARRAY_INTERSECTS"
	| "ARRAY_LENGTH"
	| "ARRAY_IS_EMPTY"
	| "ARRAY_IS_NOT_EMPTY";

export interface CatalogAttribute {
	name: string;
	label: string;
}

export interface CatalogItem {
	context: string;
	source: string;
	attribute: CatalogAttribute;
	operators: ConditionOperator[];
	data_type: AttributeDataType;
	validation_regex: string | null;
	description: string;
}

export type AttributesCatalog = Record<string, CatalogItem[]>;

export const ATTRIBUTE_CATALOG_OPERATORS_FILTER = {
	COMPARISON: "comparison",
	VARIATION: "variation",
	ALL: "all",
} as const;

export type CatalogOperatorsFilter =
	(typeof ATTRIBUTE_CATALOG_OPERATORS_FILTER)[keyof typeof ATTRIBUTE_CATALOG_OPERATORS_FILTER];

export interface GetAttributesCatalogParams {
	operators: CatalogOperatorsFilter;
}

export const GET_ATTRIBUTES_CATALOG_FOR_RULE_BUILDER: GetAttributesCatalogParams =
	{
		operators: ATTRIBUTE_CATALOG_OPERATORS_FILTER.COMPARISON,
	};

export type GetAttributesCatalogResponse = APIResponse<AttributesCatalog>;

export type ConditionValue =
	| string
	| number
	| boolean
	| null
	| Array<string | number>;

export interface ConditionFormData {
	id: string;
	context: string;
	source: string;
	attribute: string;
	attributeLabel?: string;
	operator: ConditionOperator | "";
	value: ConditionValue;
	validationRegex?: string | null;
	dataType?: AttributeDataType | null;
}

export interface ConditionGroupFormData {
	id: string;
	operator: "OR";
	conditions: ConditionFormData[];
}

export type RuleConditionItem = ConditionFormData | ConditionGroupFormData;

export type DecisionValue =
	| "AUTO_APPROVED"
	| "AUTO_REJECTED"
	| "UNDER_MANUAL_REVIEW";

export interface RuleFormData {
	id: string;
	name: string;
	conditions: RuleConditionItem[];
	decision: DecisionValue | "";
}

export interface WorkflowWizardForm {
	name: string;
	description?: string;
	trigger: string;
	rules: RuleFormData[];
	default_action?: WorkflowDefaultAction;
}

// ==========================================
// GET /workflows/{workflowId} Response Types
// ==========================================

export type WorkflowVersionStatus = "draft" | "published";

export interface WorkflowTriggerDetails {
	id: string;
	name: string;
	conditions: TriggerConditions | Record<string, unknown>;
}

export interface WorkflowRuleDetails extends WorkflowRule {
	id: string;
	priority: number;
}

export interface WorkflowCurrentVersion {
	id: string;
	version_number: number;
	status: WorkflowVersionStatus;
	trigger_id: string;
	trigger: WorkflowTriggerDetails;
	default_action: WorkflowDefaultAction | null;
	rules: WorkflowRuleDetails[];
}

export interface WorkflowDetails {
	id: string;
	name: string;
	description: string | null;
	priority: number;
	active: boolean;
	created_at: string;
	updated_at: string;
	current_version: WorkflowCurrentVersion;
}

export type GetWorkflowResponse = APIResponse<WorkflowDetails>;

// Export Execution Logs types
export interface ExportExecutionLogsParams {
	customerId: string;
	workflowId?: string;
	startDate?: string;
	endDate?: string;
}

export interface ExportExecutionLogsResponse {
	data: Blob;
	filename: string;
}
