import React, { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { getInitials } from "@/lib/utils";

import { Avatar } from "@/ui/avatar";

interface Person {
	name: string;
	email: string;
	role: string;
}

interface KeyPeopleProps {
	applicant: Person;
	assignedTo: Person[];
}

const PersonItem: React.FC<{
	person: Person;
	role: string;
	showChevron?: boolean;
}> = ({ person, role, showChevron = false }) => (
	<div className="flex items-center w-full p-2 -ml-2">
		<div className="flex items-center space-x-3 flex-grow">
			<Avatar
				initials={getInitials(person.name)}
				size="md"
				backgroundColor={role === "Applicant" ? "bg-green-100" : "bg-blue-100"}
				textColor={role === "Applicant" ? "text-green-700" : "text-blue-700"}
			/>
			<div>
				<h3 className="text-sm font-medium text-gray-900 text-left text-ellipsis">
					{person.name}
				</h3>
				<p className="text-sm text-gray-500 text-left text-ellipsis">
					{person.email}
				</p>
			</div>
		</div>
		{showChevron && (
			<ChevronDownIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
		)}
	</div>
);

export const KeyPeople: React.FC<KeyPeopleProps> = ({
	applicant,
	assignedTo,
}) => {
	const [selectedPeople, setSelectedPeople] = useState<Person[]>([
		assignedTo[0],
	]);
	const [componentWidth, setComponentWidth] = useState<number | null>(null);
	const componentRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const updateWidth = () => {
			if (componentRef.current) {
				setComponentWidth(componentRef.current.offsetWidth);
			}
		};

		updateWidth();
		window.addEventListener("resize", updateWidth);

		return () => {
			window.removeEventListener("resize", updateWidth);
		};
	}, []);

	const togglePerson = (person: Person) => {
		setSelectedPeople((prev) => {
			if (prev.some((p) => p.email === person.email)) {
				// If the person is already selected, only remove them if there's more than one person selected
				return prev.length > 1
					? prev.filter((p) => p.email !== person.email)
					: prev;
			} else {
				// If the person is not selected, add them to the list
				return [...prev, person];
			}
		});
	};

	return (
		<div ref={componentRef} className="bg-white p-4 rounded-2xl">
			<div className="space-y-4">
				<div>
					<p className="text-sm text-gray-500 mb-1">Applicant</p>
					<PersonItem person={applicant} role="Applicant" />
				</div>
				<div>
					<p className="text-sm text-gray-500 mb-1">Assigned to</p>
					<DropdownMenu.Root>
						<DropdownMenu.Trigger className="w-full">
							<div className="w-full space-y-2">
								{selectedPeople.map((person, index) => (
									<PersonItem
										key={person.email}
										person={person}
										role="Assigned to"
										showChevron={index === selectedPeople.length - 1}
									/>
								))}
							</div>
						</DropdownMenu.Trigger>
						<DropdownMenu.Portal>
							<DropdownMenu.Content
								className="bg-white rounded-b-2xl shadow-lg p-1 -mt-1.5"
								sideOffset={5}
								style={{
									width: componentWidth ? `${componentWidth}px` : "auto",
								}}
							>
								<div className="max-h-60 overflow-auto">
									{assignedTo.map((person) => (
										<DropdownMenu.CheckboxItem
											key={person.email}
											checked={selectedPeople.some(
												(p) => p.email === person.email,
											)}
											onCheckedChange={() => {
												togglePerson(person);
											}}
											className="flex items-center p-2 hover:bg-gray-100 rounded cursor-pointer"
										>
											<div className="w-6 flex-shrink-0 mr-2">
												<DropdownMenu.ItemIndicator>
													<CheckIcon className="h-4 w-4 text-blue-500" />
												</DropdownMenu.ItemIndicator>
											</div>
											<PersonItem person={person} role="Assigned to" />
										</DropdownMenu.CheckboxItem>
									))}
								</div>
							</DropdownMenu.Content>
						</DropdownMenu.Portal>
					</DropdownMenu.Root>
				</div>
			</div>
		</div>
	);
};
