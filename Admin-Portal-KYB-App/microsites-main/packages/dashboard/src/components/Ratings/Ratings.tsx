import React, { useEffect, useState } from "react";
import {
	BlankStar,
	CompleteStar,
	HalfStar,
	NintyPercentStar,
	OneFourthStar,
	ThreeFourthStar,
} from "assets/StarIcons";
type Props = {
	rating: number;
};

const Ratings: React.FC<Props> = ({ rating }) => {
	const [ratingsArray, setRatingsArray] = useState<any>([]);

	useEffect(() => {
		const ratings = [];
		for (let i = 0; i < Math.floor(rating); i++) {
			ratings.push(<CompleteStar />);
		}
		if (rating !== Math.floor(rating) && ratings.length < 5) {
			const differnece = rating - ratings.length;
			if (differnece > 0.0 && differnece < 0.3) {
				ratings.push(<OneFourthStar />);
			} else if (differnece >= 0.3 && differnece < 0.6) {
				ratings.push(<HalfStar />);
			} else if (differnece >= 0.6 && differnece < 0.8) {
				ratings.push(<ThreeFourthStar />);
			} else if (differnece >= 0.8 && differnece <= 0.99) {
				ratings.push(<NintyPercentStar />);
			} else {
				ratings.push(<BlankStar />);
			}
		}

		if (ratings.length < 5) {
			for (let i = ratings.length; i < 5; i++) {
				ratings[i] = <BlankStar />;
			}
		}
		setRatingsArray(ratings);
	}, [rating]);
	return (
		<div className="flex">
			{rating ? <>{ratingsArray.map((rating: any) => rating)}</> : null}
		</div>
	);
};

export default Ratings;
