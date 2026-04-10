import { type AddressSource } from "@/types/businessEntityVerification";
import { type Owner } from "@/types/case";
import { type APIResponse, type PaginatedAPIResponse } from "@/types/common";
import { type PrimaryAddressValue } from "@/types/integrations";

import { type BankAccount } from "@/page/Cases/CaseDetails/Tabs/Banking/types";

export const isObjectWithKeys = <T extends object>(
	obj: unknown,
	keys: Array<keyof T>,
): obj is T => {
	if (typeof obj !== "object" || obj === null) {
		return false;
	}

	return keys.every((key) => key in obj);
};

export const isPrimaryAddressValue = (
	address: unknown,
): address is PrimaryAddressValue => {
	const keys: Array<keyof PrimaryAddressValue> = [
		"line_1",
		"apartment",
		"city",
		"state",
		"postal_code",
		"country",
	];

	return isObjectWithKeys<PrimaryAddressValue>(address, keys);
};

export const isAddressSource = (address: unknown): address is AddressSource => {
	const keys: Array<keyof AddressSource> = [
		"address_line_1",
		"address_line_2",
		"city",
		"state",
		"postal_code",
		"country",
	];

	return isObjectWithKeys<AddressSource>(address, keys);
};

export const isOwner = (owner: unknown): owner is Owner => {
	const keys: Array<keyof Owner> = [
		"id",
		"title",
		"first_name",
		"last_name",
		"address_line_1",
		"address_line_2",
		"address_city",
		"address_state",
		"address_postal_code",
		"address_country",
	];

	return isObjectWithKeys<Owner>(owner, keys);
};

export const isNumericString = (
	value: unknown,
): value is `${number}` | `${number}.${number}` => {
	if (typeof value !== "string" || value === null || value === undefined)
		return false;
	if (value.trim() === "") return false;

	const regex = /^-?\d+(\.\d+)?$/;
	return regex.test(value);
};

export const isBankAccount = (account: unknown): account is BankAccount => {
	const keys: Array<keyof BankAccount> = [
		"verification_result",
		"match",
		"is_selected",
		"deposit_account",
	];

	return isObjectWithKeys<BankAccount>(account, keys);
};

export const isAPIResponse = <T>(
	response: unknown,
): response is APIResponse<T> => {
	const keys: Array<keyof APIResponse<T>> = ["status", "message", "data"];

	return isObjectWithKeys<APIResponse<T>>(response, keys);
};

export const isPaginatedAPIResponse = <T>(
	response: unknown,
): response is PaginatedAPIResponse<T> => {
	if (!isAPIResponse<T>(response)) {
		return false;
	}

	const data = response.data;

	const keys: Array<keyof PaginatedAPIResponse<T>["data"]> = [
		"records",
		"total_pages",
		"total_items",
	];

	return isObjectWithKeys<PaginatedAPIResponse<T>["data"]>(data, keys);
};
