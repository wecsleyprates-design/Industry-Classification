import React from "react";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type IntegrationToastProps = {
	icon?: React.ReactNode;
	title: React.ReactNode;
	subtitle: React.ReactNode;
} & (
	| {
			actions: Array<{
				label: string;
				variant?: "primary" | "secondary";
				onClick: () => void;
			}>;
			dismissible?: never;
			onDismiss?: never;
	  }
	| {
			actions?: never;
			dismissible?: boolean;
			onDismiss?: () => void;
	  }
);

export const IntegrationToast: React.FC<IntegrationToastProps> = (options) => {
	return (
		<div className="bg-white border border-gray-200 rounded-xl shadow-lg p-0 h-auto w-[356px]">
			<div className="flex flex-row">
				<div className="flex items-center gap-3 pl-4 py-4">
					{options?.icon && (
						<div className="shrink-0">{options.icon}</div>
					)}
					<div className="flex flex-col gap-1 flex-1">
						{options?.title && (
							<div className="font-semibold text-sm text-gray-900">
								{options.title}
							</div>
						)}
						{options?.subtitle && (
							<div className="text-xs text-gray-600">
								{options.subtitle}
							</div>
						)}
					</div>
				</div>

				{options.actions?.length ? (
					<div className="flex flex-col border-l border-gray-200 divide-y divide-gray-200 text-xs">
						{options.actions.map((action, index) => (
							<button
								key={index}
								type="button"
								onClick={action.onClick}
								className={cn(
									"flex-1 px-4 py-2 transition-colors whitespace-nowrap",
									(action.variant ?? "primary") === "primary"
										? "text-blue-600 hover:text-blue-700 hover:bg-blue-50"
										: "text-gray-600 hover:text-gray-700 hover:bg-gray-50",
								)}
							>
								{action.label}
							</button>
						))}
					</div>
				) : options.dismissible ? (
					<button
						className="shrink-0 text-gray-800 hover:text-gray-950 transition-colors p-4"
						type="button"
						onClick={options.onDismiss}
					>
						<XIcon className="h-5 w-5" />
					</button>
				) : (
					<div className="flex-1 p-4" />
				)}
			</div>
		</div>
	);
};
