import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { datadogRum } from "@datadog/browser-rum";
import { defaultHomePage, getAllPermissions } from "@/lib/helper";
import { setItem } from "@/lib/localStorage";
import { exchangeSSOCode } from "@/services/api/auth.service";
import useAuthStore from "@/store/useAuthStore";
import { URL } from "../../constants/index";

import { MODULES } from "@/constants/Modules";

const SSOCallback = () => {
	const navigate = useNavigate();
	const [params] = useSearchParams();
	const { setIsAuthenticated } = useAuthStore((state) => state);

	useEffect(() => {
		void (async () => {
			try {
				const uuid = params.get("uuid");
				const redirect = params.get("redirect") ?? defaultHomePage();

				if (!uuid) {
					throw new Error("Missing uuid in callback URL");
				}

				const loginData = await exchangeSSOCode(uuid);

				const permissions = getAllPermissions(
					loginData.data.permissions,
					Object.values(MODULES),
				);
				setItem("permissions", permissions);
				setIsAuthenticated({
					access_token: loginData.data.access_token,
					id_token: loginData.data.id_token,
					user_details: loginData.data.user_details,
					refresh_token: loginData.data.refresh_token,
					customer_details: {
						id: loginData.data.customer_details?.id ?? "",
						name: loginData.data.customer_details?.name ?? "",
						customer_type: loginData.data.customer_details?.customer_type ?? "",
					},
					permissions,
					subrole: {
						code: loginData.data.subrole.code,
						id: loginData.data.subrole.id,
						label: loginData.data.subrole.label,
					},
					all_permissions: loginData.data.permissions.map(
						(item) => item.code as string,
					),
				});

				// Set user information in Datadog RUM session
				datadogRum.setUser({
					id: loginData.data.user_details.id,
					email: loginData.data.user_details.email,
				});

				requestAnimationFrame(() => {
					navigate(redirect);
				});
			} catch (error) {
				console.error("SSO callback error:", error);
				navigate(`${URL.AUTH_ERROR}?error=sso`);
			}
		})();
	}, [navigate, setIsAuthenticated, params]);

	return (
		<div className="flex items-center justify-center h-screen">
			<span className="text-sm text-gray-500">Authenticating…</span>
		</div>
	);
};

export default SSOCallback;
