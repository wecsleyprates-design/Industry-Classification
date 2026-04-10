import React from "react";
import { cn } from "@/lib/utils";

type ConnectorType = "AND" | "OR";

interface ConditionConnectorProps {
	type: ConnectorType;
	className?: string;
}

const connectorStyles: Record<ConnectorType, string> = {
	AND: "bg-blue-600 text-white",
	OR: "bg-blue-600 text-white",
};

export const ConditionConnector: React.FC<ConditionConnectorProps> = ({
	type,
	className,
}) => (
	<div className={cn("flex items-center justify-center py-2 gap-3", className)}>
		<div className="flex-1 h-px bg-gray-200" />
		<span
			className={cn(
				"text-xs font-semibold px-4 py-1 rounded-full flex-shrink-0",
				connectorStyles[type],
			)}
		>
			{type}
		</span>
		<div className="flex-1 h-px bg-gray-200" />
	</div>
);
