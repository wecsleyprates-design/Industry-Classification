import { getMicrositeAuthCookiesApi } from "@joinworth/worth-core-utils";
import { type ILoginResponse } from "@/types/auth";

import MICROSERVICE from "@/constants/Microservices";

const cookiesApi = () => getMicrositeAuthCookiesApi();

export const loginCustomerAdmin = async (body: {
	email: string;
	password: string;
}): Promise<any> => {
	const url = `${MICROSERVICE.AUTH}/customer/sign-in`;
	const { data } = await cookiesApi().post<any>(url, body);
	return data;
};

export const loginAdmin = async (body: {
	email: string;
	password: string;
}): Promise<any> => {
	const url = `${MICROSERVICE.AUTH}/admin/sign-in`;
	const { data } = await cookiesApi().post<any>(url, body);
	return data;
};

export const refreshTokenCustomer = async (): Promise<ILoginResponse> => {
	const response = await cookiesApi().post(
		`${MICROSERVICE.AUTH}/refresh-token/customer`,
	);
	return response.data;
};

export const refreshTokenAdmin = async (): Promise<ILoginResponse> => {
	const { data } = await cookiesApi().post(
		`${MICROSERVICE.AUTH}/refresh-token/admin`,
	);
	return data;
};
