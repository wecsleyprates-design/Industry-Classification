import { normalizeS3EventFileKey } from "../s3EventKey";

describe("normalizeS3EventFileKey", () => {
	it("returns empty string unchanged", () => {
		expect(normalizeS3EventFileKey("")).toBe("");
	});

	it("turns plus-encoded spaces into spaces", () => {
		expect(normalizeS3EventFileKey("uuid/dropbox/my+file+name.csv")).toBe("uuid/dropbox/my file name.csv");
	});

	it("preserves literal plus via %2B after decode", () => {
		expect(normalizeS3EventFileKey("uuid/dropbox/my%2Bfile.csv")).toBe("uuid/dropbox/my+file.csv");
	});

	it("decodes other percent escapes", () => {
		expect(normalizeS3EventFileKey("path%2Fsegment")).toBe("path/segment");
	});

	it("applies plus-as-space together with percent decoding", () => {
		expect(normalizeS3EventFileKey("a%2Bb+c")).toBe("a+b c");
	});
});
