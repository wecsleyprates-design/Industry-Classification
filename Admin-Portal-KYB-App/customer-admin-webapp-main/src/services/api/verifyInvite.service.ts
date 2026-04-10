import { api } from "@/lib/api";
import { type verifyInviteEmailResponse } from "@/types/verifyInvite";

import MICROSERVICE from "@/constants/Microservices";

export const verifyInviteEmail = async (
	token: string,
): Promise<verifyInviteEmailResponse> => {
	const url: string = `${MICROSERVICE.AUTH}/invite/${token}/verify`;
	const { data } = await api.post<verifyInviteEmailResponse>(url);
	return data;
};
