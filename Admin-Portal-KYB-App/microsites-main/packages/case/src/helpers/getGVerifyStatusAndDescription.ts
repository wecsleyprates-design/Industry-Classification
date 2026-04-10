import { type BankAccountVerification } from "@/types/banking";

export const getGVerifyStatusAndDescription = (
	response: BankAccountVerification["account_verification_response"],
): {
	status: "Did Not Run" | "Unverified" | "Verified" | "High Risk";
	description: string;
} => {
	if (!response?.code) {
		return {
			status: "Did Not Run",
			description:
				"There is no AccountResponseCode value for this result.",
		};
	}

	switch (response.code) {
		case "GS01": {
			return {
				status: "Unverified",
				description:
					"The routing number supplied fails the validation test.",
			};
		}
		case "GS02": {
			return {
				status: "Unverified",
				description:
					"The account number supplied fails the validation test.",
			};
		}
		case "GS03": {
			return {
				status: "Unverified",
				description:
					"The check number supplied fails the validation test.",
			};
		}
		case "GS04": {
			return {
				status: "Unverified",
				description: "The amount supplied fails the validation test.",
			};
		}
		case "GP01": {
			return {
				status: "Unverified",
				description:
					"The account was found as active in your Private Bad Checks List.",
			};
		}
		case "RT00": {
			return {
				status: "Verified",
				description:
					"The routing number belongs to a reporting bank; however, no positive nor negative information has been reported on the account number.",
			};
		}
		case "RT01": {
			return {
				status: "High Risk",
				description:
					"This account should be declined based on the risk factor reported.",
			};
		}
		case "RT02": {
			return {
				status: "High Risk",
				description:
					"This item should be rejected based on the risk factor being reported.",
			};
		}
		case "RT03": {
			return {
				status: "High Risk",
				description:
					"Current negative data exists on this account. Accept transaction with risk. (Example: Checking or savings accounts in NSF status, recent returns, or outstanding items)",
			};
		}
		case "RT04": {
			return {
				status: "High Risk",
				description:
					"Non-Demand Deposit Account (post no debits), Credit Card Check, Line of Credit, Home Equity, or a Brokerage check.",
			};
		}
		case "RT05": {
			return {
				status: "Did Not Run",
				description: "",
			};
		}
		case "_1111": {
			return {
				status: "Verified",
				description:
					"The account was found to be an open and valid checking account.",
			};
		}
		case "_2222": {
			return {
				status: "Verified",
				description:
					"The account was found to be an American Express Travelers Cheque account.",
			};
		}
		case "_3333": {
			return {
				status: "Verified",
				description:
					"This account was reported with acceptable, positive data found in current or recent transactions.",
			};
		}
		case "_5555": {
			return {
				status: "Verified",
				description:
					"The account was found to be an open and valid savings account.",
			};
		}
		case "_7777":
		// fall through
		case "_8888":
		// fall through
		case "_9999": {
			return {
				status: "Did Not Run",
				description: "",
			};
		}
		case "GN01": {
			return {
				status: "High Risk",
				description:
					"Negative information was found in this account's history.",
			};
		}
		case "GN05": {
			return {
				status: "High Risk",
				description:
					"The routing number is reported as not currently assigned to a financial institution.",
			};
		}
		case "ND00": {
			return {
				status: "Verified",
				description:
					"No positive or negative information has been reported on the account.",
			};
		}
		case "ND01": {
			return {
				status: "Verified",
				description:
					"This routing number can only be valid for US Government financial institutions.",
			};
		}
		default: {
			return {
				status: response?.name?.replace("Account ", "") as
					| "Did Not Run"
					| "Unverified"
					| "Verified"
					| "High Risk",
				description: response?.description || "",
			};
		}
	}
};
