import React from "react";

interface CustomWorkflowIconProps extends React.SVGProps<SVGSVGElement> {
	className?: string;
}

const CustomWorkflowIcon: React.FC<CustomWorkflowIconProps> = ({
	className = "",
	...props
}) => {
	return (
		<svg
			className={className}
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			{...props}
		>
			{/* Central stem (vertical line) */}
			<line x1="12" y1="10" x2="12" y2="18" />
			{/* Bottom circular node */}
			<circle cx="12" cy="18" r="2" fill="currentColor" />
			{/* Top-left diagonal branch */}
			<line x1="12" y1="10" x2="6" y2="6" />
			{/* Top-right diagonal branch */}
			<line x1="12" y1="10" x2="18" y2="6" />
			{/* Top-left circular node */}
			<circle cx="6" cy="6" r="2" fill="currentColor" />
			{/* Top-right circular node */}
			<circle cx="18" cy="6" r="2" fill="currentColor" />
		</svg>
	);
};

export default CustomWorkflowIcon;
