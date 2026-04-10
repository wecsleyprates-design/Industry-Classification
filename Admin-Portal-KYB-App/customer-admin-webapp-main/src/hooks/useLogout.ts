import { useEffect } from "react";
import { useNavigate } from "react-router";
import { clearProactiveRefresh } from "@/lib/api";
import { useLogOutQuery } from "@/services/queries/auth.query";
import useAuthStore from "@/store/useAuthStore";
import { URL } from "../constants";
import useCustomToast from "./useCustomToast";

const useLogout = () => {
	const navigate = useNavigate();
	const { successHandler, errorHandler } = useCustomToast();
	const { clearIsAuthenticated } = useAuthStore((state) => state);
	const {
		mutateAsync: logoutAsync,
		data: logoutData,
		error: logoutError,
		isPending: isLoading,
	} = useLogOutQuery();

	useEffect(() => {
		if (logoutData) {
			if (logoutData?.status === "success") {
				successHandler({
					message: logoutData?.message,
				});
				clearProactiveRefresh();
				clearIsAuthenticated();
				navigate(URL.LOGIN, { replace: true });
			} else if (
				logoutData?.status === "error" ||
				logoutData?.status === "fail"
			) {
				clearProactiveRefresh();
				clearIsAuthenticated();
				navigate(URL.LOGIN, { replace: true });
			}
		}
	}, [logoutData]);

	useEffect(() => {
		if (logoutError) {
			clearProactiveRefresh();
			clearIsAuthenticated();
			errorHandler(logoutError);
			navigate(URL.LOGIN);
		}
	}, [logoutError]);

	return { isLoading, logoutAsync };
};

export default useLogout;
