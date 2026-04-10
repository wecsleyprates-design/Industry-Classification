export const overrides: Record<string, { name: string; description: string }> =
	{
		CA30: {
			name: "Account Authenticated",
			description:
				"Valid name match, but multiple secondary data points (e.g. address or phone number) did not match. Synthetic identity or fraud possible",
		},
	};
