import { type ApiResponse } from "./api";
import { type User } from "./User";

import { type AccessType, type CodeModule } from "@/constants/Modules";

export type DateType = string | null | Date;

export type LoginResponseUserDetails = Pick<
	User,
	"id" | "first_name" | "last_name" | "email" | "is_email_verified"
>;

export type PermissionResponse = Record<AccessType, boolean>;

export interface Permission {
	id: number;
	code: `${CodeModule}:${AccessType}`;
	label: string;
}

export type AllPermissions = Record<
	Partial<CodeModule>,
	Partial<PermissionResponse>
>;

export interface LoginResponseData {
	access_token: string;
	id_token: string;
	refresh_token: string;
	user_details: LoginResponseUserDetails;
	permissions: Permission[];
	customer_details: { id: string; name: string };
}

export type LoginResponse = ApiResponse<LoginResponseData>;

export interface IAuthStore extends Omit<LoginResponseData, "permissions"> {
	subrole?: {
		code: string;
		id: string;
		label: string;
	};
	permissions: Partial<AllPermissions>;
}

export type TOption = {
	label: string;
	value: string | Record<string, unknown>;
	disabled?: boolean;
	subLabel?: string;
	description?: string;
};
