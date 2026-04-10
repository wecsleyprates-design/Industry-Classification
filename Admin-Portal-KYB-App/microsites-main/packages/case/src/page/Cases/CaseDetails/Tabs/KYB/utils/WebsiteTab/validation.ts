import type { RegisterOptions } from "react-hook-form";
import { ERROR_MESSAGES } from "../../constants/WebsiteTab/errorMessages";
import type { WebsiteTabFormValues } from "../../schemas/WebsiteTab/websiteTabSchema";

/**
 * Validation rules for WebsiteTab fields.
 * Uses react-hook-form's RegisterOptions format.
 * Consistent with onboarding flow validations.
 */

/**
 * Validate website URL format.
 * Accepts URLs with or without protocol (http/https).
 */
export const validateWebsite = (
	value: string | undefined,
): boolean | string => {
	if (!value || value.trim() === "") {
		return true; // Empty is valid (field is optional)
	}

	const trimmedUrl = value.trim();
	// URL pattern that accepts:
	// - With protocol: http://example.com, https://example.com
	// - Without protocol: example.com, www.example.com
	// - With paths: example.com/path, example.com/path/to/page
	const urlPattern =
		/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;

	const isValid = urlPattern.test(trimmedUrl);
	return isValid || ERROR_MESSAGES.VALID_WEBSITE;
};

/**
 * Get validation rules for a specific field.
 * Returns react-hook-form RegisterOptions.
 */
export const getFieldValidationRules = (
	fieldKey: keyof WebsiteTabFormValues,
): RegisterOptions<WebsiteTabFormValues> | undefined => {
	switch (fieldKey) {
		case "website":
			return {
				validate: validateWebsite,
			};
		default:
			return undefined;
	}
};
