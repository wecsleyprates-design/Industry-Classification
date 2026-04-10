import { api } from "@/lib/api";
import {
	type BusinessApplicantConfigResponse,
	type BusinessApplicantConfigResponseDataConfig,
} from "@/types/aging";

import MICROSERVICE from "@/constants/Microservices";

export const getBusinessApplicantConfig = async (
	businessId: string,
): Promise<BusinessApplicantConfigResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.CASE}/businesses/${businessId}/applicant-config/1`,
	);
	return data;
};
export const getCustomerApplicantConfig = async (
	customerId: string,
): Promise<BusinessApplicantConfigResponse> => {
	const url: string = `${MICROSERVICE.CASE}/customers/${customerId}/applicant-config/1`;
	const { data } = await api.get(url);
	return data;
};

export const postBusinessApplicantConfig = async (
	businessId: string,
	payload: {
		is_enabled: boolean;
	},
) => {
	const { data } = await api.post(
		`${MICROSERVICE.CASE}/businesses/${businessId}/applicant-config/1`,
		payload,
	);
	return data;
};

export const updateBusinessApplicantConfig = async (
	businessId: string,
	payload: BusinessApplicantConfigResponseDataConfig[],
) => {
	const { data } = await api.put(
		`${MICROSERVICE.CASE}/businesses/${businessId}/applicant-config/1`,
		payload,
	);
	return data;
};
