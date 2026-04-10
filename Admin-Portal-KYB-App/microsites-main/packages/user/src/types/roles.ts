import { type ApiResponse } from "./api";

export interface SubroleConfigResponse {
	status: string;
	message: string;
	data: Data;
}
export interface Data {
	subrole?: Subrole;
	subrole_configs: SubroleConfig[];
}
export interface Subrole {
	id: string;
	code: string;
	label: string;
	description: string;
}
export interface SubroleConfig {
	label: string;
	description: string;
	node_type: NodeType;
	access_level: string | null;
	tab_type: TabType;
	children: Child[];
	is_enabled?: boolean;
	permission_code?: string | null;
	permission_label?: string;
	permissions_id?: string | null;
	actions: string[];
}

export interface Child {
	label: string;
	description: string;
	node_type: NodeType;
	access_level: AccessLevel | null;
	tab_type: TabType;
	children: Child[];
	is_enabled?: boolean;
	permission_code?: string | null;
	permission_label?: string;
	permissions_id?: string | null;
	actions: string[];
}
export enum AccessLevel {
	CreateDelete = "CREATE & DELETE",
	Edit = "EDIT",
	View = "VIEW",
}
export enum NodeType {
	Access = "access",
	Collapsible = "collapsible",
	Text = "text",
	Toggle = "toggle",
}
export enum TabType {
	Admin = "admin",
	Feature = "feature",
}

export type RolesListingResponse = ApiResponse<RolesListingResponseData>;

export interface RolesListingResponseData {
	records: RoleRecord[];
	total_pages: number;
	total_items: number;
}

export interface RoleRecord {
	subrole: Subrole;
	users_count: number;
	permissions_count: number;
	is_custom: boolean;
}

export type GetAllSubrolePermissions =
	ApiResponse<GetAllSubrolePermissionsData>;

export interface GetAllSubrolePermissionsData {
	permissions: Permission[];
}

export interface Permission {
	id: number;
	code: null | string;
	label: string;
	description: string;
	node_type: NodeType;
	permission_id: number | null;
	sort_order: number;
	tab_type: TabType;
	access_level_label: AccessLevelLabel;
	group_label: string;
}

export enum AccessLevelLabel {
	CreateDelete = "Create & Delete",
	Edit = "Edit",
	NoAccess = "No Access",
	View = "View",
}

export interface GetRolesResponse {
	status: string;
	message: string;
	data: Role[];
}

export interface Role {
	code: string;
	label: string;
	id: string;
	display_name: string;
	description: string;
}
