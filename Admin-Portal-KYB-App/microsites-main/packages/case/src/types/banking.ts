export interface GetBankingIntegrationResponse {
	status: string;
	message: string;
	data: GetBankingIntegrationResponseData[];
}

export interface GetBankingIntegrationResponseData {
	id: string;
	business_integration_task_id: string;
	bank_account: string;
	bank_name: string;
	official_name: null | string;
	institution_name: string;
	verification_status: null | string;
	balance_current?: string;
	balance_available?: string;
	balance_limit: null | string;
	currency: Currency | null;
	type: string;
	subtype: null | string;
	mask: string;
	created_at: Date;
	routing_number: null | string;
	wire_routing_number: null | string;
	deposit_account: boolean;
	average_balance: number | null;
	transactions: GetBankingIntegrationResponseDataTransaction[];
	balances: GetBankingIntegrationResponseDataBalance[];
	match: boolean;
	depositAccountInfo?: GetBankingIntegrationResponseDataDepositAccountInfo;
	verification_result?: BankAccountVerification;
	routing?: string;
	wire_routing?: string;
	is_selected?: boolean;
	account_holder_type?: string;
	account_holder_name?: string;
}

export interface BankAccountVerification {
	id?: string;
	bank_account_id?: string;
	case_id?: string;
	giact_verify_response_code_id?: number | null;
	giact_authenticate_response_code_id?: number | null;
	meta?: any;
	verification_status: string;
	account_verification_response?: {
		name: string;
		code: string;
		description: string;
		verification_response: string;
	} | null;
	account_authentication_response?: {
		name: string | null;
		code: string | null;
		description: string | null;
		verification_response: string | null;
	} | null;
	created_at: string | Date;
	updated_at: string | Date;
}

export interface GetBankingIntegrationResponseDataBalance {
	year: number;
	month: number;
	balance: number;
	bank_account_id: string;
	currency: Currency;
	created_at: Date;
	updated_at: null;
}

export enum Currency {
	Usd = "USD",
}

export interface GetBankingIntegrationResponseDataDepositAccountInfo {
	accounts: GetBankingIntegrationResponseDataDepositAccountInfoAccount[];
	numbers: GetBankingIntegrationResponseDataDepositAccountInfoNumbers;
}

export interface GetBankingIntegrationResponseDataDepositAccountInfoAccount {
	account_id: string;
	balances: GetBankingIntegrationResponseDataDepositAccountInfoAccountBalances;
	mask: string;
	name: string;
	official_name: null;
	subtype: null;
	type: string;
	institution_name: string;
	verification_status: string;
}

export interface GetBankingIntegrationResponseDataDepositAccountInfoAccountBalances {
	available: null;
	current: null;
	limit: null;
}

export interface GetBankingIntegrationResponseDataDepositAccountInfoNumbers {
	ach: GetBankingIntegrationResponseDataDepositAccountInfoNumbersAch[];
	bacs: any[];
	eft: any[];
	international: any[];
}

export interface GetBankingIntegrationResponseDataDepositAccountInfoNumbersAch {
	account: string;
	account_number: string;
	account_id: string;
	routing: string;
	wire_routing: null;
}

export interface GetBankingIntegrationResponseDataTransaction {
	id: string;
	bank_account_id: string;
	business_integration_task_id: string;
	transaction_id: string;
	date: Date;
	amount: string;
	description: string;
	payment_metadata: GetBankingIntegrationResponseDataTransactionPaymentMetadata;
	currency: Currency;
	category: string;
	payment_type: GetBankingIntegrationResponseDataTransactionPaymentType;
	is_pending: boolean;
	created_at: Date;
}

export interface GetBankingIntegrationResponseDataTransactionPaymentMetadata {
	by_order_of: null;
	payee: null;
	payer: null;
	payment_method: null;
	payment_processor: null;
	ppd_id: null;
	reason: null;
	reference_number: null;
}

export enum GetBankingIntegrationResponseDataTransactionPaymentType {
	Place = "place",
	Special = "special",
}

export interface GetBankingUploadsResponse {
	status: string;
	message: string;
	data: GetBankingUploadsResponseData[];
}

export interface GetBankingUploadsResponseData {
	id: string;
	file_name: string;
	file_url: string;
	file_path: string;
}
