import * as React from "react";
interface Props {
	height?: number;
	width?: number;
}
const UnderlineIcon: React.FC<Props> = (Props) => (
	<svg
		width="14"
		height="14"
		viewBox="0 0 14 14"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			d="M10.9967 1.49597V6.49597C10.9967 7.02126 10.8932 7.5414 10.6922 8.02671C10.4912 8.51201 10.1966 8.95296 9.82513 9.3244C9.4537 9.69583 9.01274 9.99047 8.52744 10.1915C8.04214 10.3925 7.52199 10.496 6.9967 10.496C6.47142 10.496 5.95127 10.3925 5.46597 10.1915C4.98067 9.99047 4.53971 9.69583 4.16828 9.3244C3.79684 8.95296 3.5022 8.51201 3.30119 8.02671C3.10017 7.5414 2.9967 7.02126 2.9967 6.49597V1.49597M1.4967 12.4973H12.4967"
			stroke="#4B5563"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);
export default UnderlineIcon;
