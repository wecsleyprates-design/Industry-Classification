import { useEffect, useState } from "react";
import WarningModal from "@/components/Modal/WarningModal";
import { useCustomToast } from "@/hooks/useCustomToast";
import { useUpdateRiskMonitoring } from "@/services/queries/businesses.query";
import RiskMonitoringToggle from "./RiskMonitoringToggle";

type Props = {
	business: any;
	customerRiskMonitoringEnabled: boolean;
};

const BusinessRiskToggleCell: React.FC<Props> = ({
	business,
	customerRiskMonitoringEnabled,
}) => {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [pendingValue, setPendingValue] = useState<boolean>(
		business.is_monitoring_enabled,
	);
	const [currentValue, setCurrentValue] = useState<boolean>(
		business.is_monitoring_enabled,
	);

	// Sync state with prop changes when business data is updated from parent
	useEffect(() => {
		setCurrentValue(business.is_monitoring_enabled);
		setPendingValue(business.is_monitoring_enabled);
	}, [business.is_monitoring_enabled]);

	const { mutateAsync: updateRiskMonitoring } = useUpdateRiskMonitoring();
	const { successToast, errorToast } = useCustomToast();

	const handleToggleClick = (newValue: boolean) => {
		setPendingValue(newValue);
		setIsModalOpen(true);
	};

	const handleConfirm = async () => {
		try {
			await updateRiskMonitoring({
				businessId: business.id,
				customerId: business.customer_id,
				body: { risk_monitoring: pendingValue },
			});

			setCurrentValue(pendingValue);

			successToast(
				`Risk monitoring ${
					pendingValue ? "enabled" : "disabled"
				} successfully`,
			);
		} catch (err) {
			errorToast(err);
		} finally {
			setIsModalOpen(false);
		}
	};

	return (
		<>
			<RiskMonitoringToggle
				value={currentValue}
				customerRiskMonitoringEnabled={customerRiskMonitoringEnabled}
				onChange={() => {
					handleToggleClick(!currentValue);
				}}
			/>
			{isModalOpen && (
				<WarningModal
					isOpen={isModalOpen}
					onClose={() => {
						setIsModalOpen(false);
					}}
					onSuccess={handleConfirm}
					title="Confirmation"
					description={`Do you want to ${
						pendingValue ? "enable" : "disable"
					} risk monitoring on this business?`}
					buttonText="Yes"
					type="dark"
				/>
			)}
		</>
	);
};

export default BusinessRiskToggleCell;
