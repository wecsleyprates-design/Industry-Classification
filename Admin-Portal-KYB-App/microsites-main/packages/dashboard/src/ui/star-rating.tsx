import { Star as StarIcon } from "lucide-react";

interface StarRatingProps {
	rating: number;
	className?: string;
}

export const StarRating: React.FC<StarRatingProps> = ({
	rating,
	className,
}) => {
	return (
		<div className={`flex items-center ${className}`}>
			{[1, 2, 3, 4, 5].map((position) => {
				const isHalfStar = position - 0.5 === rating;
				const isFullStar = position <= rating;

				return (
					<div key={position} className="relative">
						{isHalfStar ? (
							// Half star
							<div className="relative">
								<StarIcon className="size-4 fill-gray-200 text-gray-200" />
								<div className="absolute inset-0 overflow-hidden w-[50%]">
									<StarIcon className="size-4 fill-blue-600 text-blue-600" />
								</div>
							</div>
						) : (
							// Full or empty star
							<StarIcon
								className={`size-4 ${
									isFullStar
										? "fill-blue-600 text-blue-600"
										: "fill-gray-200 text-gray-200"
								}`}
							/>
						)}
					</div>
				);
			})}
		</div>
	);
};
