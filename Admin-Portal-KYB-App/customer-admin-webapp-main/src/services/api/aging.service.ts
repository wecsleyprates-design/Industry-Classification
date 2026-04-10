import { api } from "@/lib/api";
import { type CustomerApplicantConfigResponse } from "@/types/aging";

import { MICROSERVICE } from "@/constants/index";

export const getCustomerApplicantConfig = async (
	customerId: string,
): Promise<CustomerApplicantConfigResponse> => {
	const url: string = `${MICROSERVICE.CASE}/customers/${customerId}/applicant-config/1`;
	const { data } = await api.get(url);
	return data;
};
