import React, { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { Link } from "react-router-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";
import {
	CaseIcon,
	ReportIcon,
	RiskMonitoringIcon,
	SettingsIcon,
	UsersIcon,
} from "assets/svg/SidebarIcons";
import { useFlags } from "launchdarkly-react-client-sdk";
import WorthIconHeader from "@/assets/svg/BrandIcons/WorthIconHeader";
import DashboardIcon from "@/assets/svg/DashboardIcon";
import LeftUTurnIcon from "@/assets/svg/SidebarIcons/LeftUTurnIcon";
import StandaloneIcon from "@/assets/svg/SidebarIcons/StandaloneIcon";
import WebhooksIcon from "@/assets/svg/SidebarIcons/WebhooksIcon";
import { cn } from "@/lib/utils";
import useAuthStore from "@/store/useAuthStore";
import useGlobalStore from "@/store/useGlobalStore";
import useSidebarStore from "@/store/useSidebarStore";
import { URL } from "../../constants/index";

import FEATURE_FLAGES from "@/constants/FeatureFlags";
import { MODULES } from "@/constants/Modules";

interface IconProps {
	style?: {
		height?: number;
		width?: number;
	};
	fill?: string;
}

type navItem = {
	name: string;
	href: string;
	icon: React.FC<IconProps> | React.FC<{ className?: string }>;
	current: boolean;
	isAccessible: boolean;
};

interface Props {
	navItems: navItem[];
	className?: string;
}

const SidebarNavItems: React.FC<Props> = ({ navItems, className }) => {
	const setSidebarOpen = useSidebarStore((state) => state.setSidebarOpen);
	const resetSavedPayload = useGlobalStore((store) => store.resetSavedPayload);
	return (
		<nav className="flex flex-col flex-1">
			<ul role="list" className="flex flex-col flex-1 gap-y-7">
				<li>
					<ul role="list" className="-mx-2 space-y-1">
						{navItems.map((item) => {
							return (
								item.isAccessible && (
									<li key={item.name}>
										<Link
											to={item.href}
											onClick={() => {
												setSidebarOpen(false);
												resetSavedPayload();
											}}
											className={cn(
												item.current
													? "bg-[#1E3A8A] text-white"
													: "text-gray-400 hover:text-white hover:bg-[#1E3A8A]",
												"group flex items-center gap-x-3 rounded-md p-3 text-sm font-medium",
												className,
											)}
										>
											<item.icon className="w-5 h-5 hover:text-white" />
											{item.name}
										</Link>
									</li>
								)
							);
						})}
					</ul>
				</li>
			</ul>
		</nav>
	);
};

const SidebarLogo = () => {
	return (
		<div className="flex items-center h-16 shrink-0">
			<WorthIconHeader />
		</div>
	);
};
interface SideBarProps {
	flag?: boolean;
}
const Sidebar: React.FC<SideBarProps> = ({ flag = false }) => {
	const location = useLocation();
	const permissions = useAuthStore((state) => state.permissions);
	const sidebarOpen = useSidebarStore((state) => state.sidebarOpen);
	const setSidebarOpen = useSidebarStore((state) => state.setSidebarOpen);
	const [sidebarNavItems, setSidebarNavItems] = useState<navItem[]>([]);
	const flags = useFlags();
	useEffect(() => {
		let newItems: navItem[] = [];
		if (!flag) {
			newItems = [
				{
					name: "Dashboard",
					href: URL.DASHBOARD,
					icon: DashboardIcon,
					current: false,
					isAccessible: !!permissions[MODULES.CRO]?.read,
				},
				{
					name: "Cases",
					href: URL.CASE,
					icon: CaseIcon,
					current: false, // Assuming you will manage `current` state elsewhere
					isAccessible: !!permissions[MODULES.CASES]?.read,
				},
				flags[FEATURE_FLAGES.DOS_277_MICROSITES_SETUP]
					? {
							name: "Cases New",
							href: URL.CASE_NEW,
							icon: CaseIcon,
							current: false, // Assuming you will manage `current` state elsewhere
							isAccessible: !!permissions[MODULES.CASES]?.read,
						}
					: null,
				{
					name: "Archived",
					href: URL.ARCHIVED,
					icon: UsersIcon,
					current: false,
					isAccessible: !!permissions[MODULES.ARCHIVED]?.read,
				},
				{
					name: "Businesses",
					href: URL.BUSINESSES,
					icon: StandaloneIcon,
					current: false,
					isAccessible: !!permissions[MODULES.BUSINESS]?.read,
				},
				...(permissions[MODULES.CUSTOMER_USER]?.read ||
				permissions[MODULES.ROLES]?.read
					? [
							{
								name: "Team",
								href: permissions[MODULES.CUSTOMER_USER]?.read
									? URL.USERS
									: URL.ROLES,
								icon: UsersIcon,
								current: false,
								isAccessible: true,
							},
						]
					: []),
				{
					name: "Risk Monitoring",
					href: URL.RISK_MONITORING,
					icon: RiskMonitoringIcon,
					current: false,
					isAccessible: !!permissions[MODULES.RISK_MONITORING_MODULE]?.read,
				},
				{
					name: "Report",
					href: URL.REPORT,
					icon: ReportIcon,
					current: false,
					isAccessible: !!permissions[MODULES.REPORT]?.read,
				},
				{
					name: "Settings",
					href: URL.SETTINGS,
					icon: SettingsIcon,
					current: false,
					isAccessible: !!permissions[MODULES.SETTINGS]?.read,
				},
			].filter((item) => item !== null);
		} else {
			newItems = [
				{
					name: "Webhooks",
					href: URL.MANAGE_ENDPOINTS,
					icon: WebhooksIcon,
					current: false,
					isAccessible: !!permissions[MODULES.SETTINGS]?.read,
				},
			];
		}

		const pathname = location.pathname;
		const url = pathname.split("/")?.[1];
		const activeTabURL = url ? `/${url}` : URL.ROOT;

		const updatedNavItems = newItems.map((item) => ({
			...item,
			current: item.href.includes(activeTabURL),
		}));

		setSidebarNavItems(updatedNavItems);
	}, [flag, location.pathname, flags[FEATURE_FLAGES.DOS_277_MICROSITES_SETUP]]);

	const settingsItem = sidebarNavItems.find((item) => item.name === "Settings");
	const mainNavItems = sidebarNavItems.filter(
		(item) => item.name !== "Settings",
	);

	return (
		<React.Fragment>
			{/* Overlay for mobile when sidebar is open */}
			{sidebarOpen && (
				<div
					className="fixed inset-0 z-[60] bg-gray-900/80 lg:hidden"
					onClick={() => {
						setSidebarOpen(false);
					}}
				/>
			)}

			{/* Single responsive sidebar */}
			<aside
				className={cn(
					"fixed inset-y-0 left-0 z-[60] w-72 bg-dark-blue flex flex-col transition-transform duration-300",
					sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
				)}
			>
				{/* Close button (mobile only) */}
				<button
					type="button"
					className="absolute text-gray-400 top-4 right-4 hover:text-white lg:hidden"
					onClick={() => {
						setSidebarOpen(false);
					}}
				>
					<span className="sr-only">Close sidebar</span>
					<XMarkIcon className="w-6 h-6" aria-hidden="true" />
				</button>
				<div className="flex flex-col justify-between h-full px-6 pb-4 overflow-y-auto grow gap-y-5">
					<div className="flex flex-col gap-y-5">
						<SidebarLogo />
						<SidebarNavItems navItems={mainNavItems} />
					</div>
					<div className="flex flex-col gap-y-5">
						{flag && (
							<div className="flex flex-col lg:mx-3 lg:my-1 gap-y-5">
								<SidebarNavItems
									navItems={[
										{
											name: "Back to Dashboard",
											href: URL.DASHBOARD,
											icon: LeftUTurnIcon,
											current: false,
											isAccessible: !!permissions[MODULES.SETTINGS]?.read,
										},
									]}
									className="text-white ring-1 ring-white lg:pl-4"
								/>
							</div>
						)}
						{settingsItem && <SidebarNavItems navItems={[settingsItem]} />}
					</div>
				</div>
			</aside>
		</React.Fragment>
	);
};

export default Sidebar;
