import { type IPayload } from "./common";

export interface TransactionRecord {
	date: string;
	description: string;
	merchant_name?: string | null;
	currency: string;
	transaction: number;
	account: string;
	bank_name: string;
	official_name: string;
	institution_name: string;
	account_type?: string | null;
	account_subtype?: string | null;
	balance: number;
}

export interface GetTransactionResponseData {
	records: TransactionRecord[];
	total: number;
	total_pages: number;
	total_items: number;
}

export interface GetTransactionResponse {
	status: string;
	message: string;
	data: GetTransactionResponseData;
}

export interface GetTransactionRequestPayload {
	businessId: string;
	params: IPayload;
}

export interface TransactionAccount {
	bank_account: string;
	account_name: string;
	official_name: string;
	institution_name: string;
}

export interface GetTransactionsAccountsResponse {
	status: string;
	message: string;
	data: TransactionAccount[];
}
