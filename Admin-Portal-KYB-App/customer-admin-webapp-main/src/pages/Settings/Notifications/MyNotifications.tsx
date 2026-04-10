import React, { useEffect, useState } from "react";
import { DocumentPlusIcon } from "@heroicons/react/24/outline";
import Card from "@/components/Card";
import Toggle from "@/components/Input/Toggle";
import TableLoader from "@/components/Spinner/TableLoader";
import { type GetEmailConfig } from "@/types/notifications";

interface Module {
	icon: React.JSX.Element;
	title: string;
	description: string;
	key: string;
	isChecked: boolean;
}

interface ApplicationNotificationsProps {
	emailConfigData?: GetEmailConfig;
	loading: boolean;
	toggleChecked: (index: number, modules: Module[]) => Promise<Module[]>;
}

const MyNotifications: React.FC<ApplicationNotificationsProps> = ({
	loading,
	toggleChecked,
	emailConfigData,
}) => {
	const [modules, setModules] = useState([
		{
			icon: (
				<div className="flex items-center content-center justify-center w-12 h-12 align-middle rounded-lg bg-blue-50">
					<DocumentPlusIcon className="w-6 h-6 text-[#2563EB]" />
				</div>
			),
			title: "New Case Assignments",
			description: "Receive emails when I’m assigned a new case.",
			key: "case_assignment",
			isChecked: false,
		},
	]);

	useEffect(() => {
		if (emailConfigData) {
			const newModules = modules.map((module) => {
				const respModule = emailConfigData.data.find(
					(item) => item.code === module.key,
				);
				if (!respModule && module.key === "case_assignment") {
					return {
						...module,
						isChecked: true,
					};
				}
				return { ...module, isChecked: respModule?.is_enabled ?? false };
			});
			setModules(newModules);
		}
	}, [emailConfigData]);
	return (
		<div>
			{loading ? (
				<TableLoader />
			) : (
				<>
					<Card
						className="px-6 shadow-none rounded-xl"
						headerClassName="sm:px-0 py-4"
						contentClassName="sm:px-0 py-2"
						headerComponent={
							<>
								<h2 className="text-[#1F2937] font-semibold">
									My Notifications
								</h2>
								<p className="text-[#6B7280] font-normal text-sm">
									Customize and define when I receive notifications.
								</p>
							</>
						}
						contentComponent={
							<>
								{modules.map((item, index) => {
									return (
										<div key={item.key} className="flex justify-between">
											<div className="flex">
												<div>{item.icon}</div>
												<div className="pl-2">
													<h2 className="text-base text-[#1F2937] font-semibold mb-1">
														{item.title}
													</h2>
													<p className="text-[#6B7280] text-sm">
														{item.description}
													</p>
												</div>
											</div>
											<div className="mt-5">
												<Toggle
													value={item.isChecked}
													onChange={async () => {
														const updatedModules = await toggleChecked(
															index,
															modules,
														);
														setModules(updatedModules);
													}}
												/>
											</div>
										</div>
									);
								})}
							</>
						}
					/>
				</>
			)}
		</div>
	);
};

export default MyNotifications;
