import { type BankAccountVerification } from "@/types/banking";

export const getGAuthenticateStatusAndDescription = (
	response: BankAccountVerification["account_authentication_response"],
): {
	status: "Did Not Run" | "No Match" | "Verified" | "Match";
	description: string;
} => {
	if (!response?.code) {
		return {
			status: "Did Not Run",
			description:
				"Bank account is active, but name verification isn't currently available.",
		};
	}

	switch (response.code) {
		case "CA01": {
			return {
				status: "No Match",
				description: "Information submitted failed gAuthenticate.",
			};
		}
		case "CA11": {
			return {
				status: "Verified",
				description: "Customer authentication passed gAuthenticate.",
			};
		}
		case "CA21": {
			return {
				status: "No Match",
				description:
					"The customer or business name data did not match gAuthenticate data.",
			};
		}
		case "CA22": {
			return {
				status: "Verified",
				description:
					"Customer authentication passed. However, the customer's TaxId (SSN/ITIN) data did not match gAuthenticate data.",
			};
		}
		case "CA23": {
			return {
				status: "Verified",
				description:
					"Customer authentication passed. However, the customer's address data did not match gAuthenticate data.",
			};
		}
		case "CA24": {
			return {
				status: "Verified",
				description:
					"Customer authentication passed. However, the customer's phone data did not match gAuthenticate data.",
			};
		}
		case "CA25": {
			return {
				status: "Verified",
				description:
					"Customer authentication passed. However, the customer's date of birth or ID data did not match gAuthenticate data.",
			};
		}
		case "CA30": {
			return {
				status: "Verified",
				description:
					"Customer authentication passed. However, multiple contact data points did not match gAuthenticate data.",
			};
		}
		case "CI01": {
			return {
				status: "No Match",
				description:
					"Information submitted failed gIdentify/CustomerID.",
			};
		}
		case "CI02": {
			return {
				status: "Did Not Run",
				description:
					"Bank account is active, but name verification isn't currently available.",
			};
		}
		case "CI11": {
			return {
				status: "Match",
				description:
					"Customer identification passed gIdentify/CustomerID.",
			};
		}
		case "CI21": {
			return {
				status: "No Match",
				description:
					"The customer or business name data did not match gIdentify/CustomerID data.",
			};
		}
		case "CI22": {
			return {
				status: "Verified",
				description:
					"Customer authentication passed. However, the customer's TaxId (SSN/ITIN) data did not match gAuthenticate data.",
			};
		}
		case "CI23": {
			return {
				status: "Verified",
				description:
					"Customer authentication passed. However, the customer's address data did not match gAuthenticate data.",
			};
		}
		case "CI24": {
			return {
				status: "Verified",
				description:
					"Customer authentication passed. However, the customer's phone data did not match gAuthenticate data.",
			};
		}
		case "CI25": {
			return {
				status: "Verified",
				description:
					"Customer authentication passed. However, the customer's date of birth or ID data did not match gAuthenticate data.",
			};
		}
		case "CI30": {
			return {
				status: "Verified",
				description:
					"Customer authentication passed. However, multiple contact data points did not match gAuthenticate data.",
			};
		}
		case "ND02": {
			return {
				status: "No Match",
				description:
					"No data was found matching the owner information provided.",
			};
		}
		default: {
			return {
				status: response?.name?.replace("Account ", "") as
					| "Did Not Run"
					| "No Match"
					| "Verified"
					| "Match",
				description: response?.description ?? "",
			};
		}
	}
};
