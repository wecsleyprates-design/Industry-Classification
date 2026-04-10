import { getItem } from "@/lib/localStorage";
import { type Subrole } from "@/types/auth";

/** Matches notification-service / auth READ_SSN_DATA permission code */
export const READ_SSN_CASE_PERMISSION = "case:read:ssn_and_equivalents";

/** Customer subrole `code` from auth (localStorage `subrole`). Worth Admin often has none → "". */
export function getSubroleCodeForSsnKycDisplay(): string {
	const subrole = getItem<Subrole | null>("subrole");
	return subrole?.code?.trim() ?? "";
}

const ADMIN_SUBROLE_CODE = "admin";
const PRIVILEGED_SUBROLE_CODES_REQUIRING_FF = new Set([
	"cro",
	"owner",
	"risk_analyst",
]);

/**
 * Whether KYC Case Management may show SSN last four and the reveal (eye) control.
 *
 * Rules:
 * - **Worth platform admin** (`isPlatformAdmin`) or **subrole.code `admin`**: allow — **ignores** `BEST_87_SSN_ENCRYPTION`.
 * - Else if **FF off**: deny (full mask, no eye).
 * - Else if **FF on** and subrole is **`cro` | `owner` | `risk_analyst`**: allow.
 * - Else if **FF on** and any other subrole (including empty): allow only when **`hasReadSsnPermission`** (READ_SSN on custom role).
 */
export function shouldAllowSsnLastFourAndRevealInCase(options: {
	ssnEncryptionEnabled: boolean;
	isPlatformAdmin: boolean;
	subroleCode: string;
	hasReadSsnPermission: boolean;
}): boolean {
	const code = options.subroleCode.trim().toLowerCase();

	if (options.isPlatformAdmin || code === ADMIN_SUBROLE_CODE) {
		return true;
	}

	if (!options.ssnEncryptionEnabled) {
		return false;
	}

	if (PRIVILEGED_SUBROLE_CODES_REQUIRING_FF.has(code)) {
		return true;
	}

	return options.hasReadSsnPermission;
}

export function formatSsnKycDisplay(
	val: string,
	options: {
		ssnEncryptionEnabled: boolean;
		isPlatformAdmin: boolean;
		hasReadSsnPermission: boolean;
		valueNotAvailable: string;
		/** Override subrole code (e.g. unit tests); defaults to localStorage */
		subroleCode?: string | null;
	},
): string {
	const {
		ssnEncryptionEnabled,
		isPlatformAdmin,
		hasReadSsnPermission,
		valueNotAvailable,
	} = options;
	const subroleCode = options.subroleCode ?? getSubroleCodeForSsnKycDisplay();

	const allow = shouldAllowSsnLastFourAndRevealInCase({
		ssnEncryptionEnabled,
		isPlatformAdmin,
		subroleCode,
		hasReadSsnPermission,
	});

	if (!val) return valueNotAvailable;
	const digitsOnly = val.replace(/\D/g, "");
	if (!allow || digitsOnly.length < 4) {
		return "XXX-XX-XXXX";
	}
	return `XXX-XX-${digitsOnly.slice(-4)}`;
}

export function shouldShowSsnRevealEye(options: {
	ssnEncryptionEnabled: boolean;
	isPlatformAdmin: boolean;
	hasReadSsnPermission: boolean;
	subroleCode?: string | null;
}): boolean {
	const subroleCode = options.subroleCode ?? getSubroleCodeForSsnKycDisplay();

	return shouldAllowSsnLastFourAndRevealInCase({
		ssnEncryptionEnabled: options.ssnEncryptionEnabled,
		isPlatformAdmin: options.isPlatformAdmin,
		subroleCode,
		hasReadSsnPermission: options.hasReadSsnPermission,
	});
}
