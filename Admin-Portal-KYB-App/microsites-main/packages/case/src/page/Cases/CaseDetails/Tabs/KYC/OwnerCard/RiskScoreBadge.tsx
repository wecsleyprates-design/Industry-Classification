import React from "react";

import { type BadgeProps, VerificationBadge } from "@/ui/badge";
import { Skeleton } from "@/ui/skeleton";

type RiskLevel = "low" | "moderate" | "high";

const RISK_CONFIG: Record<
	RiskLevel,
	{ variant: BadgeProps["variant"]; text: string }
> = {
	low: { variant: "success", text: "Low Risk" },
	moderate: { variant: "warning", text: "Moderate Risk" },
	high: { variant: "error", text: "High Risk" },
};

const getRiskLevel = (score: number): RiskLevel => {
	if (score <= 40) return "low";
	if (score <= 70) return "moderate";
	return "high";
};

type RiskScoreBadgeProps =
	| { level: RiskLevel; score?: never; loading?: boolean }
	| { level?: never; score?: number; loading?: boolean };

export const RiskScoreBadge: React.FC<RiskScoreBadgeProps> = ({
	level = null,
	score = null,
	loading,
}) => {
	if (loading) return <Skeleton className="w-[72px] h-[26px] ml-auto" />;

	/**
	 * Either a level or a numeric score must be provided.
	 * If a level is not provided and the provided score is
	 * null, undefined, or otherwise not a number, the
	 * badge should not render.
	 */
	if (level == null && typeof score !== "number") return null;

	const riskLevel = level ?? getRiskLevel(score ?? 100);
	const { variant, text } = RISK_CONFIG[riskLevel];

	return <VerificationBadge variant={variant}>{text}</VerificationBadge>;
};
