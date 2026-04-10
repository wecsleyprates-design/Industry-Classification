import { api } from "@/lib/api";
import {
	type GetEmailConfig,
	type UpdateEmailConfigBody,
} from "@/types/notifications";

import { MICROSERVICE } from "@/constants";

export const getEmailConfig = async (
	customerId: string,
): Promise<GetEmailConfig> => {
	const url: string = `${MICROSERVICE.NOTIFICATION}/customers/${customerId}/email-config`;
	const { data } = await api.get(url);
	return data;
};

export const updateEmailConfig = async (payload: UpdateEmailConfigBody) => {
	const url: string = `${MICROSERVICE.NOTIFICATION}/email-types/config`;

	const { data } = await api.patch(url, payload);
	return data;
};
