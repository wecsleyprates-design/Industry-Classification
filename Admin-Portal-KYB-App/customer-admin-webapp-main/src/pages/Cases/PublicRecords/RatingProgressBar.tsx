import { formatNumberWithSuffix } from "@/lib/helper";

const RatingProgressBar = ({
	stars,
	count,
	percentage,
}: {
	stars: number;
	count: number;
	percentage: number;
}) => {
	return (
		<>
			<div className="flex items-center justify-between ">
				<div className="flex flex-row items-center w-full text-xs font-normal tracking-tight">
					<span className="mr-2 font-bold">{stars}</span>
					<div className="flex-grow bg-[#4CC8E9] bg-opacity-20 rounded-full h-2 overflow-clip mr-2">
						<div
							className="bg-[#4CC8E9] h-2 rounded-full "
							style={{
								width: `${percentage * 100}%`,
							}}
						></div>
					</div>
					<span className="w-6 mr-1 font-bold text-right">
						{formatNumberWithSuffix(count, 1)}
					</span>
					<span className="text-right w-9">
						({(percentage * 100).toFixed(1)})%
					</span>
				</div>
			</div>
		</>
	);
};

export default RatingProgressBar;
