import { useEffect, useState } from "react";
import "./tabStyle.css";

export interface TabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	tabs: any;
	activeId: number;
	onTabChange: (id: number) => void;
}

function classNames(...classes: string[]) {
	return classes.filter(Boolean).join(" ");
}

const TabComponent: React.FC<TabProps> = ({
	tabs,
	activeId,
	onTabChange,
	...props
}) => {
	const [activeTab, setActiveTab] = useState<number>(activeId ?? tabs?.[0]?.id);

	// Sync from parent when controlled (activeId provided)
	useEffect(() => {
		if (activeId != null) {
			setActiveTab(activeId);
		}
	}, [activeId]);

	useEffect(() => {
		if (tabs?.length && activeTab == null) {
			setActiveTab(activeId ?? tabs[0]?.id);
		}
	}, [tabs, activeId, activeTab]);

	const handleTabClick = (tabId: number) => {
		setActiveTab(tabId);
		onTabChange(tabId);
	};

	const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		const foundItem = tabs.find((tab: any) => tab.name === event.target.value);
		if (foundItem) {
			handleTabClick(foundItem.id);
		}
	};

	return (
		<div>
			<div className="sm:hidden">
				<label htmlFor="tabs" className="sr-only">
					Select a tab
				</label>
				<select
					id="tabs"
					name="tabs"
					className="block w-full py-2 pl-3 pr-10 text-base border-gray-300 rounded-md focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
					onChange={handleSelectChange}
					defaultValue={activeTab}
				>
					{tabs.map((tab: any) => (
						<option key={tab.id}>{tab.name}</option>
					))}
				</select>
			</div>
			<div className="hidden sm:block">
				<div className="overflow-x-scroll text-sm border-b border-gray-200 scroll-component">
					<nav className="flex -mb-px space-x-8" aria-label="Tabs">
						{tabs.map((tab: any) => (
							<a
								href={tab.href ?? "#"}
								onClick={(e) => {
									e.preventDefault();
									handleTabClick(tab.id);
								}}
								key={tab.name}
								className={classNames(
									tab.id === activeTab
										? "border-[#2563EB] border-b-[3px]  text-[#2563EB] font-semibold "
										: "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
									"border-b-2 py-4 text-sm font-normal overflow-x cursor-pointer whitespace-nowrap",
								)}
								aria-current={tab.id === activeTab ? "page" : undefined}
							>
								{tab.name}
							</a>
						))}
					</nav>
				</div>
			</div>
			<div className="mt-4">
				{tabs.find((tab: any) => tab.id === activeTab)?.content}
			</div>
		</div>
	);
};

export default TabComponent;
