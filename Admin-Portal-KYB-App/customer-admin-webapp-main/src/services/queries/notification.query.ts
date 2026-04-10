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
		mutationFn: async (paylaod: UpdateEmailConfigBody) => {
			const res = await updateEmailConfig(paylaod);
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

export const useGetAuditTrail = (payload: GetAuditTrailPayload) =>
	useQuery({
		queryKey: ["getAuditTrail", payload],
		queryFn: async () => {
			const res = await getAuditTrail(payload);
			return res;
		},
		enabled: false,
		retry: 0,
	});

export const useUpdateCaseAuditTrailComment = () =>
	useMutation({
		mutationFn: async (body: UpdateCaseAuditTrailCommentPayload) => {
			const res = await updateCaseAuditTrailComment(body);
			return res;
		},
	});
