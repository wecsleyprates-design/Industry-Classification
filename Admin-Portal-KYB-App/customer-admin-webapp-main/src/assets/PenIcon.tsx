import * as React from "react";
interface Props {
	height?: number;
	width?: number;
	fill?: string;
}
const PenIcon: React.FC<Props> = (Props) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={Props.height ?? 14}
		height={Props.width ?? 14}
		fill="#fff"
		{...Props}
	>
		<path
			fill={Props.fill}
			d="m8.014 4.727-.003.004L4.264 8.48 5.387 9.6l3.75-3.75-1.123-1.124ZM2.398 6.612l1.123 1.124L7.27 3.99l.004-.003-1.124-1.124-3.75 3.75ZM1.798 7.497.777 10.559a.524.524 0 0 0 .664.664l3.062-1.021-2.705-2.705ZM10.632 1.367a2.117 2.117 0 0 0-2.989 0l-.752.752 2.99 2.99.751-.752a2.116 2.116 0 0 0 0-2.99Z"
		/>
	</svg>
);
export default PenIcon;
