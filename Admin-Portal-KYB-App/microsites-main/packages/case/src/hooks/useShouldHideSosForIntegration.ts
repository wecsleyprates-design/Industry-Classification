import { useEffect, useMemo, useRef, useState } from "react";
import {
	INTEGRATION_STATUS,
	type IntegrationStatus,
} from "@/hooks/useReRunIntegrationsForEditedFacts";

import { envConfig } from "@/config/envConfig";

/**
 * Hide SOS block while integrations are running or re-run is in flight.
 * After VITE_SOS_INTEGRATION_FALLBACK_TIME ms (if > 0), stop hiding so KYB data  still shows if the case flag never flips to complete.
 */
export function useShouldHideSosForIntegration(
	integrationStatus?: IntegrationStatus,
	isPending?: boolean,
): boolean {
	const fallbackMs = useMemo(() => {
		const raw = envConfig.VITE_SOS_INTEGRATION_FALLBACK_TIME;
		const parsed = Number(raw);
		if (
			raw === undefined ||
			raw === "" ||
			!Number.isFinite(parsed) ||
			parsed <= 0
		) {
			return 0;
		}
		return parsed;
	}, []);

	const wantHide =
		isPending === true ||
		integrationStatus === INTEGRATION_STATUS.TRIGGERING ||
		integrationStatus === INTEGRATION_STATUS.RUNNING;

	const hideStartedAtRef = useRef<number | null>(null);
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		if (!wantHide) {
			hideStartedAtRef.current = null;
			return;
		}
		if (hideStartedAtRef.current === null) {
			hideStartedAtRef.current = Date.now();
		}
	}, [wantHide]);

	useEffect(() => {
		if (!wantHide || fallbackMs <= 0) return;
		const id = window.setInterval(() => {
			setNow(Date.now());
		}, 1000);
		return () => {
			window.clearInterval(id);
		};
	}, [wantHide, fallbackMs]);

	if (integrationStatus === undefined && isPending === undefined) {
		return false;
	}

	if (!wantHide) return false;

	if (fallbackMs > 0 && hideStartedAtRef.current !== null) {
		if (now - hideStartedAtRef.current >= fallbackMs) {
			return false;
		}
	}

	return true;
}
