import qs from "qs";
import { api } from "@/lib/api";
import { type IPayload } from "@/types/common";

import MICROSERVICE from "@/constants/Microservices";

export const getAllBusinesses = async (
	params: IPayload | Record<string, unknown>,
) => {
	const response = await api.get(
		`${MICROSERVICE.CASE}/businesses${
			params ? `?${qs.stringify(params)}` : ""
		}`,
	);
	return response.data;
};

export const getBusinessByCustomerId = async (
	customerId: string,
	params: Record<string, any>,
) => {
	const queryString = qs.stringify(params, { encode: false });
	const { data } = await api.get(
		`${MICROSERVICE.CASE}/customers/${customerId}/businesses?${queryString}`,
	);
	return data;
};

export const getCustomersBusinessData = async (customerId: string) => {
	const url: string = `${MICROSERVICE.INTEGRATION}/customers/${customerId}/businesses-data`;
	const { data } = await api.get(url);
	return data;
};

export const getCustomerById = async (customerId: string) => {
	const { data } = await api.get(
		`${MICROSERVICE.AUTH}/customers/${customerId}`,
	);
	return data;
};
