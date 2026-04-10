import React from "react";
import { CardList } from "./CardList";
import { CardListItem } from "./CardListItem";
import type { FieldSource } from "./fieldSource.types";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";

type Detail = {
	label: React.ReactNode;
	value: React.ReactNode;
	fieldSource?: FieldSource;
};

type Details = Detail[];

interface DetailsCardProps {
	title: string | React.ReactNode;
	details: Details;
}

export const DetailsCard: React.FC<DetailsCardProps> = ({ title, details }) => (
	<Card>
		<div className="flex flex-col bg-white rounded-xl">
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent>
				<CardList>
					{details.map((detail: Detail, i) => (
						<CardListItem
							key={i}
							label={detail.label}
							value={detail.value}
							fieldSource={detail.fieldSource}
						/>
					))}
				</CardList>
			</CardContent>
		</div>
	</Card>
);
