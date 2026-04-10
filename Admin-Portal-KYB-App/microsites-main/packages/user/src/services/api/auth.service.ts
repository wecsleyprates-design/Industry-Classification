import { getMicrositeAuthCookiesApi } from "@joinworth/worth-core-utils";
import { type LoginResponse } from "@/types/common";

import MICROSERVICE from "@/constants/Microservices";

const cookiesApi = () => getMicrositeAuthCookiesApi();

export const postCustomerSignIn = async (body: {
	email: string;
	password: string;
}): Promise<LoginResponse> => {
	const url: string = `${MICROSERVICE.AUTH}/customer/sign-in`;
	const { data } = await cookiesApi().post<any>(url, body);
	return data;
};

export const postRefreshTokenCustomer = async (): Promise<LoginResponse> => {
	const response = await cookiesApi().post(
		`${MICROSERVICE.AUTH}/refresh-token/customer`,
	);
	return response.data;
};
