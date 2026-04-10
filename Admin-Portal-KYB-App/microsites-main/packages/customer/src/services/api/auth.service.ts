import { getMicrositeAuthCookiesApi } from "@joinworth/worth-core-utils";
import { type ILoginResponse } from "@/types/auth";

import MICROSERVICE from "@/constants/Microservices";

const cookiesApi = () => getMicrositeAuthCookiesApi();

export const postCustomerSignIn = async (body: {
	email: string;
	password: string;
}): Promise<ILoginResponse> => {
	const url: string = `${MICROSERVICE.AUTH}/admin/sign-in`;
	const { data } = await cookiesApi().post<any>(url, body);
	return data;
};

export const postRefreshTokenCustomer = async (): Promise<ILoginResponse> => {
	const response = await cookiesApi().post(
		`${MICROSERVICE.AUTH}/refresh-token/admin`,
	);
	return response.data;
};
