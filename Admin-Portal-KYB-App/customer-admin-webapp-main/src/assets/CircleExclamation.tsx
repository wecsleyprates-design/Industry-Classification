import * as React from "react";
const CircleExclamation = (
	props: React.JSX.IntrinsicAttributes & React.SVGProps<SVGSVGElement>,
) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={20}
		height={20}
		fill="none"
		{...props}
	>
		<path
			fill={props.color}
			d="M20 10c0 5.524-4.477 10-10 10-5.522 0-10-4.476-10-10C0 4.48 4.478 0 10 0c5.523 0 10 4.48 10 10Zm-10 2.016a1.855 1.855 0 1 0 0 3.71 1.855 1.855 0 0 0 0-3.71ZM8.239 5.35l.3 5.484a.484.484 0 0 0 .482.457h1.958c.257 0 .469-.2.483-.457l.299-5.484a.484.484 0 0 0-.483-.51H8.722a.484.484 0 0 0-.483.51Z"
		/>
	</svg>
);
export default CircleExclamation;
