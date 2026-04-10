import { parseCityFromPlaceResult } from "../parseCityFromPlaceResult";

type PlaceResult = Pick<
	google.maps.places.PlaceResult,
	"address_components" | "formatted_address" | "adr_address"
>;
type AddressComponent = google.maps.GeocoderAddressComponent;

const createAddressComponent = (
	longName: string,
	types: string[],
): AddressComponent => ({
	long_name: longName,
	short_name: longName,
	types,
});

const createPlaceResult = (
	overrides: Partial<PlaceResult> = {},
): PlaceResult => {
	const result: PlaceResult = {
		address_components: [],
		formatted_address: "",
		adr_address: "",
		...overrides,
	};
	return result;
};

describe("parseCityFromPlaceResult", () => {
	it("should return null when place is undefined", () => {
		// Arrange
		const place = undefined;

		// Act
		const result = parseCityFromPlaceResult(place);

		// Assert
		expect(result).toBeNull();
	});

	it("should return null when place has no address components", () => {
		// Arrange
		const place = createPlaceResult();

		// Act
		const result = parseCityFromPlaceResult(place);

		// Assert
		expect(result).toBeNull();
	});

	describe("locality (priority 1)", () => {
		it("should return locality when present", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("New York", ["locality", "political"]),
				],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("New York");
		});

		it("should return locality even when other fields are present", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("New York", ["locality", "political"]),
					createAddressComponent("Manhattan", ["sublocality", "political"]),
					createAddressComponent("Brooklyn", ["neighborhood", "political"]),
				],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("New York");
		});
	});

	describe("postal_town (priority 2)", () => {
		it("should return postal_town when locality is not present", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [createAddressComponent("London", ["postal_town"])],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("London");
		});

		it("should return postal_town for UK addresses", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("United Kingdom", ["country", "political"]),
					createAddressComponent("London", ["postal_town"]),
				],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("London");
		});
	});

	describe("adr_address parsing (priority 3)", () => {
		it("should parse city from adr_address when locality and postal_town are not present", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [],
				adr_address: '<span class="locality">San Francisco</span>',
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("San Francisco");
		});

		it("should not use adr_address when locality is present", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("New York", ["locality", "political"]),
				],
				adr_address: '<span class="locality">Wrong City</span>',
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("New York");
		});

		it("should handle adr_address with multiple spans", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [],
				adr_address:
					'<span class="street-address">123 Main St</span>, <span class="locality">Boston</span>, <span class="region">MA</span>',
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("Boston");
		});
	});

	describe("sublocality (priority 4, non-US only)", () => {
		it("should return sublocality for non-US addresses", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("Canada", ["country", "political"]),
					createAddressComponent("Downtown", ["sublocality", "political"]),
				],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("Downtown");
		});

		it("should return sublocality_level_1 for non-US addresses", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("France", ["country", "political"]),
					createAddressComponent("Montmartre", [
						"sublocality_level_1",
						"political",
					]),
				],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("Montmartre");
		});

		it("should prefer sublocality with political type", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("Germany", ["country", "political"]),
					createAddressComponent("Mitte", ["sublocality", "political"]),
					createAddressComponent("Other", ["sublocality"]),
				],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("Mitte");
		});

		it("should not return sublocality for US addresses", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("United States", ["country", "political"]),
					createAddressComponent("Manhattan", ["sublocality", "political"]),
				],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).not.toBe("Manhattan");
		});

		it("should fall through to neighborhood when US address has only sublocality", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("United States", ["country", "political"]),
					createAddressComponent("Manhattan", ["sublocality", "political"]),
					createAddressComponent("SoHo", ["neighborhood", "political"]),
				],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("SoHo");
		});

		it("should not return sublocality for US addresses (US variant)", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("US", ["country", "political"]),
					createAddressComponent("Manhattan", ["sublocality", "political"]),
				],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).not.toBe("Manhattan");
		});

		it("should not return sublocality for US addresses (USA variant)", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("USA", ["country", "political"]),
					createAddressComponent("Manhattan", ["sublocality", "political"]),
				],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).not.toBe("Manhattan");
		});

		it("should not return sublocality_level_1 for US addresses", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("United States", ["country", "political"]),
					createAddressComponent("Brooklyn", [
						"sublocality_level_1",
						"political",
					]),
				],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).not.toBe("Brooklyn");
		});

		it("should not return sublocality_level_1 for US addresses (US variant)", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("US", ["country", "political"]),
					createAddressComponent("Queens", [
						"sublocality_level_1",
						"political",
					]),
				],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).not.toBe("Queens");
		});

		it("should fall through to neighborhood when US address has only sublocality_level_1", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("United States", ["country", "political"]),
					createAddressComponent("Manhattan", [
						"sublocality_level_1",
						"political",
					]),
					createAddressComponent("SoHo", ["neighborhood", "political"]),
				],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("SoHo");
		});

		it("should fall through to formatted_address when US address has only sublocality_level_1 and no neighborhood", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("United States", ["country", "political"]),
					createAddressComponent("Manhattan", [
						"sublocality_level_1",
						"political",
					]),
				],
				formatted_address: "123 Main St, New York, NY, USA",
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("New York");
		});

		it("should return null when US address has only sublocality_level_1 and no fallback options", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("United States", ["country", "political"]),
					createAddressComponent("Manhattan", [
						"sublocality_level_1",
						"political",
					]),
				],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBeNull();
		});
	});

	describe("administrative_area_level_3 (priority 5, non-US only)", () => {
		it("should return aal3 for non-US addresses", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("Japan", ["country", "political"]),
					createAddressComponent("Shibuya", [
						"administrative_area_level_3",
						"political",
					]),
				],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("Shibuya");
		});

		it("should not return aal3 for US addresses", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("United States", ["country", "political"]),
					createAddressComponent("Manhattan", [
						"administrative_area_level_3",
						"political",
					]),
				],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).not.toBe("Manhattan");
		});

		it("should fall through to neighborhood when US address has only aal3", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("United States", ["country", "political"]),
					createAddressComponent("Manhattan", [
						"administrative_area_level_3",
						"political",
					]),
					createAddressComponent("SoHo", ["neighborhood", "political"]),
				],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("SoHo");
		});
	});

	describe("neighborhood (priority 6)", () => {
		it("should return neighborhood when present", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("SoHo", ["neighborhood", "political"]),
				],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("SoHo");
		});

		it("should return neighborhood for both US and non-US addresses", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("United States", ["country", "political"]),
					createAddressComponent("Greenwich Village", [
						"neighborhood",
						"political",
					]),
				],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("Greenwich Village");
		});
	});

	describe("administrative_area_level_2 and aal1 (priority 7, non-US only)", () => {
		it("should return aal2 for non-US addresses as fallback", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("France", ["country", "political"]),
					createAddressComponent("Paris", [
						"administrative_area_level_2",
						"political",
					]),
				],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("Paris");
		});

		it("should return aal1 for non-US addresses as last fallback", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("Australia", ["country", "political"]),
					createAddressComponent("New South Wales", [
						"administrative_area_level_1",
						"political",
					]),
				],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("New South Wales");
		});

		it("should prefer aal2 over aal1", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("Japan", ["country", "political"]),
					createAddressComponent("Tokyo", [
						"administrative_area_level_2",
						"political",
					]),
					createAddressComponent("Kanto", [
						"administrative_area_level_1",
						"political",
					]),
				],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("Tokyo");
		});

		it("should not return aal2 or aal1 for US addresses", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("United States", ["country", "political"]),
					createAddressComponent("New York", [
						"administrative_area_level_2",
						"political",
					]),
					createAddressComponent("New York", [
						"administrative_area_level_1",
						"political",
					]),
				],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).not.toBe("New York");
		});

		it("should fall through to neighborhood when US address has only aal2", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("United States", ["country", "political"]),
					createAddressComponent("New York", [
						"administrative_area_level_2",
						"political",
					]),
					createAddressComponent("SoHo", ["neighborhood", "political"]),
				],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("SoHo");
		});

		it("should fall through to formatted_address when US address has only aal1", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("United States", ["country", "political"]),
					createAddressComponent("New York", [
						"administrative_area_level_1",
						"political",
					]),
				],
				formatted_address: "123 Main St, Brooklyn, NY, USA",
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("Brooklyn");
		});
	});

	describe("formatted_address parsing (priority 8)", () => {
		it("should parse city from formatted_address when no other fields match", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [],
				formatted_address: "123 Main St, San Francisco, CA, USA",
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("San Francisco");
		});

		it("should parse city from formatted_address with 3+ comma-separated parts", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [],
				formatted_address: "Street, City, State, Country",
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("City");
		});

		it("should trim whitespace from parsed city", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [],
				formatted_address: "Street,  New York  , State, Country",
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("New York");
		});

		it("should not use formatted_address when fewer than 3 parts", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [],
				formatted_address: "Street, City",
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBeNull();
		});

		it("should not use formatted_address when locality is present", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("Boston", ["locality", "political"]),
				],
				formatted_address: "123 Main St, Wrong City, MA, USA",
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("Boston");
		});
	});

	describe("fallback order", () => {
		it("should follow correct priority order", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("United States", ["country", "political"]),
					createAddressComponent("New York", ["locality", "political"]),
					createAddressComponent("Manhattan", ["sublocality", "political"]),
					createAddressComponent("SoHo", ["neighborhood", "political"]),
				],
				formatted_address: "123 Main St, Wrong City, NY, USA",
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("New York");
		});

		it("should fall through priorities correctly", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [
					createAddressComponent("Canada", ["country", "political"]),
					createAddressComponent("Downtown", ["sublocality", "political"]),
				],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBe("Downtown");
		});
	});

	describe("edge cases", () => {
		it("should handle empty address_components array", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBeNull();
		});

		it("should handle null address_components", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: undefined,
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBeNull();
		});

		it("should handle empty adr_address", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [],
				adr_address: "",
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBeNull();
		});

		it("should handle adr_address without locality span", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [],
				adr_address: '<span class="street-address">123 Main St</span>',
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBeNull();
		});

		it("should handle empty formatted_address", () => {
			// Arrange
			const place = createPlaceResult({
				address_components: [],
				formatted_address: "",
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBeNull();
		});

		it("should handle components with missing long_name", () => {
			// Arrange
			const component = createAddressComponent(undefined as unknown as string, [
				"locality",
				"political",
			]);
			const place = createPlaceResult({
				address_components: [component],
			});

			// Act
			const result = parseCityFromPlaceResult(place);

			// Assert
			expect(result).toBeNull();
		});
	});
});
