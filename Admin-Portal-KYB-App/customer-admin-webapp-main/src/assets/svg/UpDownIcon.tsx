import React, { type FC } from "react";

const UpDownIcon: FC<{ isUp: boolean }> = ({ isUp }) => {
	return (
		<div>
			<svg
				width="27"
				height="27"
				viewBox="0 0 27 27"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<circle cx="13.5" cy="13.5" r="13" stroke="#D9D9D9" />
				<path
					d={
						isUp
							? "M12.9444 9.08984L18.1889 16.5219H7.69999L12.9444 9.08984Z"
							: "M14.0558 17.9097L8.81134 10.4776L19.3003 10.4776L14.0558 17.9097Z"
					}
					fill="#484952"
				/>
			</svg>
		</div>
	);
};

export default UpDownIcon;
