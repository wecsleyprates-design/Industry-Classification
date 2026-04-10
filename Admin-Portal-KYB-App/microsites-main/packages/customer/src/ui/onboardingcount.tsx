import React, { useEffect, useState } from "react";
import { useParams } from "react-router";
import { motion } from "framer-motion";
import { convertToLocalDate } from "@/lib/helper";
import { useGetMonthlyOnboardingLimit } from "@/services/queries/customer.query";

import { Card, CardContent } from "@/ui/card";

const OnboardingCountCard: React.FC = () => {
	const { slug } = useParams();
	const [percentage, setPercentage] = useState(0);

	const { data: monthlyOnboardingLimitData } = useGetMonthlyOnboardingLimit(
		slug ?? "",
	);

	useEffect(() => {
		if (monthlyOnboardingLimitData) {
			const limit = monthlyOnboardingLimitData?.data?.onboarding_limit;
			const count = monthlyOnboardingLimitData?.data?.current_count ?? 0;

			if (limit && limit > 0) {
				let percent = (count / limit) * 100;
				percent = Math.min(Math.max(percent, 0), 100); // clamp between 0–100
				setPercentage(percent);
			}
		}
	}, [monthlyOnboardingLimitData]);

	const strokeWidth = 20;
	const sqSize = 200;
	const radius = (sqSize - strokeWidth) / 2;
	const dashArray = radius * Math.PI * 2;
	const dashOffset = dashArray - (dashArray * percentage) / 100;

	const limit = monthlyOnboardingLimitData?.data?.onboarding_limit ?? null;
	const count = monthlyOnboardingLimitData?.data?.current_count ?? 0;
	const remaining = limit ? Math.max(limit - count, 0) : null;

	const title = `${
		convertToLocalDate(
			monthlyOnboardingLimitData?.data?.reset_at ?? new Date(),
			"MMMM DD, YYYY",
		).split(" ")[0]
	} Onboarding Count`;

	const lastUpdated = convertToLocalDate(
		monthlyOnboardingLimitData?.data?.updated_at ?? 0,
		"MM/DD/YYYY",
	);

	return (
		<Card className="h-[402px] rounded-[12px] w-full bg-white">
			<CardContent className="flex flex-col h-full pt-5">
				<h2 className="p-1 text-[16px] font-semibold leading-[24px] tracking-[0.5px] text-center text-[#1F2937]">
					{title}
				</h2>

				<p className="text-[14px] text-center text-[#6B7280] font-figtree">
					Last updated: {lastUpdated}
				</p>

				<div className="mt-10 flex justify-center relative">
					{/* Reuse MonthlyLimits circle */}
					<div className="relative mt-5">
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ duration: 0.5 }}
						>
							<svg
								width={sqSize}
								height={sqSize}
								viewBox={`0 0 ${sqSize} ${sqSize}`}
							>
								<circle
									className="fill-none stroke-gray-200"
									cx={sqSize / 2}
									cy={sqSize / 2}
									r={radius}
									strokeWidth={strokeWidth}
								/>
								<motion.circle
									className="fill-none"
									stroke="#2563EB"
									cx={sqSize / 2}
									cy={sqSize / 2}
									r={radius}
									strokeLinecap="round"
									strokeWidth={strokeWidth}
									transform={`rotate(-90 ${sqSize / 2} ${sqSize / 2})`}
									initial={{
										strokeDasharray: dashArray,
										strokeDashoffset: dashArray,
									}}
									animate={{
										strokeDashoffset: dashOffset,
									}}
									transition={{
										duration: 1.2,
										ease: "easeInOut",
										delay: 0.2,
									}}
								/>
							</svg>
						</motion.div>

						<motion.div
							className="absolute inset-0 flex flex-col items-center justify-center w-[200px] h-[200px]"
							initial={{ opacity: 0, scale: 0.5 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={{ duration: 0.5, delay: 0.7 }}
						>
							<span className="text-2xl font-medium text-gray-800">
								{count}
							</span>
							<span className="text-xs font-medium text-gray-500">
								New Onboardings
							</span>
						</motion.div>
					</div>
				</div>

				<p className="text-[14px] font-medium leading-[20px] text-center mt-4 text-[#6B7280]">
					{limit ? (
						<>
							{remaining?.toLocaleString()} additional new onboardings can be
							completed before reaching the monthly limit.
						</>
					) : (
						<>There are currently no monthly limits set for this customer.</>
					)}
				</p>
			</CardContent>
		</Card>
	);
};

export default OnboardingCountCard;
