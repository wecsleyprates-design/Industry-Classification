import { unescapeHTMLEntities } from "../unescapeHTMLEntities";

describe("unescapeHTMLEntities", () => {
	test("should unescape double quote html entities", () => {
		/** Arrange */
		const input =
			"Olivia Banks updated seasonal_data.high_volume_months from [&quot;January&quot;,&quot;February&quot;,&quot;April&quot;] to [&quot;January&quot;,&quot;February&quot;,&quot;April&quot;,&quot;May&quot;].";
		const expected =
			'Olivia Banks updated seasonal_data.high_volume_months from ["January","February","April"] to ["January","February","April","May"].';

		/** Act */
		const result = unescapeHTMLEntities(input);

		/** Assert */
		expect(result).toBe(expected);
	});

	test("should unescape single quote html entities", () => {
		/** Arrange */
		const input =
			"A new Worth Score of 813 has been generated for Miami&#x27;s Pet Grooming (Mobile).";
		const expected =
			"A new Worth Score of 813 has been generated for Miami's Pet Grooming (Mobile).";

		/** Act */
		const result = unescapeHTMLEntities(input);

		/** Assert */
		expect(result).toBe(expected);
	});

	test("should unescape all supported html entities", () => {
		/** Arrange */
		const input = `&amp; &#38; &apos; &#x27; &#39; &quot; &#34;`;
		const expected = `& & ' ' ' " "`;

		/** Act */
		const result = unescapeHTMLEntities(input);

		/** Assert */
		expect(result).toBe(expected);
	});
});
