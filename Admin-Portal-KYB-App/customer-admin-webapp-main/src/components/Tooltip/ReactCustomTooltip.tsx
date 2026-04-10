import React, { type ReactElement } from "react";
import { type PlacesType, Tooltip } from "react-tooltip";

interface Props {
	children: ReactElement;
	id: string;
	tooltip: ReactElement;
	place?: PlacesType;
	tooltipStyle?: React.CSSProperties;
	noArrow?: boolean;
}

const ReactCustomTooltip: React.FC<Props> = ({
	children,
	id,
	tooltip,
	place = "bottom",
	tooltipStyle,
	noArrow = false,
}) => {
	return (
		<div>
			<p id={id}>{children}</p>
			<Tooltip
				anchorSelect={`#${id}`}
				style={{
					background: "#374151",
					maxWidth: "200px",
					borderRadius: "8px",
					opacity: "40",
					zIndex: "50",
					...tooltipStyle,
				}}
				noArrow={noArrow}
				place={place}
			>
				{tooltip}
			</Tooltip>
		</div>
	);
};

export default ReactCustomTooltip;
