export const LOGIN_ERROR_MSG = {
	REQUIRED_EMAIL: "*Email ID is required",
	VALID_EMAIL: "*Enter valid email ID",
	REQUIRED_PASSWORD: "*Password is required",
	PASSWORD_MIN_LENGTH: "*Entered password should be minimum 8 characters",
	PASSWORD_MAX_LENGTH:
		"*Entered password should not be more than 20 characters",
	STRONG_PASSWORD:
		"*Password must contain 8-20 characters, including uppercase, lowercase, number and a special character",
};

const BUSINESS_DETAILS_ERROR_MSG = {
	BUSINESS_NAME_REQUIRED: "Business name is required",
	TIN_REQUIRED: "TIN/SSN/EIN is required",
	TIN_LENGTH: "TIN/SSN/EIN must be 9 digits",
	TIN_NUMBERS_ONLY: "TIN/SSN/EIN must be numbers only",
	CA_BN_REQUIRED: "BN/GST/HST Number is required",
	CA_BN_LENGTH: "BN/GST/HST must be 9 digits",
	CA_BN_NUMBERS_ONLY: "BN/GST/HST must be numbers only",
	UK_CRN_REQUIRED: "Company Registration Number is required",
	UK_CRN_VALID: "Valid Company Registration Number is required",
};

/**
 * Get country-specific tax ID error messages.
 * Use this to display the correct error messages based on the business's country.
 */
export const getTaxIdErrorMessages = (
	countryCode: string | undefined | null,
) => {
	const code = countryCode?.toUpperCase();

	switch (code) {
		case "CA":
		case "CAN":
			return {
				REQUIRED: BUSINESS_DETAILS_ERROR_MSG.CA_BN_REQUIRED,
				LENGTH: BUSINESS_DETAILS_ERROR_MSG.CA_BN_LENGTH,
				NUMBERS_ONLY: BUSINESS_DETAILS_ERROR_MSG.CA_BN_NUMBERS_ONLY,
			};
		case "UK":
		case "GB":
		case "GBR":
			return {
				REQUIRED: BUSINESS_DETAILS_ERROR_MSG.UK_CRN_REQUIRED,
				LENGTH: BUSINESS_DETAILS_ERROR_MSG.UK_CRN_VALID,
				NUMBERS_ONLY: BUSINESS_DETAILS_ERROR_MSG.UK_CRN_VALID,
			};
		case "US":
		case "USA":
		default:
			return {
				REQUIRED: BUSINESS_DETAILS_ERROR_MSG.TIN_REQUIRED,
				LENGTH: BUSINESS_DETAILS_ERROR_MSG.TIN_LENGTH,
				NUMBERS_ONLY: BUSINESS_DETAILS_ERROR_MSG.TIN_NUMBERS_ONLY,
			};
	}
};

const ADDRESS_ERROR_MSG = {
	STREET_REQUIRED: "Street is required",
	CITY_REQUIRED: "City is required",
	STATE_REQUIRED: "State is required",
	CA_STATE_REQUIRED: "State/Province/Region is required",
	COUNTRY_REQUIRED: "Country is required",
	ZIP_REQUIRED: "Zip Code is required",
	ZIP_LENGTH: "Zip Code must be 5 digits",
	ZIP_NUMBERS_ONLY: "Zip Code must be numbers only",
	ZIP_POSTAL_REQUIRED: "Zip/Postal Code is required",
	ZIP_POSTAL_VALID: "Please enter a valid ZIP/Postal Code",
};

const ERROR_MSG = {
	...LOGIN_ERROR_MSG,
	...BUSINESS_DETAILS_ERROR_MSG,
	...ADDRESS_ERROR_MSG,
};

export default ERROR_MSG;
