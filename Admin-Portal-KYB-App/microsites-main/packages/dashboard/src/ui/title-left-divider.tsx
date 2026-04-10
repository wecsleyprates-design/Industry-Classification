import React from "react";
interface Props {
	/**
	 * title text
	 */
	text: string | React.ReactNode;
	/**
	 * title type
	 * @options: bold | light
	 */
	type?: "bold" | "light";
	/**
	 * inline css style you want to have for the text
	 */
	textStyle?: React.CSSProperties;
	/**
	 * tailwind CSS classes for text styling
	 */
	textStyleClasses?: string;
	/**
	 * Icon
	 */
	Icon?: React.ReactNode;
}

function getClasses(
	type: string | undefined,
	textStyleClasses: string | undefined,
) {
	if (textStyleClasses) return textStyleClasses;
	let classes = "";
	switch (type) {
		case "light":
			classes = "bg-white px-2 text-base text-gray-500";
			break;
		case "bold":
			classes = "bg-white pr-3 text-base font-semibold leading-6 text-gray-900";
			break;
		default:
			classes = "bg-white px-2 text-base text-gray-500";
			break;
	}
	return classes;
}

export const TitleLeftDivider: React.FC<Props> = ({
	text,
	type,
	textStyle,
	textStyleClasses,
	Icon,
}) => {
	return (
		<div className="relative">
			<div className="absolute inset-0 flex items-center" aria-hidden="true">
				<div className="w-full border-t border-gray-300" />
			</div>
			<div className="relative flex justify-start">
				<span className={getClasses(type, textStyleClasses)} style={textStyle}>
					{text}
				</span>
				{Icon && <div className="pr-1 bg-white">{Icon}</div>}
			</div>
		</div>
	);
};
