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

const TabsUnderlineResponsive: React.FC<TabProps> = ({
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

	useEffect(() => {
		if (activeId !== activeTab) {
			setActiveTab(activeId);
		}
	}, [activeId, activeTab]);
	return (
		<div>
			<div className="sm:hidden">
				<label htmlFor="tabs" className="sr-only">
					Select a tab
				</label>
			</div>
			<div className="overflow-x-scroll text-sm border-b border-gray-200 scroll-component">
				<nav className="flex -mb-px space-x-8" aria-label="Tabs">
					{tabs.map((tab: any) => (
						<a
							onClick={() => {
								handleTabClick(tab.id);
								onTabChange(tab.id);
							}}
							key={tab.name}
							href={tab.href}
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
			</div>{" "}
			{/* <div className="mt-4">{currentTab?.content}</div> */}
		</div>
	);
};

export default TabsUnderlineResponsive;
