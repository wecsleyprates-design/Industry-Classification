import React, { useEffect, useRef, useState } from "react";

const Timer: React.FC<{
	reset: boolean;
	endTime: any;
	setIsResentInviteEnabled: React.Dispatch<React.SetStateAction<boolean>>;
}> = ({ reset, setIsResentInviteEnabled, endTime }) => {
	const timerRef = useRef<any>(null);
	const [timer, setTimer] = useState("00:00");

	const getTimeRemaining = (e: Date) => {
		const total = Date.parse(e.toString()) - Date.parse(new Date().toString());
		const seconds = Math.floor((total / 1000) % 60);
		const minutes = Math.floor((total / 1000 / 60) % 60);
		const hours = Math.floor((total / 1000 / 60 / 60) % 24);
		return {
			total,
			hours,
			minutes,
			seconds,
		};
	};

	const startTimer = (e: Date) => {
		const { total, minutes, seconds } = getTimeRemaining(e);
		if (total >= 0) {
			setTimer(
				`${minutes > 9 ? minutes : `0${minutes}`}:${
					seconds > 9 ? seconds : `0${seconds}`
				}`,
			);
		}
	};

	const clearTimer = (e: Date) => {
		if (timerRef) clearInterval(timerRef.current);
		const id = setInterval(() => {
			startTimer(e);
		}, 1000);
		timerRef.current = id;
	};

	const getDeadTime = () => {
		return new Date(endTime as string);
	};

	useEffect(() => {
		if (timer === "00:01") {
			setIsResentInviteEnabled(true);
		}
	}, [timer]);

	useEffect(() => {
		clearTimer(getDeadTime());
	}, []);

	useEffect(() => {
		if (reset) {
			clearTimer(getDeadTime());
		}
	}, [reset]);

	return (
		<div className="font-Inter text-xs" ref={timerRef}>
			Time left {timer}
		</div>
	);
};

export default Timer;
