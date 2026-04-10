import { type ILoginResponseUserDetails } from "./common";

import { type TAccessType, type TCodeModule } from "@/constants/Modules";

export interface LoginBody {
	username: string;
	password: string;
}

export interface ILoginResponse {
	status: string;
	message: string;
	data: {
		subrole: {
			code: string;
			id: string;
			label: string;
		};
		access_token: string;
		id_token: string;
		refresh_token: string;
		user_details: ILoginResponseUserDetails;
		permissions: IPermission[];
		customer_details: ICustomerDetails;
	};
}

export interface IPermission {
	id: number;
	code: `${TCodeModule}:${TAccessType}`;
	label: string;
}

export interface ICustomerDetails {
	id: string;
	name: string;
}
