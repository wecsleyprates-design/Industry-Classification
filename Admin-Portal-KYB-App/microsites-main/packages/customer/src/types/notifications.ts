export interface GetEmailConfig {
	status: string;
	message: string;
	data: EmailConfigObject[];
}

export interface EmailConfigObject {
	id: string;
	customer_id: string;
	notification_type: 1;
	is_enabled: boolean;
	created_at: string;
	created_by: string;
	updated_at: string;
	updated_by: string;
	type_id: number;
	code: string;
	label: string;
	config: {
		id: string;
		code: string;
		label: string;
	};
}

export interface UpdateEmailConfigBody {
	configs: Array<{
		customer_id: string;
		notification_code: string;
		is_enabled: boolean;
	}>;
}
