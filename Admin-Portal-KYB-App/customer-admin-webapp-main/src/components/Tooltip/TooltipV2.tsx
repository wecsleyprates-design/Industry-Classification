import React, { useMemo, useState } from "react";
import classNames from "classnames";
import "./TooltipV2.css";

type TooltipProps = {
	children: React.ReactNode;
	tooltip?: string | React.ReactNode;
	delay?: number;
	direction?: "top" | "left" | "right" | "bottom";
	offset?: number;
};

const Tooltip = ({
	children,
	tooltip,
	delay,
	direction,
	offset,
}: TooltipProps) => {
	let timeout: any;
	const [active, setActive] = useState(false);

	const showTip = () => {
		timeout = setTimeout(() => {
			setActive(true);
		}, delay ?? 400);
	};

	const hideTip = () => {
		clearInterval(timeout);
		setActive(false);
	};

	const getOffset = useMemo(() => {
		if (offset) return `w-[${offset * 12}px]`;
	}, [offset]);

	return (
		<div
			className="Tooltip-Wrapper"
			onMouseEnter={showTip}
			onMouseLeave={hideTip}
		>
			{children}
			{active && (
				<div className={classNames(`Tooltip-Tip bottom rounded`, getOffset)}>
					{tooltip}
				</div>
			)}
		</div>
	);
};

export default Tooltip;
