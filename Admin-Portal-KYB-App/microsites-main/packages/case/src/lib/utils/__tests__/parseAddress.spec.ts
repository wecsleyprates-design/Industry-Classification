import { parseAddress, parseAddressManually } from "../parseAddress";

describe("parseAddress", () => {
	it("should parse a valid address string", () => {
		const address = "328 S Orange Ave, Unit 100, Orlando, FL 32801, USA";
		const result = parseAddress(address);
		expect(result).toEqual({
			line_1: "328 S Orange Ave",
			apartment: "Unit 100",
			city: "Orlando",
			state: "FL",
			postal_code: "32801",
			country: "USA",
		});
	});

	it("should default country to US if not provided", () => {
		const address = "100 Main St, New York, NY";
		const result = parseAddress(address);
		expect(result).toEqual({
			line_1: "100 Main St",
			apartment: null,
			city: "New York",
			state: "NY",
			postal_code: null,
			country: "US",
		});
	});

	it("should use the country code if it is not the same as the state abbreviation", () => {
		const address = "27 Herbert Road, London, SW19 3RS, UK";
		const result = parseAddress(address);
		expect(result).toEqual({
			line_1: "27 Herbert Road",
			apartment: null,
			city: "London",
			state: null,
			postal_code: "SW19 3RS",
			country: "UK",
		});
	});
});

describe("parseAddressManually", () => {
	it.each([
		{
			input: "123 Main St, Chicago, Illinois, 60601",
			expected: {
				line_1: "123 Main St",
				apartment: null,
				city: "Chicago",
				state: "IL",
				postal_code: "60601",
				country: "US",
			},
		},
		{
			input: "100 Oak Ave, Unit 2, Denver, Colorado, 80202",
			expected: {
				line_1: "100 Oak Ave",
				apartment: "Unit 2",
				city: "Denver",
				state: "CO",
				postal_code: "80202",
				country: "US",
			},
		},
		{
			input: "328 N Orange Ave, Orlando, FL 32801",
			expected: {
				line_1: "328 N Orange Ave",
				apartment: null,
				city: "Orlando",
				state: "FL",
				postal_code: "32801",
				country: "US",
			},
		},
		{
			input: "47 E Robinson St Unit 100, Orlando, FL 32801",
			expected: {
				line_1: "47 E Robinson St",
				apartment: "Unit 100",
				city: "Orlando",
				state: "FL",
				postal_code: "32801",
				country: "US",
			},
		},
	])("parses $input", ({ input, expected }) => {
		const result = parseAddressManually(input);
		expect(result).toEqual(expected);
	});
});
