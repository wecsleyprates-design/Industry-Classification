import { useCallback } from "react";
import {
	BlankStar,
	CompleteStar,
	HalfStar,
	NintyPercentStar,
	OneFourthStar,
	ThreeFourthStar,
} from "@/assets/svg/StarIcons";
import TableBody from "@/components/Table/TableBody";
import TableHeader from "@/components/Table/TableHeader";
import { type column } from "@/components/Table/types";
import { type PublicRecordsResponseData } from "@/types/publicRecords";
import RatingProgressBar from "./RatingProgressBar";

const returnRating = (rating: number) => {
	const ratingArray = [];
	for (let i = 0; i < Math.floor(rating); i++) {
		ratingArray.push(<CompleteStar />);
	}
	if (rating !== Math.floor(rating) && ratingArray.length < 5) {
		const differnece = rating - ratingArray.length;
		if (differnece > 0.0 && differnece < 0.3) {
			ratingArray.push(<OneFourthStar />);
		} else if (differnece >= 0.3 && differnece < 0.6) {
			ratingArray.push(<HalfStar />);
		} else if (differnece >= 0.6 && differnece < 0.8) {
			ratingArray.push(<ThreeFourthStar />);
		} else if (differnece >= 0.8 && differnece <= 0.99) {
			ratingArray.push(<NintyPercentStar />);
		} else {
			ratingArray.push(<BlankStar />);
		}
	}

	if (ratingArray.length < 5) {
		for (let i = ratingArray.length; i < 5; i++) {
			ratingArray[i] = <BlankStar />;
		}
	}
	return ratingArray;
};

type Props = {
	publicRecords?: PublicRecordsResponseData;
};

const BrandManagementTab: React.FC<Props> = ({ publicRecords }) => {
	const columns: column[] = [
		{
			title: "Review source",
			path: "source",
		},
		{
			title: "Number of reviews",
			path: "number_of_reviews",
			content: (item) => {
				return <div className="w-1/2 text-end">{item?.count ?? 0}</div>;
			},
		},
		{
			title: "% of reviews",
			path: "number_of_reviews",
			content: (item) => {
				return <div className="w-1/2 text-end">{item?.percentage ?? 0}%</div>;
			},
		},
	];

	const ratingFormatter = useCallback(
		(inputRating: number) => {
			const ratingArray = inputRating?.toString()?.split(".");
			let rating: number;
			if (ratingArray?.length === 1) rating = Number(ratingArray[0]);
			else {
				rating = Number(
					`${ratingArray?.[0]}.${ratingArray?.[1].toString()[0]}  `,
				);
			}
			return rating;
		},
		[publicRecords],
	);

	return (
		<>
			{JSON.stringify(publicRecords) === "{}" ? (
				<div className="py-2 text-base font-normal tracking-tight text-center text-gray-500">
					Data not found
				</div>
			) : (
				<>
					<div className="mx-auto overflow-hidden bg-white border rounded-xl">
						<div className="p-5 border-b">
							<h2 className="text-lg font-bold text-gray-800">
								Customer reviews
							</h2>
							<div className="flex items-center text-sm font-medium">
								Average rating:
								<span className="mx-1 mr-2 text-sm font-bold">
									{publicRecords?.public_records?.average_rating
										? ratingFormatter(
												publicRecords?.public_records?.average_rating,
											)
										: "-"}
									/5
								</span>
								{returnRating(
									publicRecords?.public_records?.average_rating ?? 0,
								).map((rating) => rating)}
							</div>
							<div className="py-2">
								<RatingProgressBar
									stars={5}
									count={Number(
										publicRecords?.public_records?.review_statistics
											?.count_of_5_star_ratings_all_time ?? 0,
									)}
									percentage={Number(
										publicRecords?.public_records?.review_statistics
											?.percentage_of_5_star_ratings_all_time ?? 0,
									)}
								/>
								<RatingProgressBar
									stars={4}
									count={Number(
										publicRecords?.public_records?.review_statistics
											?.count_of_4_star_ratings_all_time ?? 0,
									)}
									percentage={Number(
										publicRecords?.public_records?.review_statistics
											?.percentage_of_4_star_ratings_all_time ?? 0,
									)}
								/>
								<RatingProgressBar
									stars={3}
									count={Number(
										publicRecords?.public_records?.review_statistics
											?.count_of_3_star_ratings_all_time ?? 0,
									)}
									percentage={Number(
										publicRecords?.public_records?.review_statistics
											?.percentage_of_3_star_ratings_all_time ?? 0,
									)}
								/>

								<RatingProgressBar
									stars={2}
									count={Number(
										publicRecords?.public_records?.review_statistics
											?.count_of_2_star_ratings_all_time ?? 0,
									)}
									percentage={Number(
										publicRecords?.public_records?.review_statistics
											?.percentage_of_2_star_ratings_all_time ?? 0,
									)}
								/>
								<RatingProgressBar
									stars={1}
									count={Number(
										publicRecords?.public_records?.review_statistics
											?.count_of_0_or_1_star_ratings_all_time ?? 0,
									)}
									percentage={Number(
										publicRecords?.public_records?.review_statistics
											?.percentage_of_0_or_1_star_ratings_all_time ?? 0,
									)}
								/>
							</div>
							<div className="grid grid-cols-1 py-5 text-xs gap-y-1 gap-x-14 md:grid-cols-2">
								<div className="flex items-center justify-between">
									<div>Total Reviewers</div>
									<div className="self-start font-bold">
										{publicRecords?.public_records?.review_statistics
											?.count_of_total_reviewers_all_time ?? "-"}
									</div>
								</div>
								<div className="flex items-center justify-between">
									<div>Standard Deviation of Rating</div>
									<div className="self-start font-bold">
										{publicRecords?.public_records?.review_statistics
											?.standard_deviation_of_rating_all_time ?? "-"}
									</div>
								</div>
								<div className="flex items-center justify-between">
									<div>Duplicate Reviewers</div>
									<div className="self-start font-bold">
										{publicRecords?.public_records?.review_statistics
											?.count_of_duplicate_reviewers_all_time ?? "-"}
									</div>
								</div>
								<div className="flex items-center justify-between">
									<div>Variance of Rating</div>
									<div className="self-start font-bold">
										{publicRecords?.public_records?.review_statistics
											?.variance_of_rating_all_time ?? "-"}
									</div>
								</div>
								<div className="flex items-center justify-between">
									<div>Min Rating</div>
									<div className="self-start font-bold">
										{publicRecords?.public_records?.review_statistics
											?.min_rating_all_time ?? "-"}
									</div>
								</div>
								<div className="flex items-center justify-between">
									<div>Reviews with Alert Words</div>
									<div className="self-start font-bold ">
										{publicRecords?.public_records?.review_statistics
											?.count_of_reviews_containing_alert_words_all_time
											? `${String(
													publicRecords?.public_records?.review_statistics
														?.count_of_reviews_containing_alert_words_all_time,
												)} (${(
													Number(
														publicRecords?.public_records?.review_statistics
															?.percentage_of_reviews_containing_alert_words_all_time,
													) * 100
												).toFixed(2)}%)`
											: "0"}
									</div>
								</div>
								<div className="flex items-center justify-between">
									<div>Median Rating</div>
									<div className="self-start font-bold">
										{publicRecords?.public_records?.review_statistics
											?.median_rating_all_time ?? "-"}
									</div>
								</div>
								<div className="flex items-center justify-between">
									<div>Max Rating</div>
									<div className="self-start font-bold">
										{publicRecords?.public_records?.review_statistics
											?.max_rating_all_time ?? "-"}
									</div>
								</div>
							</div>
						</div>
						<table className="w-full text-left divide-y divide-gray-300">
							<TableHeader columns={columns} />
							<TableBody
								isLoading={false}
								columns={columns}
								tableData={{
									total_pages: 1,
									total_items:
										publicRecords?.public_records?.reviews?.length ?? 1,
									records: publicRecords?.public_records?.reviews ?? [],
								}}
							/>
						</table>
					</div>
				</>
			)}
		</>
	);
};

export default BrandManagementTab;
