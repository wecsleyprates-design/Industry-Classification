import { getMicrositeAuthCookiesApi } from "@joinworth/worth-core-utils";
import { type ILoginResponse } from "@/lib/types/auth";

import MICROSERVICE from "@/constants/Microservices";

const cookiesApi = () => getMicrositeAuthCookiesApi();

export const loginCustomerAdmin = async (body: {
	email: string;
	password: string;
}): Promise<any> => {
	const url: string = `${MICROSERVICE.AUTH}/customer/sign-in`;
	const { data } = await cookiesApi().post<any>(url, body);
	return data;
};

export const refreshToken = async (): Promise<ILoginResponse> => {
	const response = await cookiesApi().post(
		`${MICROSERVICE.AUTH}/refresh-token/customer`,
	);
	return response.data;
};
