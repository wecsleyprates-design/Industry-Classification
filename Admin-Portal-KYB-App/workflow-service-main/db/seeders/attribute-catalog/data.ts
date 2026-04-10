/**
 * Attribute Catalog Seed Data
 *
 * This file contains the list of attributes to be seeded into the core_attribute_catalog table.
 *
 * To add new attributes:
 * 1. Add a new entry to the `attributes` array below
 * 2. Ensure all required fields are provided (source, path, context, data_type)
 * 3. Run the seeder: npm run seed:attributes
 *
 * The seeder will:
 * - Insert new attributes
 * - Update existing attributes (based on source + path)
 * - Soft delete attributes that are not in this list (set active = false)
 */

type AttributeDataType = "string" | "number" | "boolean" | "date" | "enum";
type AttributeSource = "facts" | "case";

export interface AttributeSeedData {
	source: AttributeSource;
	path: string; // Full path (e.g., facts.credit_score)
	context: string; // Business category (e.g., financial, kyb, kyc)
	label: string | null; // Friendly name for UI (null = use attribute name from path)
	data_type: AttributeDataType;
	description: string | null;
	validation_regex: string | null; // Optional regex pattern for value validation
}

/**
 * List of attributes to seed
 */
export const attributes: AttributeSeedData[] = [
	{
		source: "facts",
		path: "facts.primary_address.country",
		context: "kyb",
		label: "Country",
		data_type: "string",
		description: null,
		validation_regex: null
	},
	{
		source: "facts",
		path: "facts.naics_code",
		context: "kyb",
		label: "Naics Code",
		data_type: "string",
		description: null,
		validation_regex: null
	},
	{
		source: "facts",
		path: "facts.bankruptcies.count",
		context: "kyb",
		label: "Bankruptcies Count",
		data_type: "number",
		description: null,
		validation_regex: null
	},
	{
		source: "facts",
		path: "facts.bankruptcies.most_recent_status",
		context: "kyb",
		label: "Bankruptcies Status",
		data_type: "string",
		description: null,
		validation_regex: null
	},
	{
		source: "facts",
		path: "facts.tin_match_boolean",
		context: "kyb",
		label: "Tin Match",
		data_type: "boolean",
		description: null,
		validation_regex: null
	},
	{
		source: "facts",
		path: "facts.address_match_boolean",
		context: "kyb",
		label: "Address Match",
		data_type: "boolean",
		description: null,
		validation_regex: null
	},
	{
		source: "facts",
		path: "facts.name_match_boolean",
		context: "kyb",
		label: "Name Match",
		data_type: "boolean",
		description: null,
		validation_regex: null
	},
	{
		source: "facts",
		path: "facts.sos_active",
		context: "kyb",
		label: "SOS Active",
		data_type: "boolean",
		description: null,
		validation_regex: null
	},
	{
		source: "facts",
		path: "facts.review_rating",
		context: "kyb",
		label: "Review Rating",
		data_type: "number",
		description: null,
		validation_regex: null
	},
	{
		source: "facts",
		path: "facts.watchlist_hits",
		context: "kyb",
		label: "Watchlist Hits",
		data_type: "number",
		description: null,
		validation_regex: null
	},
	{
		source: "facts",
		path: "facts.idv_passed",
		context: "kyc",
		label: "IDV Passed",
		data_type: "number",
		description: null,
		validation_regex: null
	},
	{
		source: "facts",
		path: "facts.idv_status",
		context: "kyc",
		label: "IDV Status",
		data_type: "string",
		description: null,
		validation_regex: null
	},
	{
		source: "facts",
		path: "facts.idv_passed_boolean",
		context: "kyc",
		label: "IDV Passed Boolean",
		data_type: "boolean",
		description: null,
		validation_regex: null
	},
	{
		source: "facts",
		path: "facts.mcc_code",
		context: "kyb",
		label: "MCC Code",
		data_type: "string",
		description: null,
		validation_regex: null
	},
	{
		source: "facts",
		path: "facts.pep_hits",
		context: "kyc",
		label: "PEP Hits",
		data_type: "number",
		description: null,
		validation_regex: null
	},
	{
		source: "facts",
		path: "facts.adverse_media_hits",
		context: "kyb",
		label: "Adverse Media Hits",
		data_type: "number",
		description: null,
		validation_regex: null
	},
	// Owner verification (array path): rule applies to all owners (AND)
	{
		source: "facts",
		path: "facts.owner_verification[*].fraud_report.synthetic_identity_risk_score",
		context: "kyc",
		label: "Synthetic Identity Risk Score",
		data_type: "number",
		description: null,
		validation_regex: null
	},
	{
		source: "facts",
		path: "facts.owner_verification[*].fraud_report.stolen_identity_risk_score",
		context: "kyc",
		label: "Stolen Identity Risk Score",
		data_type: "number",
		description: null,
		validation_regex: null
	},
	{
		source: "facts",
		path: "facts.num_judgements",
		context: "kyb",
		label: "Number of Judgements",
		data_type: "number",
		description: null,
		validation_regex: null
	},
	{
		source: "facts",
		path: "facts.liens.count",
		context: "kyb",
		label: "Liens Count",
		data_type: "number",
		description: null,
		validation_regex: null
	},
	{
		source: "facts",
		path: "facts.liens.most_recent",
		context: "kyb",
		label: "Liens Most Recent",
		data_type: "date",
		description: null,
		validation_regex: null
	},
	{
		source: "facts",
		path: "facts.liens.most_recent_amount",
		context: "kyb",
		label: "Liens Most Recent Amount",
		data_type: "number",
		description: null,
		validation_regex: null
	},
	{
		source: "facts",
		path: "facts.liens.most_recent_status",
		context: "kyb",
		label: "Liens Most Recent Status",
		data_type: "string",
		description: null,
		validation_regex: null
	},
	{
		source: "facts",
		path: "facts.liens.total_open_lien_amount",
		context: "kyb",
		label: "Liens Total Open Amount",
		data_type: "number",
		description: null,
		validation_regex: null
	},
	{
		source: "facts",
		path: "facts.num_liens",
		context: "kyb",
		label: "Number of Liens",
		data_type: "number",
		description: null,
		validation_regex: null
	},
	{
		source: "facts",
		path: "facts.risk_score",
		context: "kyb",
		label: "Risk Score",
		data_type: "number",
		description: null,
		validation_regex: null
	},
	{
		source: "facts",
		path: "facts.worth_score",
		context: "score",
		label: "Worth Score",
		data_type: "number",
		description: null,
		validation_regex: null
	}
];
