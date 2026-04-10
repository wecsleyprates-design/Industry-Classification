import * as React from "react";

interface Props {
	style?: {
		height?: number;
		width?: number;
	};
	onClick?: () => void;
}

const BackIcon: React.FC<Props> = (Props) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={16}
		height={16}
		fill="none"
		onClick={Props?.onClick}
		{...Props?.style}
	>
		<path
			stroke="#292D32"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeMiterlimit={10}
			strokeWidth={1.5}
			d="M6.38 3.953 2.333 8l4.047 4.046M13.667 8H2.447"
		/>
	</svg>
);
export default BackIcon;
