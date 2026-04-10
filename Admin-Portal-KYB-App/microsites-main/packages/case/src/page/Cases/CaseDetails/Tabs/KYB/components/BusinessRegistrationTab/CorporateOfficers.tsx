import React from "react";
import { formatPersonNameAndTitles } from "@/lib/utils";
import { type PeopleObjectValue } from "@/types/integrations";

import { VALUE_NOT_AVAILABLE } from "@/constants";

export interface CorporateOfficersProps {
	people: PeopleObjectValue[] | undefined;
}

export const CorporateOfficers: React.FC<CorporateOfficersProps> = ({
	people,
}) => {
	if (!people || people.length === 0)
		return <span>{VALUE_NOT_AVAILABLE}</span>;

	return (
		<div className="flex flex-col gap-2">
			{people.map((person, index) => (
				<span key={index}>{formatPersonNameAndTitles(person)}</span>
			))}
		</div>
	);
};
