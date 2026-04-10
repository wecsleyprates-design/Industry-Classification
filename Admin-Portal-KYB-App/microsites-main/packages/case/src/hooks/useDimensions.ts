import { useCallback, useEffect, useLayoutEffect, useState } from "react";

interface dimensions {
	width: number;
	height: number;
}

export const useDimensions = (ref: React.RefObject<HTMLElement>) => {
	const [dimensions, setDimensions] = useState<dimensions | null>(null);

	const updateDimensions = useCallback(() => {
		if (ref.current) {
			setDimensions({
				width: ref.current.offsetWidth,
				height: ref.current.offsetHeight,
			});
		}
	}, [ref]);

	useLayoutEffect(() => {
		updateDimensions();
		// Ensure dimensions are updated for initial render
	}, [updateDimensions]);

	useEffect(() => {
		window.addEventListener("resize", updateDimensions);
		// Attach resize listener

		return () => {
			window.removeEventListener("resize", updateDimensions);
		};
		// Clean up listener on component unmount
	}, [updateDimensions]);

	return dimensions;
};
