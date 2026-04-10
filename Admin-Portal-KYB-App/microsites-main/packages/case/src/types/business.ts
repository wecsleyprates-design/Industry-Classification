import { type Maybe } from "yup";
import { type IPayload } from "./common";
import { type ReportStatus } from "./report";

export interface BusinessFormBody {
	firstName: string;
	lastName: string;
	email: string;
	mobile?: string | null;
	companyName: string;
	companyNumber?: string | null;
}

export interface BusinessFormBoolean {
	firstName?: boolean | undefined;
	lastName?: boolean | undefined;
	email?: boolean | undefined;
	mobile?: boolean | undefined;
	companyName?: boolean | undefined;
	companyNumber?: boolean | undefined;
}

export interface BusinessRequestBody {
	first_name?: string;
	last_name?: string;
	email?: string;
	mobile?: string;
	company_name?: string;
	company_contact_number?: string;
	status?: string;
}

export interface BusinessUpdateRequestBody {
	businessId: string;
	body: BusinessRequestBody;
}

export interface IGetBusinessCases {
	businessId: string;
	customerID: string;
	params: IPayload;
	platformType?: "admin" | "customer";
}
export interface SendInvitationBody {
	firstName: string;
	lastName: string;
	email: string;
	mobile?: string | null;
}

export interface InvitationForm {
	firstName: string;
	lastName: string;
	email: string;
	companyName: {
		business_id?: string;
		label?: string;
		name?: string;
		value?: string;
	};
	mobile?: Maybe<string | undefined>;
	companyMobile?: Maybe<string | undefined>;
}

export interface ResendBusinessInvite {
	customerId: string;
	businessId: string;
	invitationId: string;
}

export interface UpdateRiskMonitoring {
	customerId: string;
	businessId: string;
	body: {
		risk_monitoring: boolean;
	};
}

export interface GetBusinessByIdResponse {
	status: string;
	message: string;
	data: GetBusinessByIdData;
}

export interface GetBusinessByIdData {
	id: string;
	name: string;
	tin: string;
	address_line_1: string;
	address_line_2: null;
	address_city: string;
	address_state: string;
	address_postal_code: string;
	address_country: string;
	created_at: Date;
	created_by: string;
	updated_at: Date;
	updated_by: string;
	mobile: null;
	official_website: null;
	public_website: null;
	social_account: null;
	status: string;
	naics_code?: string;
	mcc_code?: string;
	naics_title: null;
	mcc_title: null;
	industry: Industry;
	is_monitoring_enabled: boolean;
	subscription: Subscription;
	owners: any;
	business_names: Array<{ name: string; is_primary: boolean }>;
	business_addresses: Array<{
		address_line_1: string;
		address_line_2: string;
		city: string;
		state: string;
		postal_code: string;
		is_primary: boolean;
		country?: string;
	}>;
	guest_owner_edits?: string[];
}

export interface Industry {
	id: number;
	name: string;
	code: string;
	sector_code: string;
	created_at: Date;
	updated_at: Date;
}

export interface Subscription {
	status: string;
	created_at: Date;
	updated_at: Date;
}

export interface NewBusinessPayload {
	customerId: string;
	body: CreateBusinessType[];
}

export interface NewBusinessType {
	businessName: string;
	dbaName?: string;
	tin: string;
	street: string;
	suite?: string;
	city: string;
	state: string;
	zip: string;
	mStreet?: string;
	mSuite?: string;
	mCity?: string;
	mState?: string;
	mZip?: string;
	isMailingAddress?: boolean;
}

export interface CreateBusinessType {
	name: string;
	dba1?: string;
	tin: string;
	address_line_1: string;
	address_postal_code: string;
	address_city: string;
	address_state: string;
	address1_line_1?: string;
	address1_city?: string;
	address1_state?: string;
	address1_postal_code?: string;
	quick_add: boolean;
}

export interface RelatedBusiness {
	id: string;
	name: string;
	status: string;
	created_at: Date;
	case_id: string;
	case_status: string;
	report_status: ReportStatus;
	report_id: null;
	report_created_at: null;
}

export type Business = {
	id: string;
	name: string;
	tin: string | null;
	address_line_1: string | null;
	address_line_2: string | null;
	address_city: string | null;
	address_state: string | null;
	address_postal_code: string | null;
	address_country: string | null;
	created_at: string;
	created_by: string;
	updated_at: string;
	updated_by: string;
	mobile: string | null;
	official_website: string | null;
	public_website: string | null;
	social_account: string | null;
	status: "VERIFIED" | "UNVERIFIED" | "PENDING" | "REJECTED" | string;
	industry: number | null;
	mcc_id: number | null;
	naics_id: number | null;
	is_deleted: boolean;
	naics_code: number | null;
	naics_title: string | null;
	mcc_code: number | null;
	mcc_title: string | null;
	customer_id: string | null;
	is_monitoring_enabled: boolean;
	external_id: string | null;
	worth_score: number | null;
};

export type GetBusinessesResponse = {
	status: string;
	message: string;
	data: {
		records: Business[];
		items_per_page: number;
		total_records: number;
		total_pages: number;
		total_items: number;
	};
};
