export interface User {
	id: string;
	email: string;
	first_name: string;
	last_name: string;
	mobile?: string;
	is_email_verified: boolean;
	is_first_login: boolean;
	created_at: string;
	updated_at: string;
	status: string; // USER_STATUS values
	subrole: {
		id: string;
		code: "cro" | "risk_analyst" | "owner";
		display_name: "CRO" | "Risk Analyst" | "Owner";
		label: string;
		description: string;
	};
}
