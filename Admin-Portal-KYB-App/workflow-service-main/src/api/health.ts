import { Request, Response, NextFunction } from "express";
import { pkgConfig } from "../configs";

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check
 *     description: Check the health status of the Workflow Service
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       description: Application name
 *                     version:
 *                       type: string
 *                       description: Application version
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                       description: Current timestamp
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
export const getHealth = (req: Request, res: Response, next: NextFunction) => {
	try {
		res.jsend.success({
			name: pkgConfig.APP_NAME,
			version: pkgConfig.APP_VERSION,
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		next(error);
	}
};
