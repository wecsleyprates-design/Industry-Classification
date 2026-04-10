import React from "react";

type TooltipProps = {
	children: React.ReactNode;
	tooltip?: string;
	details: Array<Record<string, string>>;
};

const BadgeTooltip: React.FC<TooltipProps> = ({ children, details }) => {
	return (
		<div className="group absolute inline-block">
			<div>{children}</div>
			<>
				<div className="z-50 w-[200px] -translate-x-36 cursor-pointer border border-[#D9D9D9] bg-white shadow-xl rounded-xl absolute top-5 ml-auto mr-auto min-w-max scale-0 transform p-4 font-medium transition-all duration-500 group-hover:scale-100 ">
					<h2 className="text-[20px] text-[#333333] pb-2">Details</h2>
					{details?.map((detail, index) => {
						return (
							<div className="flex w-full justify-between" key={index}>
								<p className="mr-2">{detail.title}</p>
								<p className="text-[#333333]">{detail.date}</p>
							</div>
						);
					})}
				</div>
			</>
		</div>
	);
};

export default BadgeTooltip;
