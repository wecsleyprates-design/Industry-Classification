import { api } from "@/lib/api";
import {
	type ApplicantConfigBody,
	type ApplicantDaysConfigBody,
	type CustomerApplicantConfigResponse,
} from "@/types/agingThreshold";

import MICROSERVICE from "@/constants/Microservices";

export const getCustomerApplicantConfig = async (
	customerId: string,
): Promise<CustomerApplicantConfigResponse> => {
	const url: string = `${MICROSERVICE.CASE}/customers/${customerId}/applicant-config/1`;
	const { data } = await api.get(url);
	return data;
};

export const updateCustomerApplicantConfig = async (
	payload: ApplicantConfigBody,
) => {
	const url: string = `${MICROSERVICE.CASE}/customers/${payload.customer_id}/applicant-config/1`;
	const { data } = await api.post(url, { is_enabled: payload.is_enabled });
	return data;
};

export const updateCustomerApplicantDaysConfig = async (
	payload: ApplicantDaysConfigBody,
) => {
	const url: string = `${MICROSERVICE.CASE}/customers/${payload.customer_id}/applicant-config/1`;
	const { data } = await api.put(url, payload.payload);
	return data;
};
