import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { UserWrapper } from "@/layouts/UserWrapper";
import { isAdminSubdomain } from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import { cn } from "@/lib/utils";
import { type AllPermissions } from "@/types/common";
import CustomerUserTable from "./CustomerUserTable";
import RoleTable from "./RolesTable";

import { URL } from "@/constants";
import { MODULES } from "@/constants/Modules";
import { ToastProvider } from "@/providers/ToastProvider";

type TabConfig = {
	key: string;
	label: string;
	component: React.ComponentType<any>;
	path: string;
	props?: Record<string, any>;
	hidden?: boolean;
};

const TABS_CONFIG: Record<string, TabConfig> = {
	users: {
		key: "users",
		label: "Users",
		component: CustomerUserTable,
		path: URL.USERS,
	},
	roles: {
		key: "roles",
		label: "Roles",
		component: RoleTable,
		path: URL.ROLES,
	},
};

const getInitialTab = (pathname: string): string => {
	if (pathname.toLowerCase().includes("roles")) return "roles";
	if (pathname.toLowerCase().includes("users")) return "users";
	return "users";
};

export default function TeamsTab() {
	const location = useLocation();
	const navigate = useNavigate();
	const [activeTab, setActiveTab] = useState<string>(() =>
		getInitialTab(location.pathname),
	);

	// Read permissions from localStorage synchronously for initial render
	const [permissions, setPermissions] = useState<Partial<AllPermissions>>(
		() => getItem<Partial<AllPermissions>>("permissions") ?? {},
	);

	// Read customerId from localStorage and poll if not available
	const [customerId, setCustomerId] = useState<string>(
		() => getItem<string>("customerId") ?? "",
	);

	useEffect(() => {
		// Check if permissions are available in localStorage
		const storedPermissions =
			getItem<Partial<AllPermissions>>("permissions") ?? {};
		const storedCustomerId = getItem<string>("customerId") ?? "";

		const hasStoredPermissions = Object.keys(storedPermissions).length > 0;
		const hasStoredCustomerId = storedCustomerId.length > 0;

		// Update permissions if different
		if (
			hasStoredPermissions &&
			JSON.stringify(storedPermissions) !== JSON.stringify(permissions)
		) {
			setPermissions(storedPermissions);
		}

		// Update customerId if different
		if (hasStoredCustomerId && storedCustomerId !== customerId) {
			setCustomerId(storedCustomerId);
		}

		// If both are available, no need to poll
		if (hasStoredPermissions && hasStoredCustomerId) {
			return;
		}

		// Poll for missing values (handles race condition on first load after login)
		const pollInterval = setInterval(() => {
			const polledPermissions =
				getItem<Partial<AllPermissions>>("permissions") ?? {};
			const polledCustomerId = getItem<string>("customerId") ?? "";

			const hasPolledPermissions = Object.keys(polledPermissions).length > 0;
			const hasPolledCustomerId = polledCustomerId.length > 0;

			if (hasPolledPermissions && !hasStoredPermissions) {
				setPermissions(polledPermissions);
			}
			if (hasPolledCustomerId && !hasStoredCustomerId) {
				setCustomerId(polledCustomerId);
			}

			// Stop polling once both are available
			if (hasPolledPermissions && hasPolledCustomerId) {
				clearInterval(pollInterval);
			}
		}, 100);

		// Cleanup interval on unmount
		return () => {
			clearInterval(pollInterval);
		};
	}, [permissions, customerId]);

	useEffect(() => {
		const newTab = getInitialTab(location.pathname);
		if (newTab !== activeTab) {
			setActiveTab(newTab);
		}
	}, [location.pathname, activeTab]);

	const availableTabs = useMemo(() => {
		if (isAdminSubdomain(window.location.href)) {
			return Object.values(TABS_CONFIG).filter((tab) => !tab.hidden);
		}

		// If permissions is empty object, show all tabs (permissions not yet loaded)
		const hasPermissions = Object.keys(permissions).length > 0;
		if (!hasPermissions) {
			return Object.values(TABS_CONFIG).filter((tab) => !tab.hidden);
		}

		return Object.values(TABS_CONFIG).filter(
			(tab) =>
				!tab.hidden &&
				!(tab.key === "users" && !permissions?.[MODULES.CUSTOMER_USER]?.read) &&
				!(tab.key === "roles" && !permissions?.[MODULES.ROLES]?.read),
		);
	}, [permissions]);

	const ActiveComponent = TABS_CONFIG[activeTab]?.component;

	const handleTabChange = (tabKey: string) => {
		setActiveTab(tabKey);
		navigate(TABS_CONFIG[tabKey].path);
	};

	return (
		<UserWrapper>
			<ToastProvider />
			<header className="px-6 py-4">
				<h1 className="text-xl font-semibold text-gray-800">Team</h1>
			</header>

			<div className="relative flex gap-4 px-6 border-b">
				{availableTabs.map((tab) => (
					<button
						key={tab.key}
						className={cn(
							`
							pb-2
							text-[14px] leading-[20px] font-medium font-inter
							relative 
							`,
							activeTab === tab.key && "text-blue-600",
						)}
						onClick={() => {
							handleTabChange(tab.key);
						}}
					>
						{tab.label}

						{/* Active tab indicator */}
						{activeTab === tab.key && (
							<span
								className="absolute"
								style={{
									width: "37px",
									height: "2px",
									borderRadius: "100px",
									backgroundColor: "#266EF1",
									bottom: "-2px",
									left: "50%",
									transform: "translateX(-50%)",
								}}
							/>
						)}
					</button>
				))}
			</div>

			{/* Content */}
			<div className="p-6 bg-[#F3F4F6] min-h-[calc(100vh-100px)]">
				{ActiveComponent && (
					<ActiveComponent
						customerId={customerId}
						{...(TABS_CONFIG[activeTab].props ?? {})}
					/>
				)}
			</div>
		</UserWrapper>
	);
}
