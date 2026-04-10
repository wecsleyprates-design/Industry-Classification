import * as React from "react";
interface Props {
	height?: number;
	width?: number;
}
const CheckBadgeIcon: React.FC<Props> = (Props) => (
	<svg
		width={Props.width}
		height={Props.height}
		xmlns="http://www.w3.org/2000/svg"
		fill="fill-green-600"
		viewBox="0 0 24 24"
		strokeWidth="1.5"
		stroke="currentColor"
		className="w-6 h-6 fill-green-600"
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
		/>
	</svg>
);
export default CheckBadgeIcon;
