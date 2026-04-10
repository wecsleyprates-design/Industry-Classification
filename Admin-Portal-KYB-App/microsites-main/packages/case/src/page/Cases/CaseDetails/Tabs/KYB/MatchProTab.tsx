import React from "react";
import CaseProgressOrScore from "@/components/CaseProgressOrScore/CaseProgressOrScore";
import { useCustomToast } from "@/hooks/useCustomToast";
import useGetCaseDetails from "@/hooks/useGetCaseDetails";
import {
	useGetMatchProData,
	useRunMatchPro,
} from "@/services/queries/integration.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import {
	MatchListView,
	ResubmitMatchModal,
	transformMatchResponse,
} from "./components/MatchPro";

import { CardContent, CardHeader } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";

export interface MatchProTabProps {
	caseId: string;
}

export const MatchProTab: React.FC<MatchProTabProps> = ({ caseId }) => {
	const { customerId } = useAppContextStore();
	const { caseData, caseIdQueryLoading } = useGetCaseDetails({
		caseId,
		customerId,
	});
	const businessId = caseData?.data?.business.id ?? "";

	const { data: matchProData, isLoading } = useGetMatchProData(businessId);

	const [isResubmitModalOpen, setIsResubmitModalOpen] = React.useState(false);

	const { errorToast } = useCustomToast();
	const runMatchPro = useRunMatchPro();

	const matchUIState = React.useMemo(() => {
		if (!matchProData?.data) return null;
		return transformMatchResponse(matchProData.data);
	}, [matchProData?.data]);

	const handleResubmit = React.useCallback(
		async (icas: string[]) => {
			try {
				await runMatchPro.mutateAsync({ customerId, businessId, icas });
				setIsResubmitModalOpen(false);
			} catch (error) {
				errorToast(error);
			}
		},
		[runMatchPro, customerId, businessId, errorToast],
	);

	const handleOpenResubmit = React.useCallback(
		() => setIsResubmitModalOpen(true),
		[],
	);

	const handleCloseResubmit = React.useCallback(
		() => setIsResubmitModalOpen(false),
		[],
	);

	if (isLoading || caseIdQueryLoading) {
		return (
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
				<div className="col-span-1 lg:col-span-7">
					<CardHeader>
						<Skeleton className="w-32 h-6" />
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{Array.from({ length: 5 }).map((_, index) => (
								<div
									key={index}
									className="flex items-center justify-between"
								>
									<Skeleton className="w-24 h-4" />
									<Skeleton className="w-32 h-4" />
								</div>
							))}
						</div>
					</CardContent>
				</div>
				<div className="col-span-1 lg:col-span-5">
					<Skeleton className="w-full h-64" />
				</div>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
			<div className="col-span-1 lg:col-span-7">
				{matchUIState && (
					<>
						<MatchListView
							matchUIState={matchUIState}
							onResubmit={handleOpenResubmit}
						/>
						<ResubmitMatchModal
							open={isResubmitModalOpen}
							onClose={handleCloseResubmit}
							icas={matchUIState.icas}
							onSubmit={handleResubmit}
							isSubmitting={runMatchPro.isPending}
						/>
					</>
				)}
			</div>

			<div className="col-span-1 lg:col-span-5">
				<CaseProgressOrScore caseId={caseId} caseData={caseData} />
			</div>
		</div>
	);
};
