import { useEffect, useState } from "react";

export interface TabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	headerContent: React.ReactNode;
	tabs: any;
	activeId: number;
	onTabChange: (id: number) => void;
	fullWidth?: boolean;
}

function classNames(...classes: string[]) {
	return classes.filter(Boolean).join(" ");
}

const TabsWithUI: React.FC<TabProps> = ({
	headerContent,
	tabs,
	activeId,
	onTabChange,
	fullWidth = false,
	...props
}) => {
	const [activeTab, setActiveTab] = useState<number>(activeId);
	const handleTabClick = (tabId: number) => {
		if (activeTab !== tabId) {
			setActiveTab(tabId);
			onTabChange(tabId);
		}
	};
	// const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
	// 	const foundItem = tabs.find((tab: any) => tab.name === event.target.value);

	// 	setActiveTab(foundItem.id);

	// 	onTabChange(foundItem.id);
	// };

	useEffect(() => {
		if (activeId !== activeTab) {
			setActiveTab(activeId);
		}
	}, [activeId, activeTab]);

	return (
		<div>
			{/* <div className="p-3 sm:hidden">
				<label htmlFor="tabs" className="sr-only">
					Select a tab
				</label> */}
			{/* Use an "onChange" listener to redirect the user to the selected tab URL. */}
			{/* <select
					id="tabs"
					name="tabs"
					className="block w-full py-2 pl-3 pr-10 mb-1 text-base border-gray-300 rounded-md appearance-none focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
					onChange={handleSelectChange}
					defaultValue={activeTab}
				>
					{tabs.map((tab: any) => (
						<option key={tab.id}>{tab.name}</option>
					))}
				</select>
				<div className="">{headerContent}</div>
			</div> */}
			<div
				className={classNames(
					"overflow-x-scroll text-sm bg-white border-b border-gray-200 scroll-component",
					fullWidth ? "-mx-8 px-8 max-w-none" : "w-full",
				)}
			>
				{" "}
				<div className="pb-3 border-b border-gray-200 cursor-pointer sm:flex sm:items-center">
					<div className="sm:flex-auto">
						<nav className="flex -mb-3 space-x-8" aria-label="Tabs">
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
											? "border-[#2563EB] border-b-[3px]  text-[#2563EB] font-semibold "
											: "border-transparent text-gray-800 hover:border-gray-300 hover:text-gray-700",
										"border-b-2 py-4 text-sm font-normal overflow-x cursor-pointer whitespace-nowrap",
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
