import { useEffect, useState } from "react";
import "./tabStyle.css";

export interface TabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	tabs: any;
	activeId?: number;
	onTabChange: (id: number) => void;
	hideSingleTab?: boolean;
}

function classNames(...classes: string[]) {
	return classes.filter(Boolean).join(" ");
}

const TabsWithButton: React.FC<TabProps> = ({
	tabs,
	activeId,
	onTabChange,
	hideSingleTab = false,
	...props
}) => {
	const [activeTab, setActiveTab] = useState<number>(tabs[0]?.id);
	const handleTabClick = (tabId: number) => {
		setActiveTab(tabId);
		onTabChange(tabId);
	};
	useEffect(() => {
		if (activeId !== undefined) setActiveTab(activeId);
	}, [activeId]);

	return (
		<div>
			<div className="sm:hidden">
				<label htmlFor="tabs" className="sr-only">
					Select a tab
				</label>
			</div>
			{hideSingleTab && tabs.length === 1 ? null : (
				<div className="overflow-x-scroll text-sm scroll-component">
					<nav
						className="flex flex-col mb-1 space-x-0 space-y-3 sm:space-y-0 sm:flex-row sm:space-x-5"
						aria-label="Tabs"
					>
						{tabs.map((tab: any) => (
							<a
								onClick={() => {
									handleTabClick(tab.id);
								}}
								key={tab.name}
								href={tab.href}
								className={classNames(
									tab.id === activeTab
										? " border-transparent text-blue-600 bg-blue-50 font-semibold "
										: " border-gray-200  text-gray-500 hover:border-gray-300 hover:text-gray-700",
									" py-2.5 px-4 text-sm font-normal rounded-lg overflow-x cursor-pointer whitespace-nowrap border",
								)}
								aria-current={tab.id === activeTab ? "page" : undefined}
							>
								{tab.name}
							</a>
						))}
					</nav>
				</div>
			)}
			<div className="mt-4">
				{tabs.find((tab: any) => tab.id === activeTab)?.content}
			</div>
		</div>
	);
};

export default TabsWithButton;
