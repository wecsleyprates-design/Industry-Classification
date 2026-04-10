import { useEffect, useState } from "react";
import "./tabStyles.css";

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
	const [activeTab, setActiveTab] = useState<number>(tabs[0].id);

	useEffect(() => {
		if (activeId !== undefined) setActiveTab(activeId);
	}, [activeId]);

	const handleTabClick = (tabId: number) => {
		setActiveTab(tabId);
	};

	return (
		<div>
			<div className="sm:hidden">
				<label htmlFor="tabs" className="sr-only">
					Select a tab
				</label>
			</div>
			<div className="overflow-x-scroll text-sm border-b border-gray-200 scroll-component">
				<nav className="flex -mb-px space-x-8" aria-label="Tabs" role="tablist">
					{tabs.map((tab: any) => (
						<button
							type="button"
							onClick={() => {
								handleTabClick(tab.id);
								onTabChange?.(tab.id);
							}}
							key={tab.name}
							role="tab"
							aria-selected={tab.id === activeTab}
							className={classNames(
								tab.id === activeTab
									? "border-[#2563EB] border-b-[3px] text-[#2563EB] font-semibold"
									: "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
								"border-b-2 py-4 text-sm font-normal overflow-x cursor-pointer whitespace-nowrap bg-transparent",
							)}
						>
							{tab.name}
						</button>
					))}
				</nav>
			</div>
			<div className="mt-4">
				{tabs.find((tab: any) => tab.id === activeTab)?.content}
			</div>
		</div>
	);
};

export default TabsUnderlineResponsive;
