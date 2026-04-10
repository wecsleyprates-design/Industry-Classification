import {
	ArchiveBoxIcon,
	CheckCircleIcon,
	EllipsisHorizontalCircleIcon,
	ExclamationCircleIcon,
	ExclamationTriangleIcon,
	XCircleIcon,
} from "@heroicons/react/24/outline";

import { CASE_STATUS_ENUM } from "@/constants/case-status";
import { transformStatusLabel } from "@/helpers/case";

export function StatusDisplay({ statusCode }: { statusCode?: string }) {
	if (!statusCode) {
		return null;
	}
	const successStatuses = [
		CASE_STATUS_ENUM.MANUALLY_APPROVED,
		CASE_STATUS_ENUM.AUTO_APPROVED,
	];
	const errorStatuses = [
		CASE_STATUS_ENUM.AUTO_REJECTED,
		CASE_STATUS_ENUM.MANUALLY_REJECTED,
	];
	const warningStatuses = [
		CASE_STATUS_ENUM.RISK_ALERT,
		CASE_STATUS_ENUM.ESCALATED,
	];
	const infoStatuses = [
		CASE_STATUS_ENUM.UNDER_MANUAL_REVIEW,
		CASE_STATUS_ENUM.INFORMATION_REQUESTED,
		CASE_STATUS_ENUM.PAUSED,
		CASE_STATUS_ENUM.INVESTIGATING,
	];
	const dismissedStatuses = [CASE_STATUS_ENUM.DISMISSED];
	const archivedStatuses = [CASE_STATUS_ENUM.ARCHIVED];

	const StatusIcon = ({ statusCode }: { statusCode: CASE_STATUS_ENUM }) => {
		if (successStatuses.includes(statusCode)) {
			return <CheckCircleIcon className="size-5 text-green-600" />;
		} else if (errorStatuses.includes(statusCode)) {
			return <ExclamationCircleIcon className="size-5 text-red-600" />;
		} else if (warningStatuses.includes(statusCode)) {
			return (
				<ExclamationTriangleIcon className="size-5 text-yellow-600" />
			);
		} else if (infoStatuses.includes(statusCode)) {
			return (
				<EllipsisHorizontalCircleIcon className="size-5 text-blue-600" />
			);
		} else if (archivedStatuses.includes(statusCode)) {
			return <ArchiveBoxIcon className="size-5 text-gray-600" />;
		} else if (dismissedStatuses.includes(statusCode)) {
			return <XCircleIcon className="size-5 text-gray-600" />;
		}
		// any other status defaults to the blue ellipsis
		return (
			<EllipsisHorizontalCircleIcon className="size-5 text-blue-600" />
		);
	};

	return (
		<div className="flex items-center gap-2 bg-transparent p-0">
			<StatusIcon statusCode={statusCode as CASE_STATUS_ENUM} />
			{transformStatusLabel(statusCode)}
		</div>
	);
}
