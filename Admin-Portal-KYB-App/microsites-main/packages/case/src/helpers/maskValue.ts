type MaskValueOptions = {
	lengthUnmasked?: number;
	lengthMasked?: number;
	maskCharacter?: string;
};

export const maskValue = (
	value: string,
	options: MaskValueOptions = {},
): string => {
	const {
		lengthUnmasked = 4,
		lengthMasked = 3,
		maskCharacter = "•",
	} = options;

	if (lengthUnmasked === 0) {
		return maskCharacter.repeat(lengthMasked);
	}
	const unmaskedDigits: string = value.slice(-lengthUnmasked);
	return `${maskCharacter.repeat(lengthMasked)}${unmaskedDigits}`;
};
