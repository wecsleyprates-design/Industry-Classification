import { useMutation, useQuery } from "@tanstack/react-query";
import {
	type GetEmailConfig,
	type UpdateEmailConfigBody,
} from "@/types/notifications";
import { getEmailConfig, updateEmailConfig } from "../api/notification.service";

export const useGetEmailConfig = (customerId: string) =>
	useQuery<GetEmailConfig>({
		queryKey: ["getEmailConfig", customerId],
		queryFn: async () => {
			const res = await getEmailConfig(customerId);
			return res;
		},
		enabled: !!customerId,
	});

export const useUpdateEmailConfig = () =>
	useMutation<unknown, Error, UpdateEmailConfigBody>({
		mutationKey: ["updateEmailConfig"],
		mutationFn: async (payload: UpdateEmailConfigBody) => {
			const res = await updateEmailConfig(payload);
			return res;
		},
	});
