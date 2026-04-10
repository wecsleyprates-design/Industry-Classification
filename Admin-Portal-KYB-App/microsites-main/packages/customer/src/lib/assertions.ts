import { type APIResponse, type PaginatedAPIResponse } from "@/types/common";

export const isObjectWithKeys = <T extends object>(
	obj: unknown,
	keys: Array<keyof T>,
): obj is T => {
	if (typeof obj !== "object" || obj === null) {
		return false;
	}

	return keys.every((key) => key in obj);
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
