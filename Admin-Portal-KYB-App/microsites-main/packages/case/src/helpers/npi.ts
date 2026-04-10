import { type BusinessNpiData } from "@/types/integrations";

export const getNpiProvider = (npiData: BusinessNpiData) => {
	if (!npiData) {
		return null;
	}

	const names = [
		npiData.provider_first_name,
		npiData.provider_middle_name,
		npiData.provider_last_name,
	];

	if (names.every((n) => !n)) {
		return null;
	}

	return [
		npiData.metadata?.["provider name prefix text"],
		npiData.provider_first_name,
		npiData.provider_middle_name,
		npiData.provider_last_name,
		npiData.provider_credential_text,
	]
		.filter((text) => !!text)
		.join(" ");
};
