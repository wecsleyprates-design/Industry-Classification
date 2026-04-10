import React, { useEffect } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { v4 as uuidv4 } from "uuid";
import { useAsyncEffect } from "@/hooks/useAsyncEffect";
import useCustomToast from "@/hooks/useCustomToast";
import { useIsInternationalizationEnabled } from "@/hooks/useIsInternationalizationEnabled";
import { useOpenApplicantWebappWithInvite } from "@/hooks/useOpenApplicantWebappWithInvite";
import { isStatelessISO3166 } from "@/lib/assertions";
import { getItem } from "@/lib/localStorage";
import { normalizeCountryToISO3166, normalizeString } from "@/lib/utils";
import { useCreateBusiness } from "@/services/queries/businesses.query";
import { type CreateBusinessType } from "@/types/business";
import Modal from "../Modal";
import {
	StartApplicationForm,
	type StartApplicationSubmitValues,
} from "./StartApplicationForm";

import COUNTRIES from "@/constants/Countries";
import ERROR_MSG from "@/constants/ErrorMessages";
import { LOCALSTORAGE } from "@/constants/LocalStorage";

interface StartApplicationModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export const StartApplicationModal: React.FC<StartApplicationModalProps> = ({
	isOpen,
	onClose,
}) => {
	const customerId = getItem<string>(LOCALSTORAGE.customerId) ?? "";
	const applicantId = getItem<string>(LOCALSTORAGE.userId) ?? "";
	const { errorHandler: showErrorToast } = useCustomToast();

	const {
		isPending,
		mutateAsync: createBusiness,
		data: createBusinessData,
		error: createBusinessError,
		reset: resetCreateBusiness,
	} = useCreateBusiness();

	const openApplicantWebappWithInvite = useOpenApplicantWebappWithInvite();

	const onSubmit = async (data: StartApplicationSubmitValues) => {
		/** If country was not provided or could not be normalized to an ISO3166 code, default to the 'US' ISO3166 code. */
		const addressCountry =
			normalizeCountryToISO3166(data.country) ?? COUNTRIES.USA;
		const businessData: CreateBusinessType = {
			name: data.businessName,
			address_line_1: normalizeString(data.street),
			address_postal_code: normalizeString(data.zip),
			address_city: normalizeString(data.city),
			address_state: normalizeString(data.state),
			address_country: addressCountry,
			quick_add: true,
			...(data.skipCreditCheck && { skip_credit_check: data.skipCreditCheck }),
			...(data.bypassSSN && { bypass_ssn: data.bypassSSN }),
		};

		/** Only include DBA in the request if it is provided. */
		if (data.dbaName) businessData.dba1 = data.dbaName;
		/** Remove address_state for stateless countries. */
		if (isStatelessISO3166(businessData.address_country))
			delete businessData.address_state;

		await createBusiness({ customerId, body: [businessData], applicantId });
	};

	useAsyncEffect(async () => {
		const result = createBusinessData?.data?.result?.["0"];
		if (!result) return;

		const businessId = result?.data_businesses?.id;
		const caseId = result?.data_cases?.[0]?.id;

		if (!businessId) showErrorToast(ERROR_MSG.CREATE_BUSINESS_ERROR);
		if (!caseId) showErrorToast(ERROR_MSG.CREATE_CASE_ERROR);

		try {
			await openApplicantWebappWithInvite({
				caseId,
				customerId,
				params: { guest_owner_redirect: "/getting-started" },
			});

			/**
			 * Close the modal after the application is started.
			 */
			onClose();

			/**
			 * Reset the create business data to prevent this effect from running over and over.
			 */
			resetCreateBusiness();
		} catch (error) {
			showErrorToast(error);
		}
	}, [createBusinessData]);

	useEffect(() => {
		if (!createBusinessError) return;
		showErrorToast(createBusinessError);
		resetCreateBusiness();
	}, [createBusinessError]);

	const isInternationalizationEnabled =
		useIsInternationalizationEnabled(customerId);

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			cardColorClass="bg-white rounded-xl sm:max-w-[660px] p-0 m-0 sm:m-0 sm:p-0 overflow-visible"
		>
			<div className="flex justify-between items-center p-4 border-b border-gray-200">
				<h2 className="text-lg font-semibold text-gray-950">
					Start an Application
				</h2>
				<button onClick={onClose}>
					<XMarkIcon className="size-5" />
				</button>
			</div>
			<div className="p-4">
				<StartApplicationForm
					isLoading={isPending}
					isInternationalizationEnabled={isInternationalizationEnabled}
					onSubmit={onSubmit}
					onCancel={onClose}
				/>
			</div>
		</Modal>
	);
};
