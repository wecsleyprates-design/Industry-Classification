import { useMutation, useQuery } from "@tanstack/react-query";
import useAuthStore from "@/store/useAuthStore";
import {
	type CustomerLogin,
	type ForgotPasswordBody,
	type GetInvite,
	type ResendInvite,
	type ResetPasswordRequest,
	type UpdatePasswordRequest,
} from "@/types/auth";
import {
	acceptInvite,
	forgotPassword,
	getCustomerAccess,
	getInvite,
	loginCustomerAdmin,
	logOutCustomerAdmin,
	requestInvite,
	resendInvite,
	resetPassword,
	samlLogin,
	updatePassword,
	userCustomers,
	verifyResetToken,
} from "../api/auth.service";

export const useLoginQuery = () =>
	useMutation({
		mutationFn: async (body: CustomerLogin) => {
			const res = await loginCustomerAdmin(body);
			return res;
		},
	});

export const useForgotPasswordQuery = () =>
	useMutation({
		mutationFn: async (body: ForgotPasswordBody) => {
			const res = await forgotPassword(body);
			return res;
		},
	});

export const useUpdatePasswordQuery = () =>
	useMutation({
		mutationFn: async (body: UpdatePasswordRequest) => {
			const res = await updatePassword(body);
			return res;
		},
	});

export const useResetPasswordQuery = () =>
	useMutation({
		mutationFn: async (body: ResetPasswordRequest) => {
			const res = await resetPassword(body);
			return res;
		},
	});

export const useVerifyResetTokenQuery = (resetToken: any) =>
	useQuery({
		queryKey: ["verifyToken"],
		queryFn: async () => {
			const res = await verifyResetToken(resetToken);
			return res;
		},
		enabled: !!resetToken,
		retry: 0,
	});

export const useLogOutQuery = () =>
	useMutation({
		mutationFn: async () => {
			const res = await logOutCustomerAdmin();
			return res;
		},
	});

export const useAcceptInviteQuery = () =>
	useMutation({
		mutationFn: async (body: any) => {
			const res = await acceptInvite(body);
			return res;
		},
	});

export const useGetInviteQuery = () =>
	useMutation({
		mutationFn: async (body: GetInvite) => {
			const res = await getInvite(body);
			return res;
		},
	});

export const useResendInviteQuery = () =>
	useMutation({
		mutationFn: async (body: ResendInvite) => {
			const res = await resendInvite(body);
			return res;
		},
	});

export const useRequestInviteQuery = () =>
	useMutation({
		mutationFn: async (payload: {
			inviteToken: string;
			userType: "admin" | "users";
		}) => {
			const res = await requestInvite(payload);
			return res;
		},
	});
export const useSamlLoginQuery = () =>
	useMutation({
		mutationFn: async (email: string) => {
			const res = await samlLogin(email);
			return res;
		},
	});

export const useUserCustomers = (userId: string | undefined) => {
	const { isAuthenticated } = useAuthStore((state) => state);

	return useQuery({
		queryKey: ["userCustomers", userId],
		queryFn: async () => await userCustomers({ user_id: userId }),
		retry: 0,
		enabled: isAuthenticated && !!userId,
	});
};

export const useGetUserCustomers = () => {
	return useMutation({
		mutationFn: async (userId: string) => {
			const res = await userCustomers({ user_id: userId });
			return res;
		},
	});
};

export const useCustomerAccessQuery = () =>
	useMutation({
		mutationFn: async (payload: { customer_id: string }) => {
			const res = await getCustomerAccess(payload);
			return res;
		},
	});
