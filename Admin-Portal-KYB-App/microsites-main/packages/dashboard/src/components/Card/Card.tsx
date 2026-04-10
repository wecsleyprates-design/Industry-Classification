import React from "react";

interface Props {
	headerComponent?: React.ReactNode;
	contentComponent: React.ReactNode;
	width?: string; // format w-[1000px]
	height?: string; // format h-[1000px]
}

const Card: React.FC<Props> = ({
	headerComponent,
	contentComponent,
	width,
	height,
}) => {
	return (
		<div
			className={`m-2 rounded-lg bg-white shadow border ${width ?? ""} ${
				height ?? ""
			}`}
		>
			{headerComponent && (
				<div className="px-4 py-2 sm:p-3">{headerComponent}</div>
			)}
			<div className="z-10 px-4 py-2 sm:p-3">{contentComponent}</div>
		</div>
	);
};

export default Card;
