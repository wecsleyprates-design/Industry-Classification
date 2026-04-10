import { useEffect, useState } from "react";
import {
	CheckCircleIcon,
	ExclamationTriangleIcon,
	InformationCircleIcon,
} from "@heroicons/react/20/solid";

export interface AlertProps {
	text: string;
	type: "success" | "error" | "alert";
}

const Alert: React.FC<AlertProps> = ({
	text,
	type,
}): React.JSX.Element | null => {
	const [visible, setVisible] = useState(true);
	let content: React.JSX.Element = (
		<div className="alert border-l-4 border-green-400 bg-green-50 p-4">
			<div className="flex">
				<div className="flex-shrink-0">
					<CheckCircleIcon
						className="h-5 w-5 text-green-400"
						aria-hidden="true"
					/>
				</div>
				<div className="ml-3">
					<p className="text-sm text-green-700">{text}</p>
				</div>
			</div>
		</div>
	);

	if (type === "alert") {
		content = (
			<div className=" alert border-l-4 border-blue-400 bg-blue-50 p-4">
				<div className="flex">
					<div className="flex-shrink-0">
						<InformationCircleIcon
							className="h-5 w-5 text-blue-400"
							aria-hidden="true"
						/>
					</div>
					<div className="ml-3">
						<p className="text-sm text-blue-700">{text}</p>
					</div>
				</div>
			</div>
		);
	} else if (type === "success") {
		<div className="alert border-l-4 border-green-400 bg-green-50 p-4">
			<div className="flex">
				<div className="flex-shrink-0">
					<CheckCircleIcon
						className="h-5 w-5 text-green-400"
						aria-hidden="true"
					/>
				</div>
				<div className="ml-3">
					<p className="text-sm text-green-700">{text}</p>
				</div>
			</div>
		</div>;
	} else if (type === "error") {
		content = (
			<div className="alert border-l-4 border-yellow-400 bg-yellow-50 p-4">
				<div className="flex">
					<div className="flex-shrink-0">
						<ExclamationTriangleIcon
							className="h-5 w-5 text-yellow-400"
							aria-hidden="true"
						/>
					</div>
					<div className="ml-3">
						<p className="text-sm text-yellow-700">{text}</p>
					</div>
				</div>
			</div>
		);
	}

	useEffect(() => {
		const timer = setTimeout(() => {
			setVisible(false);
		}, 3000);

		return () => {
			clearTimeout(timer);
		};
	}, [type]);

	return visible ? <>{content}</> : null;
};

export default Alert;
