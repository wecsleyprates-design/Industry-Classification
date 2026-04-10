import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { clearAllForLogout } from "@joinworth/worth-core-utils";
import error404 from "@/assets/png/error404.png";
import Button from "@/components/Button";
import { getItem } from "@/lib/localStorage";
import { useLogOutQuery } from "@/services/queries/auth.query";
import useAuthStore from "@/store/useAuthStore";
import { type TAllPermissions } from "@/types/common";

import { URL } from "@/constants/URL";
import { log } from "@/Logger";

const COOKIE_DOMAIN = "joinworth.com";

const NotFound: React.FC<{ handleReset?: () => void }> = ({ handleReset }) => {
	const { clearIsAuthenticated } = useAuthStore((state) => state);
	const { isAuthenticated } = useAuthStore((state) => state);
	const navigate = useNavigate();
	const {
		mutateAsync: logoutAsync,
		data: logoutData,
		error: logoutError,
	} = useLogOutQuery();

	useEffect(() => {
		log.warn("NotFound page displayed", {
			path: window.location.pathname,
			search: window.location.search,
		});
	}, []);

	useEffect(() => {
		if (logoutData?.status === "success") {
			clearIsAuthenticated();
		} else if (logoutData?.status === "error") {
			clearIsAuthenticated();
		}
	}, [logoutData]);

	useEffect(() => {
		if (logoutError) {
			clearIsAuthenticated();
		}
	}, [logoutError]);

	useEffect(() => {
		if (isAuthenticated) {
			const permission = getItem("permissions") as TAllPermissions;
			if (
				permission === undefined ||
				permission === null ||
				Object.keys(permission ?? {}).length === 0
			) {
				void logoutAsync();
				setTimeout(() => handleReset?.(), 1000);
			}
		} else {
			const url = window.location.pathname;

			setTimeout(() => handleReset?.(), 1000);
			if (url !== URL.LOGIN)
				navigate(`${URL.LOGIN}?redirectTo=${window.location.pathname}`);
		}
	}, [isAuthenticated]);

	return (
		<>
			{!isAuthenticated ? (
				<></>
			) : (
				<div className="flex flex-col justify-center">
					<img className="mt-5" src={error404} alt="" />
					<p className="text-[32px] text-center mt-5 font-bold">
						Oh No! we're in the wrong dimension!
					</p>
					<p className="text-[18px] text-center mt-2 font-normal">
						We searched everywhere but couldn’t find what you’re looking for.
						Let’s find a better place for you to go.
					</p>
					<div className="flex flex-col sm:flex-row gap-3 justify-center mt-5 sm:items-center">
						<Button
							className="w-full sm:w-[170px] h-9 bg-white border border-gray-300 text-gray-800 text-sm font-normal rounded-md px-4 py-2 hover:bg-gray-50 box-border"
							color="transparent"
							onClick={async () => {
								await clearAllForLogout(COOKIE_DOMAIN, console);
								clearIsAuthenticated();
								try {
									await logoutAsync();
								} catch (error) {
									console.error(error);
									// If it fails, we still want redirect to login.
									// keeping this catch block to avoid blocking the redirect to login.
								}
								window.location.href = URL.LOGIN;
							}}
						>
							Log Out & Try Again
						</Button>
						<Button
							className="w-full sm:w-[130px] h-9 bg-blue-500 text-white text-sm font-normal rounded-md px-4 py-2 hover:bg-blue-600 border-0 box-border"
							color="dark"
							onClick={() => {
								navigate(URL.ROOT);
								setTimeout(() => handleReset?.(), 1000);
							}}
						>
							Back to Home
						</Button>
					</div>
				</div>
			)}
		</>
	);
};

export default NotFound;
