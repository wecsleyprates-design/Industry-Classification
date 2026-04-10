import * as React from "react";
interface Props {
	height?: number;
	width?: number;
}
const BackIcon: React.FC<Props> = (Props) => (
	<svg
		width="16"
		height="16"
		viewBox="0 0 16 16"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			d="M6.37998 3.95333L2.33331 8L6.37998 12.0467"
			stroke="#292D32"
			strokeWidth="1.5"
			strokeMiterlimit="10"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M13.6667 8H2.44666"
			stroke="#292D32"
			strokeWidth="1.5"
			strokeMiterlimit="10"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);
export default BackIcon;
