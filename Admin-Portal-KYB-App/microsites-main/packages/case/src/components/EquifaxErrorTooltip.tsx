import React from "react";

interface EquifaxError {
	title: string;
	description: string;
}

interface EquifaxErrorTooltipProps {
	errors: EquifaxError[];
}

export const EquifaxErrorTooltip: React.FC<EquifaxErrorTooltipProps> = ({
	errors,
}) => {
	return (
		<div>
			{errors.map((error, index) => (
				<div key={index} className={index > 0 ? "mt-3" : ""}>
					<strong>
						{errors.length > 1 ? `Error #${index + 1}: ` : ""}
						{error.title}
					</strong>
					{error.description && (
						<>
							{errors.length > 1 ? <br /> : ": "}
							{error.description}
						</>
					)}
				</div>
			))}
		</div>
	);
};
