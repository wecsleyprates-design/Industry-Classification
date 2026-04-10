import * as React from "react";

interface Props {
	height?: number;
	width?: number;
	centerIcon?: number;
	color?: "red" | "yellow";
}

const ExclamationIcon: React.FC<Props> = ({
	height = 20,
	width = 20,
	centerIcon = "!",
	color = "red",
}) => {
	const validNumber =
		typeof centerIcon === "number" && centerIcon < 1000 && centerIcon >= 0;
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 20 20"
			fill="none"
			height={height}
			width={width}
			className="size-6"
		>
			{typeof centerIcon === "number" ? (
				<>
					<circle
						cx="10"
						cy="10"
						r="8"
						fill={`${color === "red" ? "#C81E1E" : "#FF9900"}`}
					/>
					<text
						x="10"
						y={validNumber ? "14" : "13"}
						textAnchor="middle"
						fontSize={validNumber ? "10" : "9"}
						fontFamily="Arial"
						fill="#FFFFFF"
					>
						{centerIcon < 1000 && centerIcon >= 0 ? centerIcon : "1K+"}
					</text>
				</>
			) : (
				<path
					fillRule="evenodd"
					d="M1.875 10c0-4.487 3.638-8.125 8.125-8.125s8.125 3.638 8.125 8.125-3.638 8.125-8.125 8.125S1.875 14.487 1.875 10ZM10 6.875a.625.625 0 0 1 .625.625v3.125a.625.625 0 0 1-1.25 0V7.5a.625.625 0 0 1 .625-.625Zm0 6.875a.625.625 0 1 0 0-1.25.625.625 0 0 0 0 1.25Z"
					clipRule="evenodd"
					fill={`${color === "red" ? "#C81E1E" : "#FF9900"}`}
				/>
			)}
		</svg>
	);
};

export default ExclamationIcon;
