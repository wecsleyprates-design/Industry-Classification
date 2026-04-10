import * as React from "react";
import type { SidebarIcon as Props } from "./IconTypes";

const CloseIcon: React.FC<Props> = (Props) => (
	<svg
		width="15"
		height="16"
		viewBox="0 0 21 22"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<rect width="21" height="22" fill="b0bec5" />
		<path
			d="M4.16797 4.16669L15.8339 15.8326"
			stroke="black"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M4.16786 15.8326L15.8337 4.16669"
			stroke="black"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);
export default CloseIcon;
