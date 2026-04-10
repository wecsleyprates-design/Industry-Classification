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
				const starValue = rating - (position - 1);
				const fillPercentage =
					starValue >= 1
						? 100
						: starValue > 0
							? Math.round(starValue * 100)
							: 0;

				return (
					<div key={position} className="relative">
						<StarIcon className="size-4 fill-gray-200 text-gray-200" />
						{fillPercentage > 0 && (
							<div
								className="absolute inset-0 overflow-hidden"
								style={{ width: `${fillPercentage}%` }}
							>
								<StarIcon className="size-4 fill-blue-600 text-blue-600" />
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
};
