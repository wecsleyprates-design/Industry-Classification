import React, { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router";
import { Userpilot } from "userpilot";
import { getItem, removeItem } from "@/lib/localStorage";

import { LOCALSTORAGE } from "@/constants/LocalStorage";

const UserpilotWrapper = () => {
	const location = useLocation();
	const isFirstRender = useRef(true);

	useEffect(() => {
		Userpilot.reload();
		// Skip the first render to avoid reload on initial page load
		if (isFirstRender.current) {
			isFirstRender.current = false;
			return;
		}
		const isReloadable: boolean =
			getItem<boolean>(LOCALSTORAGE.isReloadable) ?? false;

		if (isReloadable) {
			removeItem(LOCALSTORAGE.isReloadable);
			window.location.replace(window.location.href); // hard reload
		}
	}, [location.pathname]);

	return <Outlet />;
};

export default UserpilotWrapper;
