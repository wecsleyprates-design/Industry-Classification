import { useMutation, useQuery } from "@tanstack/react-query";
import { type UpdateCaseAuditTrailCommentPayload } from "@/types/case";
import {
	type GetAuditTrailPayload,
	type UpdateEmailConfigBody,
} from "@/types/notifications";
import {
	getAuditTrail,
	getAuditTrailActions,
	getEmailConfig,
	updateCaseAuditTrailComment,
	updateEmailConfig,
} from "../api/notifications.service";

import { VALUE_NOT_AVAILABLE } from "@/constants";

export const useGetEmailConfig = (customerId: string) =>
	useQuery({
		queryKey: ["getEmailConfig", customerId],
		queryFn: async () => {
			const res = await getEmailConfig(customerId);
			return res;
		},
		enabled: !!customerId,
	});

export const useUpdateEmailConfig = () =>
	useMutation({
		mutationKey: ["updateEmailConfig"],
		mutationFn: async (payload: UpdateEmailConfigBody) => {
			const res = await updateEmailConfig(payload);
			return res;
		},
	});

export const useGetAuditTrailActions = () =>
	useQuery({
		queryKey: ["getAuditTrailActions"],
		queryFn: async () => {
			const res = await getAuditTrailActions();
			return res;
		},
	});

export const useGetAuditTrail = (payload: GetAuditTrailPayload) => {
	const { businessID } = payload;
	return useQuery({
		queryKey: ["getAuditTrail", payload],
		queryFn: async () => {
			const res = await getAuditTrail(payload);
			return res;
		},
		enabled: !!businessID && businessID !== VALUE_NOT_AVAILABLE,
	});
};

export const useUpdateCaseAuditTrailComment = () =>
	useMutation({
		mutationKey: ["update comment - updateCaseAuditTrail"],
		mutationFn: async (body: UpdateCaseAuditTrailCommentPayload) => {
			const res = await updateCaseAuditTrailComment(body);
			return res;
		},
	});
