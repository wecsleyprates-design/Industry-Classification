import { useEffect, useState } from "react";

const debounce = (
	func: (...args: any[]) => void,
	wait: number,
): ((...args: any[]) => void) => {
	let timeout: NodeJS.Timeout | null;
	return function executedFunction(...args: any[]) {
		const later = () => {
			if (timeout) {
				clearTimeout(timeout);
				timeout = null;
			}
			func(...args);
		};
		if (timeout) {
			clearTimeout(timeout);
		}
		timeout = setTimeout(later, wait);
	};
};

export const useDeviceSize = () => {
	const [deviceSize, setDeviceSize] = useState<"sm" | "md" | "lg">(() => {
		const width = window.innerWidth;
		if (width <= 640) return "sm";
		else if (width > 640 && width <= 1024) return "md";
		else return "lg";
	});

	useEffect(() => {
		const handleResize = debounce(() => {
			const width = window.innerWidth;
			if (width <= 640) setDeviceSize("sm");
			else if (width > 640 && width <= 1024) setDeviceSize("md");
			else setDeviceSize("lg");
		}, 250); // Debounce time of 250 milliseconds

		window.addEventListener("resize", handleResize);

		return () => {
			window.removeEventListener("resize", handleResize);
		};
	}, []);

	return deviceSize;
};
