import { type Maybe } from "yup";
import { type IPayload } from "./common";

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
	address_line_2: string | null;
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
	is_deleted: boolean;
	deleted_by?: string;
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
	}>;
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
	applicantId: string;
	customerId: string;
	body: CreateBusinessType[];
}

export interface NewBusinessType {
	businessName: string;
	dbaName?: string;
	tin: string;
	npi?: string;
	externalId?: string;
	street: string;
	suite?: string;
	country: string;
	city: string;
	state?: string;
	zip: string;
	mStreet?: string;
	mSuite?: string;
	mCity?: string;
	mState?: string;
	mZip?: string;
	isMailingAddress?: boolean;
	skipCreditCheck?: boolean;
	bypassSSN?: boolean;
}

export interface CreateBusinessType {
	external_id?: string;
	name: string;
	dba1?: string;
	tin?: string;
	npi?: string;
	address_line_1: string;
	address_line_2?: string;
	address_postal_code: string;
	address_city: string;
	address_state?: string;
	address1_line_1?: string;
	address1_apartment?: string;
	address1_city?: string;
	address1_state?: string;
	address1_postal_code?: string;
	address1_country?: string;
	address_country?: string;
	quick_add: boolean;
}

export interface RelatedBusinessesResponse {
	status: string;
	message: string;
	data: Data;
}

export interface Data {
	records: BusinessRecord[];
	total_pages: number;
	total_items: number;
}

export interface BusinessRecord {
	id: string;
	name: string;
	status: string;
	created_at: Date;
	case_id: string;
	case_status: string;
	report_status: string;
	report_id: null;
	report_created_at: null;
}

export interface GetRelatedBusienssesPayload {
	page?: number;
	items_per_page?: number;
	pagination?: boolean;
	sort?: Record<string, unknown>;
	search?: Record<string, unknown>;
	filter?: Record<string, unknown>;
	filter_date?: Record<string, unknown>;
}
