import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { FormProvider, useFormContext } from "react-hook-form";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { useFlags } from "launchdarkly-react-client-sdk";
import { InfoIcon } from "lucide-react";
import { EquifaxErrorTooltip } from "@/components/EquifaxErrorTooltip";
import { useGetOnboardingSetupConfig } from "@/hooks";
import { useCaseEditPermission } from "@/hooks/useCaseEditPermission";
import { usePermission } from "@/hooks/usePermission";
import { useGetDecryptSSN } from "@/services/queries/case.query";
import {
	useGetEquifax,
	useGetEquifaxCreditReport,
} from "@/services/queries/integration.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { useInlineEditStore } from "@/store/useInlineEditStore";
import {
	type BusinessApplicantVerificationResponse,
	type RiskCheckResult,
} from "@/types/businessEntityVerification";
import { type Owner } from "@/types/case";
import { type RiskStatus } from "@/types/risk";
import { CardList } from "../../../components/CardList";
import {
	CardListItem,
	type CardListItemProps,
} from "../../../components/CardListItem";
import { useOverrideUsers } from "../../../hooks/useOverrideUsers";
import {
	IDV_DEPENDENT_FIELDS,
	shouldInvalidateIdv,
} from "../config/OverviewTab/fieldRelationships";
import { useOwnerTitleOptions } from "../constants/OverviewTab/fieldOptions";
import {
	useOverviewFieldRenderer,
	useOverviewTabData,
	useOverviewTabEditState,
	useOverviewTabForm,
} from "../hooks/OverviewTab";
import { type OverviewTabFieldKey } from "../schemas/OverviewTab/overviewTabSchema";
import { IdentityDocuments } from "./IdentityDocuments";
import { RiskCheckResultStatusBadge } from "./RiskCheckResultStatusBadge";
import { VantageScoreLink } from "./VantageScoreLink";

import {
	EQUIFAX_TOOLTIP_ERROR,
	VALUE_NOT_AVAILABLE,
	VANTAGE_SCORE_NOT_AVAILABLE,
} from "@/constants";
import { formatSSN } from "@/helpers/case";
import {
	formatSsnKycDisplay,
	READ_SSN_CASE_PERMISSION,
	shouldShowSsnRevealEye,
} from "@/helpers/ssnKycDisplay";

/**
 * Warning message shown when identity verification data is outdated
 * due to inline edits to owner information.
 */
const StaleIdentityVerificationMessage: React.FC = () => (
	<div className="flex items-start gap-3 p-4 rounded-md bg-amber-50 border border-amber-200 text-amber-800 mt-4">
		<InfoIcon className="h-5 w-5 mt-0.5 shrink-0" />
		<div>
			<p className="font-medium">Identity verification is outdated.</p>
			<p className="text-sm mt-1 text-amber-700">
				Recent edits have invalidated identity verification. Click
				&quot;Re-Run Integrations&quot; to verify with the updated data.
			</p>
		</div>
	</div>
);

/**
 * Wrapper for the SSN EditableField that adds an eye toggle button.
 * Keeps the EditableField always mounted (preserving edit capability)
 * and toggles between masked/revealed display via the eye button.
 *
 * When the SSN has NOT been revealed, entering edit mode clears the input
 * so the masked value is never exposed in a text field.
 * When the SSN HAS been revealed (via the eye icon / decrypt API), the
 * decrypted value is populated into the form for editing.
 */
const SsnFieldWrapper: React.FC<{
	/** The EditableField element for the SSN */
	children: React.ReactNode;
	/** Async function to fetch the decrypted SSN from the API */
	getDecryptedValue: () => Promise<string | undefined>;
	/** Whether the SSN is decryptable (controls eye button visibility) */
	isDecryptable: boolean;
}> = ({ children, getDecryptedValue, isDecryptable }) => {
	const [revealed, setRevealed] = useState(false);
	const [decryptedValue, setDecryptedValue] = useState<string | null>(null);
	const [isChildEditing, setIsChildEditing] = useState(false);
	const { setValue } = useFormContext();

	const handleToggle = useCallback(async () => {
		if (!decryptedValue) {
			const decrypted = await getDecryptedValue();
			if (decrypted) {
				setDecryptedValue(decrypted);
				setRevealed(true);
				setValue("ssn", decrypted, { shouldDirty: false });
			}
		} else {
			setRevealed((prev) => !prev);
		}
	}, [decryptedValue, getDecryptedValue, setValue]);

	const enhancedChild = React.isValidElement(children)
		? React.cloneElement(
				children as React.ReactElement<Record<string, unknown>>,
				{
					clearEditValue: !decryptedValue,
					onEditingChange: setIsChildEditing,
				},
			)
		: children;

	return (
		<div className="flex items-center gap-2">
			{!isChildEditing && revealed && decryptedValue ? (
				<span className="text-sm text-gray-900">{decryptedValue}</span>
			) : (
				enhancedChild
			)}
			{isDecryptable && (
				<div
					onClick={handleToggle}
					onMouseDown={(e) => e.stopPropagation()}
					className="flex items-center cursor-pointer shrink-0"
				>
					{revealed ? (
						<EyeIcon
							className="w-5 h-5 text-blue-600"
							aria-hidden="true"
						/>
					) : (
						<EyeSlashIcon
							className="w-5 h-5 text-blue-600"
							aria-hidden="true"
						/>
					)}
				</div>
			)}
		</div>
	);
};

export interface OverviewReportProps {
	owner: Owner | null;
	businessId: string;
	customerId: string;
	riskCheckResult:
		| Pick<
				RiskCheckResult,
				"name" | "dob" | "ssn" | "address" | "phone" | "email"
		  >
		| undefined;
	isLoadingRiskCheckResult?: boolean;
	caseId: string;
	verificationData?: BusinessApplicantVerificationResponse;
}

export const OverviewReport: React.FC<OverviewReportProps> = ({
	owner,
	businessId,
	customerId,
	riskCheckResult,
	isLoadingRiskCheckResult,
	caseId,
	verificationData,
}) => {
	const ownerId = owner?.id ?? "";
	const displayBadges = usePermission("case:read:badge_display");
	const flags = useFlags();
	const ssnEncryptionEnabled = Boolean(flags.BEST_87_SSN_ENCRYPTION);
	const platformType = useAppContextStore((s) => s.platformType);
	const hasReadSsnPermission = usePermission(READ_SSN_CASE_PERMISSION);
	const isPlatformAdmin = platformType === "admin";

	const formatSsnForKyc = useCallback(
		(val: string) =>
			formatSsnKycDisplay(val, {
				ssnEncryptionEnabled,
				isPlatformAdmin,
				hasReadSsnPermission,
				valueNotAvailable: VALUE_NOT_AVAILABLE,
			}),
		[ssnEncryptionEnabled, isPlatformAdmin, hasReadSsnPermission],
	);

	// Check editing permissions
	const canEdit = useCaseEditPermission();

	// Fetch owner titles from API for dropdown
	const { options: titleOptions, getTitleByName } = useOwnerTitleOptions();

	// Fetch all data and extract original values (uses KYC facts API)
	// The returned 'owner' is merged with KYC facts data (facts take priority)
	const {
		originalValues,
		loadingStates,
		guestOwnerEdits,
		allOwners,
		owner: mergedOwner,
		ownersSubmittedOverrideInfo,
		fieldOverridesMap,
		factsDataSources,
	} = useOverviewTabData({
		owner,
		businessId,
		ownerId,
		isLoading: false,
	});

	const userNameMap = useOverrideUsers(factsDataSources);

	// Initialize react-hook-form with data
	// Use loadingStates.owner which includes KYC facts API loading state
	// This ensures the form initializes with override data, not just the owner prop
	const { form, isFieldDirty, isAnyFieldDirty, getOriginalValue } =
		useOverviewTabForm({
			originalValues,
			isLoading: loadingStates.owner,
		});

	// Manage edit state (save status tracking and fact override handler)
	// Note: requires full owners array since override API expects complete fact value
	const { getSaveStatus, handleEditComplete, resetAllSaveStatuses } =
		useOverviewTabEditState({
			businessId,
			ownerId,
			caseId,
			currentOwners: allOwners,
			getTitleByName,
		});

	// Watch for when editedFacts is cleared (after re-run integrations)
	// and reset the "Updated" badges on fields
	const { editedFacts } = useInlineEditStore(caseId);

	// Filter editedFacts to only this owner's edits (keys are prefixed with "ownerId:")
	const ownerEditedFacts = useMemo(() => {
		const prefix = `${ownerId}:`;
		return editedFacts
			.filter((f) => f.startsWith(prefix))
			.map((f) => f.slice(prefix.length));
	}, [editedFacts, ownerId]);

	const prevEditedFactsLength = useRef(ownerEditedFacts.length);
	useEffect(() => {
		// If editedFacts went from having items to being empty, reset save statuses
		if (
			prevEditedFactsLength.current > 0 &&
			ownerEditedFacts.length === 0
		) {
			resetAllSaveStatuses();
		}
		prevEditedFactsLength.current = ownerEditedFacts.length;
	}, [ownerEditedFacts.length, resetAllSaveStatuses]);

	// Build validation context for cumulative ownership validation
	const validationContext = useMemo(
		() => ({
			allOwners: allOwners as Array<{
				id: string;
				ownership_percentage?: number | null;
			}>,
			currentOwnerId: ownerId,
		}),
		[allOwners, ownerId],
	);

	// Render fields from configs
	// Use mergedOwner (KYC facts merged with original owner) for field configs
	// Pass dynamic title options from API as suggestion overrides
	const { overviewDetails } = useOverviewFieldRenderer({
		owner: mergedOwner,
		loadingStates,
		canEdit,
		getSaveStatus,
		handleEditComplete,
		guestOwnerEdits,
		isFieldDirty,
		getOriginalValue,
		suggestionOverrides: {
			title: titleOptions,
		},
		validationContext,
		ownersSubmittedOverrideInfo,
		internallyEditedFields: ownerEditedFacts,
		userNameMap,
		ownerId,
		fieldOverridesMap,
		ssnFormatDisplayValue: formatSsnForKyc,
	});

	// Compute dirty state values for dependency tracking
	const isDirty = isAnyFieldDirty();

	// Check if any IDV field is currently dirty in the form (immediate feedback)
	// or has been saved (persisted in ownerEditedFacts).
	const isAnyIdvFieldDirty = IDV_DEPENDENT_FIELDS.some((field) =>
		isFieldDirty(field as OverviewTabFieldKey),
	);
	const isIdentityVerificationStale =
		shouldInvalidateIdv(ownerEditedFacts) || isAnyIdvFieldDirty;

	const equifaxOnboardingSetupConfig = useGetOnboardingSetupConfig(
		customerId,
		"equifax_credit_score_setup",
	);

	const { mutateAsync: fetchDecryptSsn } = useGetDecryptSSN();

	const isEquifaxCreditScoreSetupEnabled =
		equifaxOnboardingSetupConfig?.is_enabled ?? false;
	const { data: equifaxCreditReport } = useGetEquifaxCreditReport(
		businessId,
		caseId,
	);
	const { data: equifaxCustomerBusinessOwnerScores } = useGetEquifax({
		customerId,
		businessId,
		caseId,
	});

	// VantageScore item - read-only, cleared when any KYC field is dirty
	const vantageScoreItem = useMemo(() => {
		if (!isEquifaxCreditScoreSetupEnabled) return null;

		const hasKycFieldEdits = isDirty;

		const equifaxVantageScore = equifaxCustomerBusinessOwnerScores?.data?.[
			ownerId
		]?.filter((item: { score?: number }) => item.score)?.[0]?.score;
		const equifaxReportUrl =
			equifaxCreditReport?.data?.[ownerId]?.signedRequest;
		const equifaxError = equifaxCustomerBusinessOwnerScores?.data?.[
			ownerId
		]?.filter((item: { error?: number }) => item.error != null)?.[0]?.error;

		// If any KYC field is dirty, show cleared value
		if (hasKycFieldEdits) {
			return {
				label: "VantageScore® 4.0",
				value: (
					<span className="text-blue-600">
						{VANTAGE_SCORE_NOT_AVAILABLE}
					</span>
				),
				metadata: undefined,
			};
		}

		return {
			label: "VantageScore® 4.0",
			value: equifaxVantageScore ? (
				<VantageScoreLink
					score={equifaxVantageScore}
					url={equifaxReportUrl}
				/>
			) : (
				<span className="text-blue-600">
					{VANTAGE_SCORE_NOT_AVAILABLE}
				</span>
			),
			tooltip: !equifaxVantageScore
				? equifaxError
					? (() => {
							// Handle array of error objects (direct array from backend)
							if (Array.isArray(equifaxError)) {
								return (
									<EquifaxErrorTooltip
										errors={equifaxError}
									/>
								);
							}

							// Handle structured error object with unified errors array
							if (
								typeof equifaxError === "object" &&
								equifaxError !== null &&
								equifaxError.errors
							) {
								return (
									<EquifaxErrorTooltip
										errors={equifaxError.errors}
									/>
								);
							}

							// Fallback for string errors
							return `${equifaxError}`;
						})()
					: EQUIFAX_TOOLTIP_ERROR
				: undefined,
			...(!equifaxVantageScore
				? { metadata: "error" as RiskStatus }
				: {}),
		};
	}, [
		isEquifaxCreditScoreSetupEnabled,
		equifaxCreditReport,
		equifaxCustomerBusinessOwnerScores,
		ownerId,
		isDirty,
	]);

	// Map risk check results to field keys
	// When ANY IDV field is stale (edited or dirty), the entire verification is
	// invalidated — clear ALL match badges, not just the specific field's badge.
	const riskCheckResultMap: Record<string, RiskStatus | undefined> = useMemo(
		() =>
			isIdentityVerificationStale
				? {
						first_name: undefined,
						last_name: undefined,
						date_of_birth: undefined,
						ssn: undefined,
						home_address: undefined,
						mobile: undefined,
						email: undefined,
					}
				: {
						first_name: riskCheckResult?.name,
						last_name: riskCheckResult?.name,
						date_of_birth: riskCheckResult?.dob,
						ssn: riskCheckResult?.ssn,
						home_address: riskCheckResult?.address?.summary,
						mobile: riskCheckResult?.phone?.summary,
						email: undefined,
					},
		[riskCheckResult, isIdentityVerificationStale],
	);

	const documents = verificationData?.data?.documents ?? [];

	// Build final detail items combining editable fields with badges
	const detailItems: Array<CardListItemProps & { fieldKey?: string }> =
		useMemo(() => {
			const fieldKeyMap = [
				"first_name",
				"last_name",
				"date_of_birth",
				"ssn",
				"home_address",
				"mobile",
				"email",
				"title",
				"ownership_percentage",
			];

			return overviewDetails.map((detail, index) => ({
				...detail,
				fieldKey: fieldKeyMap[index],
			}));
		}, [overviewDetails]);

	const showSsnRevealEye = shouldShowSsnRevealEye({
		ssnEncryptionEnabled,
		isPlatformAdmin,
		hasReadSsnPermission,
	});
	const getDecryptedSsn = useCallback(async () => {
		const res = await fetchDecryptSsn({
			customerId,
			caseId,
			query: { ownerID: ownerId, businessID: businessId },
		});
		if (res?.data.ssn) {
			return formatSSN(res.data.ssn);
		}
	}, [fetchDecryptSsn, customerId, caseId, ownerId, businessId]);

	return (
		<FormProvider {...form}>
			<CardList>
				{detailItems.map((item, index) => (
					<CardListItem
						key={index}
						label={item.label}
						value={
							item.fieldKey === "ssn" ? (
								<SsnFieldWrapper
									getDecryptedValue={getDecryptedSsn}
									isDecryptable={showSsnRevealEye}
								>
									{item.value}
								</SsnFieldWrapper>
							) : (
								item.value
							)
						}
						badge={
							displayBadges &&
							item.fieldKey &&
							riskCheckResultMap[item.fieldKey] !== undefined ? (
								<RiskCheckResultStatusBadge
									status={riskCheckResultMap[item.fieldKey]}
									value={item.value}
									loading={isLoadingRiskCheckResult}
								/>
							) : null
						}
						fieldSource={item.fieldSource}
					/>
				))}
				{vantageScoreItem && (
					<CardListItem
						label={vantageScoreItem.label}
						value={vantageScoreItem.value}
						badge={
							displayBadges && vantageScoreItem.metadata ? (
								<RiskCheckResultStatusBadge
									status={vantageScoreItem.metadata}
									value={vantageScoreItem.value}
									tooltip={vantageScoreItem.tooltip}
									loading={isLoadingRiskCheckResult}
								/>
							) : null
						}
					/>
				)}
			</CardList>
			{isIdentityVerificationStale && (
				<StaleIdentityVerificationMessage />
			)}
			<IdentityDocuments
				documents={documents}
				businessId={businessId}
				ownerId={ownerId}
				caseId={caseId}
			/>
		</FormProvider>
	);
};
