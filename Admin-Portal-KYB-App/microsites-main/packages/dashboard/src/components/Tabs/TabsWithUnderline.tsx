import { useState } from "react";
import classNames from "classnames";
import "./tabStyle.css";

export interface TabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	tabs: Tab[];
	activeId: number;
	onTabChange: (id: number) => void;
}

type Tab = {
	id: number;
	name: string;
	content: React.ReactNode;
	href?: string;
};

const TabComponent: React.FC<TabProps> = ({
	tabs,
	activeId,
	onTabChange,
	...props
}) => {
	const [activeTab, setActiveTab] = useState<number>(tabs[0].id);
	const handleTabClick = (tabId: number) => {
		setActiveTab(tabId);
		onTabChange(tabId);
	};
	const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		const foundItem = tabs.find((tab: any) => tab.name === event.target.value);
		setActiveTab(foundItem?.id ?? 0);
	};

	return (
		<div>
			<div className="sm:hidden lg:hidden md:hidden xl:hidden">
				<label htmlFor="tabs" className="sr-only">
					Select a tab
				</label>
				<select
					id="tabs"
					name="tabs"
					className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
					onChange={handleSelectChange}
					defaultValue={activeTab}
				>
					{tabs.map((tab: any) => (
						<option key={tab.id}>{tab.name}</option>
					))}
				</select>
			</div>
			<div className="hidden sm:block lg:block md:block xl:block overflow-x-scroll scroll-component">
				<div className="border-b border-gray-200">
					<nav className="-mb-px flex space-x-8" aria-label="Tabs">
						{tabs.map((tab: Tab) => (
							<a
								onClick={() => {
									handleTabClick(tab.id);
								}}
								key={tab.name}
								href={tab.href}
								className={classNames(
									tab.id === activeTab
										? "border-indigo-500 text-indigo-600"
										: "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
									"border-b-2 py-4 text-sm font-medium overflow-x cursor-pointer whitespace-nowrap",
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
