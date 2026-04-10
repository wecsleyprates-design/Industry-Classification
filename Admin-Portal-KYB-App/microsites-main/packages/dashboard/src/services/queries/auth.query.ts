import { useMutation } from "@tanstack/react-query";
import { type ILoginResponse } from "@/lib/types/auth";
import { loginCustomerAdmin } from "../api/auth.service";

export const useLoginQuery = () =>
	useMutation<ILoginResponse, Error, { email: string; password: string }>({
		mutationKey: ["login"],
		mutationFn: async (body: { email: string; password: string }) => {
			const res = await loginCustomerAdmin(body);
			return res;
		},
	});
