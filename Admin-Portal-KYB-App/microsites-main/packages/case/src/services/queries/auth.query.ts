import { useMutation } from "@tanstack/react-query";
import { loginAdmin, loginCustomerAdmin } from "../api/auth.service";

export const useLoginQuery = () =>
	useMutation({
		mutationFn: async (params: {
			email: string;
			password: string;
			isAdminLogin: boolean;
		}) => {
			const { email, password, isAdminLogin } = params;
			if (isAdminLogin) {
				return await loginAdmin({ email, password });
			} else {
				return await loginCustomerAdmin({ email, password });
			}
		},
	});
