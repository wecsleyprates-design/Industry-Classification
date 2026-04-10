import type { FC } from "react";
interface Props {
	height?: number;
	width?: number;
	activeColor?: string;
	className?: string;
	onClick?: () => void;
}
const SortIcon: FC<Props> = (props) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		height={props.height ?? 11}
		width={props.width ?? 8}
		className={props.className}
		onClick={props.onClick}
		fill="none"
		{...props}
	>
		<path
			fill={props.activeColor ? props.activeColor : "#D9D9D9"}
			d="m4 0 3.464 4.5H.536L4 0Z"
		/>
		<path fill="#D9D9D9" d="M4 11 .536 6.5h6.928L4 11Z" />
	</svg>
);
export default SortIcon;
