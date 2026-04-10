import { useMutation } from "@tanstack/react-query";
import { type ILoginResponse } from "@/types/auth";
import { postCustomerSignIn } from "../api/auth.service";

export const usePostCustomerSignIn = () =>
	useMutation<ILoginResponse, Error, { email: string; password: string }>({
		mutationKey: ["usePostCustomerSignIn"],
		mutationFn: async (body: { email: string; password: string }) => {
			const res = await postCustomerSignIn(body);
			return res;
		},
	});
