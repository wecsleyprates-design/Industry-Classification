import { useState } from "react";
import classNames from "classnames";

export interface TabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	headerContent: React.ReactNode;
	tabs: any;
	activeId: number;
	onTabChange: (id: number) => void;
}

const TabsWithUI: React.FC<TabProps> = ({
	headerContent,
	tabs,
	activeId,
	onTabChange,
	...props
}) => {
	const [activeTab, setActiveTab] = useState<number>(activeId);
	const handleTabClick = (tabId: number) => {
		if (activeTab !== tabId) {
			setActiveTab(tabId);
			onTabChange(tabId);
		}
	};
	const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		const foundItem = tabs.find((tab: any) => tab.name === event.target.value);
		setActiveTab(foundItem.id);
		onTabChange(foundItem.id);
	};

	return (
		<div>
			<div className="sm:hidden p-3">
				<label htmlFor="tabs" className="sr-only">
					Select a tab
				</label>
				{/* Use an "onChange" listener to redirect the user to the selected tab URL. */}
				<select
					id="tabs"
					name="tabs"
					className="mb-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm appearance-none"
					onChange={handleSelectChange}
					defaultValue={activeTab}
				>
					{tabs.map((tab: any) => (
						<option key={tab.id}>{tab.name}</option>
					))}
				</select>
				<div className="">{headerContent}</div>
			</div>
			<div className="hidden sm:block">
				<div className="cursor-pointer px-4 py-3 sm:flex sm:items-center border-b border-gray-200">
					<div className="sm:flex-auto">
						<nav className="-mb-3 flex space-x-8" aria-label="Tabs">
							{tabs.map((tab: any) => (
								<a
									onClick={
										tab.id !== activeTab
											? () => {
													handleTabClick(tab.id);
												}
											: undefined
									}
									key={tab.name}
									className={classNames(
										tab.id === activeTab
											? `border-[#6B66C4] text-[#6B66C4] font-semibold`
											: "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
										"whitespace-nowrap border-b-2  py-3 px-1 text-base font-medium",
									)}
									aria-current={tab.id === activeTab ? "page" : undefined}
								>
									{tab.name}
								</a>
							))}
						</nav>
					</div>
					{headerContent}
				</div>
			</div>
			<div className="mt-4">
				{tabs.find((tab: any) => tab.id === activeTab)?.content}
			</div>
		</div>
	);
};

export default TabsWithUI;
