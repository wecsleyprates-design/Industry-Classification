import Joi from "joi";
import { validateSchema } from "../validation.middleware";

describe("validateSchema middleware", () => {
	it("strips null bytes from params/query/body and preserves file buffers", () => {
		const fileBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00]); // PDF header + null byte

		const req: any = {
			params: { caseID: "abc\x00123" },
			query: { search: "foo\x00bar" },
			body: { name: "john\x00doe" },
			files: [
				{
					buffer: fileBuffer,
					originalname: "test.pdf",
					mimetype: "application/pdf",
					size: fileBuffer.length
				}
			]
		};
		const res: any = {};
		const next = jest.fn();

		const schema = {
			params: Joi.object({
				caseID: Joi.string().required()
			}),
			query: Joi.object({
				search: Joi.string().required()
			}),
			body: Joi.object({
				name: Joi.string().required()
			}),
			files: Joi.array()
				.items(
					Joi.object({
						buffer: Joi.binary().required(),
						originalname: Joi.string().required(),
						mimetype: Joi.string().required(),
						size: Joi.number().required()
					})
				)
				.required()
		};

		validateSchema(schema)(req, res, next);

		expect(next).toHaveBeenCalledTimes(1);
		expect(req.params.caseID).toBe("abc123");
		expect(req.query.search).toBe("foobar");
		expect(req.body.name).toBe("johndoe");
		expect(Buffer.isBuffer(req.files[0].buffer)).toBe(true);
		expect(req.files[0].buffer.equals(fileBuffer)).toBe(true);
	});
});
