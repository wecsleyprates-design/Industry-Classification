import * as React from "react";
interface Props {
	height?: number;
	width?: number;
}
const ItalicIcon: React.FC<Props> = (Props) => (
	<svg
		width="12"
		height="14"
		viewBox="0 0 12 14"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			d="M1.49866 12.4973H4.03332M4.03332 12.4973H6.49732M4.03332 12.4973L7.96199 1.49597M7.96199 1.49597H5.49732M7.96199 1.49597H10.4973"
			stroke="#4B5563"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);
export default ItalicIcon;
