import React from "react";

interface StepLayoutProps {
	children: React.ReactNode;
}

const StepLayout: React.FC<StepLayoutProps> = ({ children }) => {
	return (
		<div className="w-full max-w-[1100px] mx-auto pb-12 px-4 md:px-0">
			{children}
		</div>
	);
};

export default StepLayout;
