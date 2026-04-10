const ERROR_MSG = {
	REQUIRED_EMAIL: "*Email is required",
	VALID_EMAIL: "*Enter valid email",
	REQUIRED_PASSWORD: "*Password is required",
	PASSWORD_MIN_LENGTH: "*Entered password should be minimum 8 characters",
	PASSWORD_MAX_LENGTH:
		"*Entered password should not be more than 20 characters",
	STRONG_PASSWORD:
		"*Password must contain 8-20 characters, including uppercase, lowercase, number and a special character",
	PROVIDE_MIN_SCORE: "Minimum score is required",
	PROVIDE_MAX_SCORE: "Maximum score is required",
	MIN_SCORE_LIMIT: "Minimum score limit is 0",
	MAX_SCORE_LIMIT: "Maximum score limit is 850",
	PROVIDE_INCLUSIVE_RANGES: "Ranges must be continuous and mutually exclusive",
	MAX_MUST_BE_GREATER_THAN_MIN:
		"Maximum score must be greater than minimum score",
	REQUIRED_TOGGLE: "This field is required",
	PROVIDE_CONSUMER_KEY: "*Consumer key is required",
	PROVIDE_ACQUIRER_ID: "*Acquirer ID is required",
	REQUIRED_FILE: "*File is required",
	VALID_FILE_TYPE: "*File type is invalid",
	WORKFLOW_NAME_REQUIRED: "*Workflow name is required",
	WORKFLOW_NAME_MAX_LENGTH: "*Workflow name must not exceed 100 characters",
	WORKFLOW_DESCRIPTION_MAX_LENGTH:
		"*Workflow description must not exceed 500 characters",
	WORKFLOW_TRIGGER_REQUIRED: "*Trigger is required",
};

export default ERROR_MSG;
