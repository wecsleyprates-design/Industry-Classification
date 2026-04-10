import { useEffect, useState } from "react";
import { getItem } from "@/lib/localStorage";

type AppVersion = {
	label: string;
	key: string;
};

const APPS: AppVersion[] = [
	{ label: "App Version", key: "app_version" },
	{ label: "Case Microsite Version", key: "case_app_version" },
	{ label: "User Microsite Version", key: "user_app_version" },
	{ label: "Customer Microsite Version", key: "customer_app_version" },
	{ label: "Dashboard Microsite Version", key: "dashboard_app_version" },
];

export const useAppVersions = () => {
	const [versions, setVersions] = useState<
		Array<{ label: string; version: string | null }>
	>([]);

	useEffect(() => {
		const data: Array<{ label: string; version: string | null }> = APPS.map(
			(app) => ({
				label: app.label,
				version: getItem(app.key) ?? null,
			}),
		);

		setVersions(data);
	}, []);

	return versions;
};
