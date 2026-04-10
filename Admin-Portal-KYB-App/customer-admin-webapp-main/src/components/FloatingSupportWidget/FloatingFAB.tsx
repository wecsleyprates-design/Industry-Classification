import React from "react";
import { WrenchScrewdriverIcon } from "@heroicons/react/24/solid";

type Props = {
	onClick: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
};

const FloatingFAB: React.FC<Props> = ({ onClick, onPointerDown }) => (
	<button
		className="w-14 h-14 rounded-full bg-[#2563eb] text-white border-0 shadow-lg cursor-move select-none flex items-center justify-center"
		onClick={onClick}
		onPointerDown={onPointerDown}
		title="Quick Actions"
	>
		<WrenchScrewdriverIcon width={28} height={28} className="text-white" />
	</button>
);

export default FloatingFAB;
