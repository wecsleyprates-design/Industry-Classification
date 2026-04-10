import { useEffect, useLayoutEffect, useState } from "react";

interface dimensions {
	width: number;
	height: number;
}

export const useDimensions = (ref: React.RefObject<HTMLElement | null>) => {
	const [dimensions, setDimensions] = useState<dimensions | null>(null);

	const updateDimensions = () => {
		if (ref.current) {
			setDimensions({
				width: ref.current.offsetWidth,
				height: ref.current.offsetHeight,
			});
		}
	};

	useLayoutEffect(() => {
		updateDimensions();
		// Ensure dimensions are updated for initial render
	}, [ref.current]);

	useEffect(() => {
		window.addEventListener("resize", updateDimensions);
		// Attach resize listener

		return () => {
			window.removeEventListener("resize", updateDimensions);
		};
		// Clean up listener on component unmount
	}, []);

	return dimensions;
};
