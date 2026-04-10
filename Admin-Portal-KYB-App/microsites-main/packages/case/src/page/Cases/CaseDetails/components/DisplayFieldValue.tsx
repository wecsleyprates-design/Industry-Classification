import React, { type ReactNode } from "react";
import type { FieldSource } from "./fieldSource.types";
import { SYSTEM_SOURCE } from "./fieldSource.types";
import { FieldSourceIndicator } from "./FieldSourceIndicator";

export const DisplayFieldValue: React.FC<{
	value: ReactNode;
	fieldSource?: FieldSource;
}> = ({ value, fieldSource }) => {
	return (
		<FieldSourceIndicator source={fieldSource ?? SYSTEM_SOURCE}>
			{value}
		</FieldSourceIndicator>
	);
};
