import { isEmptyArray, isNil, isNonEmptyArray } from "@austinburns/type-guards";
import { type Ttype } from "@/components/Badge/StatusBadge";
import {
	useGetBusinessVerificationDetails,
	useSubmitBusinessVerificationOrder,
} from "@/services/queries/integration.query";
import {
	getAddressVerificationReviewTask,
	getBusinessNameMatches,
	getBusinessReviewTask,
	getRegisteredAgentReviewTask,
	getSortedAddressSources,
	getSortedRegistrationsWithOfficers,
	getWatchlistHits,
	getWatchlistReviewTask,
} from "./helpers";

export const useBusinessVerificationService = ({
	businessId,
}: {
	businessId: string;
}) => {
	// Replace this
	const {
		data: businessVerificationDetails,
		isLoading: isBusinessVerificationDetailsLoading,
		error: businessVerificationDetailsError,
	} = useGetBusinessVerificationDetails(businessId);
	const {
		mutateAsync: submitBusinessVerficationOrderAsync,
		data: submitBusinessVerificationOrderData,
		isPending: isSubmitBusinessVerificationOrderLoading,
		error: submitBusinessVerificationOrderError,
		isSuccess: submitBusinessVerificationOrderSuccess,
	} = useSubmitBusinessVerificationOrder(businessId);

	const businessVerificationRecord =
		businessVerificationDetails?.data?.businessEntityVerification ?? null;
	const reviewTasks = businessVerificationDetails?.data?.reviewTasks ?? [];
	const names = businessVerificationDetails?.data?.names ?? [];
	const sortedRegistrations = getSortedRegistrationsWithOfficers(
		businessVerificationDetails?.data?.registrations ?? [],
		businessVerificationDetails?.data?.people ?? [],
	);
	const sortedAddressSources = getSortedAddressSources(
		businessVerificationDetails?.data?.addressSources ?? [],
	);
	const tinReviewTask = reviewTasks.find((task) => task.key === "tin");
	const tinIsVerified = tinReviewTask?.status.toLocaleLowerCase() === "success";
	const hasActiveFiling = sortedRegistrations.some(
		(registration) => registration.status.toLocaleLowerCase() === "active",
	);
	const businessNameReviewTask = getBusinessReviewTask(reviewTasks);
	const businessNameIsVerified =
		businessNameReviewTask?.status.toLocaleLowerCase() === "success";
	const businessNameMatches = getBusinessNameMatches(reviewTasks, names);
	const businessNameBadgeLabel =
		businessNameReviewTask?.sublabel.toLocaleLowerCase() === "similar match"
			? "Possible Match"
			: businessNameReviewTask?.status.toLocaleLowerCase() === "success"
				? "Verified"
				: businessNameReviewTask?.status.toLocaleLowerCase() === "warning"
					? "Warning"
					: "Failure";
	const businessNameBadgeType: Ttype =
		businessNameBadgeLabel === "Verified"
			? "green_tick"
			: businessNameBadgeLabel === "Warning"
				? "warning"
				: businessNameBadgeLabel === "Possible Match"
					? "gray_exclamation_circle"
					: "red_exclamation_circle";
	const watchlistReviewTask = getWatchlistReviewTask(reviewTasks);
	const watchlistHits = getWatchlistHits(reviewTasks);
	const hasHits = isNonEmptyArray(watchlistHits);
	const registeredAgentReviewTask = getRegisteredAgentReviewTask(reviewTasks);
	const addressVerificationReviewTask =
		getAddressVerificationReviewTask(reviewTasks);
	const addressIsVerified =
		addressVerificationReviewTask?.status.toLocaleLowerCase() === "success";
	const addressBadgeLabel =
		addressVerificationReviewTask?.status.toLocaleLowerCase() === "success"
			? "Verified"
			: addressVerificationReviewTask?.status.toLocaleLowerCase() ===
						"warning" ||
				  registeredAgentReviewTask?.status.toLocaleLowerCase() === "warning"
				? "Warning"
				: "Failure";
	const addressBadgeType: Ttype =
		addressBadgeLabel === "Verified"
			? "green_tick"
			: addressBadgeLabel === "Warning"
				? "warning"
				: "red_exclamation_circle";

	return {
		isInitialDataLoading:
			// loading top-level business verification details
			isBusinessVerificationDetailsLoading ||
			// loading submit business verification order
			isSubmitBusinessVerificationOrderLoading,
		// finished loading business verification details
		isMissingVerificationDataAndHasNotSubmittedYet:
			!isBusinessVerificationDetailsLoading &&
			// no business verification details
			isNil(businessVerificationRecord) &&
			// no business verification order data
			isNil(submitBusinessVerificationOrderData),
		isVerificationOrderSubmittedAndPendingResults: isEmptyArray(reviewTasks),
		submitBusinessVerficationOrderAsync,
		businessVerificationDetailsError,
		submitBusinessVerificationOrderError,
		submitBusinessVerificationOrderSuccess,
		businessVerificationRecord,
		sortedRegistrations,
		sortedAddressSources,
		tinReviewTask,
		tinIsVerified,
		hasActiveFiling,
		businessNameReviewTask,
		businessNameIsVerified,
		businessNameMatches,
		businessNameBadgeLabel,
		businessNameBadgeType,
		registeredAgentReviewTask,
		addressVerificationReviewTask,
		addressIsVerified,
		addressBadgeLabel,
		addressBadgeType,
		watchlistReviewTask,
		watchlistHits,
		hasHits,
		// businessVerificationDetails,
		// isBusinessVerificationDetailsLoading,
		// submitBusinessVerificationOrderData,
		// isSubmitBusinessVerificationOrderLoading,
		// reviewTasks,
	};
};
