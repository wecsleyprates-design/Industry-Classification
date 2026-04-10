import React from "react";
import { ChevronDownIcon, UserIcon } from "@heroicons/react/24/outline";
import { getInitials } from "@/lib/utils";

import { Avatar } from "@/ui/avatar";
import { Skeleton } from "@/ui/skeleton";

export interface Person {
	id?: string | null;
	name: string;
	email?: string;
	role: string;
}

export interface KeyPeopleProps {
	applicant: Person;
	caseId: string;
}

export const PersonItem: React.FC<{
	person: Person;
	role: string;
	showChevron?: boolean;
}> = ({ person, role, showChevron = false }) => (
	<div className="flex items-center w-full p-2 -ml-2">
		<div className="flex items-center flex-1 min-w-0 space-x-3">
			{person.name === "Unassigned" ? (
				<div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-full">
					<UserIcon className="w-6 h-6 text-gray-400" />
				</div>
			) : (
				<div className="min-w-6">
					<Avatar
						initials={getInitials(person.name)}
						size="md"
						backgroundColor={
							role === "Applicant"
								? "bg-green-600"
								: "bg-blue-600"
						}
						textColor={"text-white"}
					/>
				</div>
			)}

			<div className="flex-1 min-w-0">
				{person.name !== "" ? (
					<h3 className="text-sm font-medium text-left text-gray-900 truncate">
						{person.name}
					</h3>
				) : (
					<Skeleton className="w-24 h-4" />
				)}
			</div>
		</div>
		{showChevron && (
			<ChevronDownIcon className="flex-shrink-0 w-3 h-3 ml-4 text-gray-500" />
		)}
	</div>
);
