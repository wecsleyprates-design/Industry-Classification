import React from "react";
import { useNavigate } from "react-router-dom";
import { DocumentTextIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { checkFeatureAccess } from "@/lib/helper";

import { URL } from "@/constants/URL";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";

type EmptyStateType = "user" | "role";

interface EmptyStateProps {
	type: EmptyStateType;
}

interface EmptyStateConfig {
	icon: React.ReactNode;
	heading: string;
	description: React.ReactNode;
	action?: React.ReactNode;
}

const EMPTY_STATE_CONFIGS: Record<EmptyStateType, EmptyStateConfig> = {
	role: {
		icon: <UserGroupIcon className="text-blue-600 w-9 h-9" />,
		heading: "No Roles Found",
		description: (
			<>
				Please try refining your search. If you are unable to find the role
				after several attempts, it may not exist. You can create a new role,
				with applicable permissions, by clicking the button below.
			</>
		),
		action: null,
	},
	user: {
		icon: <DocumentTextIcon className="text-blue-600 w-9 h-9" />,
		heading: "No Users Available",
		description: "There are currently no users to display.",
		action: null,
	},
};

export const EmptyState: React.FC<EmptyStateProps> = ({
	type,
}: EmptyStateProps) => {
	const navigate = useNavigate();
	const config = EMPTY_STATE_CONFIGS[type];

	const handleCreateRole = () => {
		navigate(URL.ROLES_CREATE);
	};

	const getActionButton = () => {
		if (type === "role") {
			return (
				<>
					{checkFeatureAccess("roles:create") ? (
						<Button className="mt-6" onClick={handleCreateRole}>
							Create Role
						</Button>
					) : null}
				</>
			);
		}
		return null;
	};

	return (
		<Card className="p-4 sm:p-8 space-y-6 h-auto min-h-[300px] sm:h-[416px] flex justify-center border-0 pt-0">
			<div className="flex flex-col items-center justify-center max-w-md mx-auto text-center">
				{/* Icon Container */}
				<div className="relative w-16 h-16 mb-4 sm:w-20 sm:h-20 sm:mb-6">
					<div className="absolute inset-0 bg-white border border-gray-200 rounded-lg shadow-sm" />
					<div className="absolute inset-0 flex items-center justify-center">
						{config.icon}
					</div>
				</div>
				{/* Content */}
				<h3 className="mb-2 text-lg font-medium text-gray-900 sm:text-xl">
					{config.heading}
				</h3>
				<p className="px-4 text-sm leading-relaxed text-gray-500 sm:text-base sm:px-0">
					{config.description}
				</p>
				{getActionButton()}
			</div>
		</Card>
	);
};
