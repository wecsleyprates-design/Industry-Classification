import * as React from "react";
interface Props {
	height?: number;
	width?: number;
}
const StrikeIcon: React.FC<Props> = (Props) => (
	<svg
		width="14"
		height="14"
		viewBox="0 0 14 14"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			d="M7 7.00005C6.92902 6.9838 6.85834 6.96624 6.788 6.94739C5.73133 6.66472 4.852 6.11605 4.28133 5.45672C3.69933 4.78405 3.438 3.99672 3.636 3.25605C4.02933 1.78939 6.078 1.06272 8.21133 1.63472C8.85361 1.80314 9.45976 2.08735 10 2.47339M3.28 10.8734C3.85133 11.5334 4.73067 12.0814 5.78733 12.3647C7.92067 12.9367 9.97 12.2114 10.3627 10.7441C10.518 10.1654 10.392 9.55805 10.0527 8.99939M1.5 7.00005H12.5"
			stroke="#4B5563"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);
export default StrikeIcon;
