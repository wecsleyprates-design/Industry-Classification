import React, { type ReactElement } from "react";
import { useNavigate } from "react-router";
import BackIcon from "assets/svg/BackIcon";

interface Props {
	titleText?: string | ReactElement;
	buttons?: React.JSX.Element;
	subtitleText?: string;
	backLocation?: string;
	isBackAllowed?: boolean;
	businessName?: string;
	backHandler?: () => void | Promise<void>;
}

const PageTitle: React.FC<Props> = ({
	titleText,
	buttons,
	backLocation,
	isBackAllowed = true,
	businessName = "",
	backHandler = () => {},
}) => {
	const navigate = useNavigate();
	const renderedChildren = buttons?.props.children;
	const numChildren = renderedChildren
		? React.Children.toArray(renderedChildren).filter((child: any) => child)
				.length
		: 0;
	const flexDirection =
		numChildren >= 4
			? "flex-col 2xl:flex-row"
			: numChildren >= 3
				? "flex-col lg:flex-row"
				: numChildren >= 2
					? "flex-col md:flex-row"
					: "flex-row";

	const backPressHandler = () => {
		const result = backHandler();
		if (result instanceof Promise) {
			result.catch(() => {
				// Handle promise rejection silently
			});
		}
		if (backLocation) {
			navigate(backLocation);
		} else {
			navigate(-1);
		}
	};
	return (
		<>
			<div className={`flex ${flexDirection} justify-between w-full`}>
				<div
					className={`flex gap-3 justify-items-center w-full flex-col sm:flex-row justify-between `}
				>
					<div className="flex">
						{isBackAllowed ? (
							<div className="self-center cursor-pointer">
								<BackIcon onClick={backPressHandler} />
							</div>
						) : (
							<></>
						)}
						{typeof titleText === "string" ? (
							<div className="flex flex-col self-center pl-2 ">
								<span className="text-sm font-semibold truncate sm:text-lg md:text-xl">
									{titleText}
								</span>
								<span className="text-sm font-normal text-gray-500 ">
									{businessName ?? "-"}
								</span>
							</div>
						) : (
							<span className="self-center w-full pl-2">{titleText}</span>
						)}
					</div>

					<div className="flex items-center justify-center">
						{buttons && (
							<div className="flex items-center justify-end w-fit">
								<>{buttons ?? <></>}</>
							</div>
						)}
					</div>
				</div>
			</div>
		</>
	);
};

export default PageTitle;
