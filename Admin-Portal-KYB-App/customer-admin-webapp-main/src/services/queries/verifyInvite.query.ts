import { useMutation } from "@tanstack/react-query";
import { verifyInviteEmail } from "../api/verifyInvite.service";

export const useVerifyInviteEmailQuery = () =>
	useMutation({
		mutationFn: async (token: string) => {
			const res = await verifyInviteEmail(token);
			return res;
		},
	});
