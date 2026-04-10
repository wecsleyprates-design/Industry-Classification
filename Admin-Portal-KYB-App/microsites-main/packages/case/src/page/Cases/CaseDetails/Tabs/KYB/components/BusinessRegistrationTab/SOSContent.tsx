import React, { type ReactNode } from "react";
import { CardListItem } from "../CardListItem";

import { CardList } from "@/page/Cases/CaseDetails/components";

type Details = Array<{
	label: string;
	value: ReactNode;
	labelTooltip?: ReactNode;
}>;

export interface SOSContentProps {
	sosDetails: Details;
}

export const SOSContent: React.FC<SOSContentProps> = ({ sosDetails }) => (
	<CardList>
		{sosDetails.map((item, index) => (
			<CardListItem
				key={index}
				label={item.label}
				value={item.value}
				labelTooltip={item.labelTooltip}
			/>
		))}
	</CardList>
);
