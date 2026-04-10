import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import dayjs from "dayjs";
import Card from "@/components/Card";
import LongTextWrapper from "@/components/LongTextWrapper";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import PageTitle from "@/components/Title";
import useCustomToast from "@/hooks/useCustomToast";
import { convertToLocalDate, getSlugReplacedURL } from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import {
	useGetBusinessById,
	useGetScoreTrendChart,
	useGetWorthScore,
	useGetWorthScoreDate,
} from "@/services/queries/businesses.query";
import BusinessTabLayout from "./BusinessTabLayout";
import WorthScoreComponent from "./WorthScoreComponent";
import WorthScoreTrend from "./WorthScoreTrend";

import { LOCALSTORAGE } from "@/constants/LocalStorage";
import { URL } from "@/constants/URL";

// TODO: should be implemented in microsites. this work should be considered while working on business details ui revamp
const HistoricalScoreData = () => {
	const { slug } = useParams();
	const { errorHandler } = useCustomToast();
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const [month, setMonth] = useState<string>("");
	const [year, setYear] = useState<string>("");
	const [datePosition, setDatePosition] = useState<number>(0);
	const [scoreTrendDate, setScoreTrendDate] = useState<Date>(new Date());
	const [isDateUpdated, setIsDateUpdated] = useState(false);
	const [scoreTriggerId, setScoreTriggerId] = useState<string>();
	const [scoreIdsData, setScoreIdsData] = useState<
		Array<{
			date: Date;
			score_trigger_id: string;
		}>
	>([]);
	const {
		data: businessApiData,
		error: businessError,
		isLoading,
	} = useGetBusinessById({ businessId: slug ?? "" });

	const { data: wortScoreData, isLoading: worthScoreLoading } =
		useGetWorthScore({
			businessId: slug ?? "",
			customerId,
			month,
			year,
			scoreTriggerId,
		});

	const { refetch, data: worthScoreDate } = useGetWorthScoreDate(slug ?? "");

	function setDateSearchParameters(year: string, month: string) {
		setMonth(month);
		setYear(year);
	}

	useEffect(() => {
		void refetch();
	}, [year, month]);

	useEffect(() => {
		if (worthScoreDate?.data?.length) {
			const getLatestPosition = worthScoreDate.data.length - 1;
			const scoreDate = worthScoreDate.data[getLatestPosition];
			setScoreTriggerId(
				worthScoreDate.data[getLatestPosition].score_trigger_id,
			);
			setDatePosition(getLatestPosition);
			const scores = worthScoreDate.data.map((item) => ({
				date: item?.fullDate,
				score_trigger_id: item.score_trigger_id,
			}));
			setScoreIdsData(scores);
			setDateSearchParameters(scoreDate.year, scoreDate.month);
		}
	}, [worthScoreDate]);

	const { data: scoreTrendData, isLoading: scoreTrendLoading } =
		useGetScoreTrendChart(
			slug ?? "",
			isDateUpdated
				? {
						year: Number(dayjs(scoreTrendDate).add(1, "M").get("year")),
					}
				: undefined,
		);

	const scoreTrendParsedData = useMemo(() => {
		if (scoreTrendData?.data?.score_data) {
			const resArray: any = [{ x: 0, y: 340 }]; // to start at 0

			scoreTrendData?.data?.score_data?.forEach((item) => {
				const month = dayjs(item?.created_at).utc().format("MMM");
				if (month === "Jan") {
					// if score present for Jan then replace 0 with Jan Object
					resArray[0] = {
						x: month,
						y: Number(item.weighted_score_850),
					};
				} else {
					resArray.push({
						x: month,
						y: Number(item.weighted_score_850),
					});
				}
			});
			return resArray;
		} else {
			return [];
		}
	}, [scoreTrendData]);

	useEffect(() => {
		if (businessError) {
			errorHandler(businessError);
		}
	}, [businessError]);

	const updateScoreTrendDate = (date: Date) => {
		setIsDateUpdated(true);
		setScoreTrendDate(date);
	};

	const updateScoreId = (id?: string) => {
		setScoreTriggerId(id);
	};

	return (
		<>
			{(isLoading || scoreTrendLoading) && <FullPageLoader />}
			<Card
				headerComponent={
					<>
						<PageTitle
							titleText={"Historical Score Data"}
							backLocation={getSlugReplacedURL(
								URL.BUSINESS_DETAILS,
								slug ?? "",
							)}
						/>
						<div className="mx-4 my-4">
							<div className="grid grid-cols-1 overflow-visible sm:grid-cols-4 sm:grid-flow-col">
								<div className="grid items-center grid-cols-2 gap-2 mb-2 sm:flex sm:flex-col sm:items-start">
									<p className="text-[10px] font-normal text-gray-500 tracking-tight">
										Business Name
									</p>
									<p className="text-sm font-medium tracking-tight break-words text-slate-800">
										<LongTextWrapper text={businessApiData?.data.name ?? "-"} />
									</p>
								</div>
								<div className="grid items-center grid-cols-2 gap-2 mb-2 sm:flex sm:flex-col sm:items-start">
									<p className="text-[10px] font-normal text-gray-500 tracking-tight">
										Onboarding date
									</p>
									<p className="overflow-hidden text-sm font-medium tracking-tight break-words text-slate-800">
										{convertToLocalDate(
											businessApiData?.data?.created_at ?? null,
											"MM-DD-YYYY - h:mmA",
										)}
									</p>
								</div>
							</div>
						</div>
					</>
				}
				contentComponent={
					<div className="grid w-full grid-cols-1 sm:grid-cols-12 col gap-x-5">
						<div className="sm:col-span-7">
							<BusinessTabLayout
								businessId={slug ?? ""}
								scoreTriggerId={scoreTriggerId}
							/>
						</div>
						<div className="sm:col-span-5">
							{worthScoreDate ? (
								<WorthScoreComponent
									wortScoreData={wortScoreData}
									isLoading={worthScoreLoading}
									type="month"
									date={
										new Date(
											wortScoreData?.data.created_at ??
												new Date(
													worthScoreDate?.data?.[datePosition]?.fullDate,
												),
										)
									}
									updateDate={(_, value) => {
										const newDatePosition = datePosition + Number(value);
										setDatePosition(newDatePosition);
										const date = worthScoreDate?.data[newDatePosition];
										setDateSearchParameters(date?.year, date?.month);
										setScoreTriggerId(date.score_trigger_id);
									}}
									hasNext={datePosition < worthScoreDate?.data.length - 1}
									hasPrevious={datePosition > 0}
									scoreIds={scoreIdsData}
									updateScoreId={updateScoreId}
								/>
							) : null}
							<WorthScoreTrend
								scoreTrendDate={scoreTrendDate}
								updateScoreTrendDate={updateScoreTrendDate}
								scoreTrendParsedData={scoreTrendParsedData}
							/>
						</div>
					</div>
				}
			/>
		</>
	);
};

export default HistoricalScoreData;
