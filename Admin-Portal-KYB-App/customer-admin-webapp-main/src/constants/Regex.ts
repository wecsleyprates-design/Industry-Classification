const REGEX = {
	EMAIL:
		/^(([^<>()\]\\.,;:\s@"]+(\.[^<>()\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
	PASSWORD: /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,20}$/,
	ONLY_NUMBERS: /^[0-9]*$/,
	MOBILE_WITH_BRACKETS: /^\(\d{3}\) \d{3}-\d{4}$/,
	CANADA_POSTAL_CODE:
		/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] ?\d[ABCEGHJ-NPRSTV-Z]\d$/,
	UK_POSTAL_CODE: /^([A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})$/,
	NEW_CASES_ROUTE: /^(?!\/businesses\/[^/]+\/cases\/[^/]+$)\/cases(\/.*)?$/,
	UK_UTR: /^\d{10}$/, // UTR: 10-digit Unique Taxpayer Reference
	UK_NONO: /^[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]?$/, // NINO: 2 prefix letters (excluding some), 6 digits, optional suffix (A–D)
	UK_CRN: /^(\d{8}|[A-Z]{2}\d{6})$/, // CRN: 8 digits or 2 letters followed by 6 digits
	UK_VAT: /^(GB)?\d{9}(\d{3})?$/, // VAT: Optional 'GB' prefix, 9 digits, optional 3-digit branch suffix
};

export default REGEX;
