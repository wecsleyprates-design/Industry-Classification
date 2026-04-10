// plopfile.ts
import type { NodePlopAPI } from "plop";

export default function (plop: NodePlopAPI) {
	plop.setHelper("openApiPath", path => {
		// eslint-disable-next-line require-unicode-regexp
		return path.replace(/:([a-zA-Z0-9_]+)/g, (_, match) => `{${match}}`);
	});

	// controller generator
	plop.setGenerator("module", {
		description: "Create a new module",
		prompts: [
			{
				type: "input",
				name: "name",
				message: `Please enter module name
Example

test-module
testmodule
: `
			}
		],
		actions: () => {
			const actionsArray: any = [
				{
					path: "src/api/v1/modules/{{kebabCase name}}/controller.ts",
					templateFile: ".templates/module/controller.ts.hbs"
				},
				{
					path: "src/api/v1/modules/{{kebabCase name}}/error.ts",
					templateFile: ".templates/module/error.ts.hbs"
				},
				{
					path: "src/api/v1/modules/{{kebabCase name}}/routes.ts",
					templateFile: ".templates/module/routes.ts.hbs"
				},
				{
					path: "src/api/v1/modules/{{kebabCase name}}/repository.ts",
					templateFile: ".templates/module/repository.ts.hbs"
				},
				{
					path: "src/api/v1/modules/{{kebabCase name}}/schema.ts",
					templateFile: ".templates/module/schema.ts.hbs"
				},
				{
					path: "src/api/v1/modules/{{kebabCase name}}/types.ts",
					templateFile: ".templates/module/types.ts.hbs"
				},
				{
					path: "src/api/v1/modules/{{kebabCase name}}/__tests__/{{kebabCase name}}.spec.ts",
					templateFile: ".templates/module/__tests__/service.spec.ts.hbs"
				},
				{
					path: "src/api/v1/modules/{{kebabCase name}}/{{kebabCase name}}.ts",
					templateFile: ".templates/module/service.ts.hbs"
				},
				{
					path: "src/api/v1/modules/{{kebabCase name}}/openapi.ts",
					templateFile: ".templates/module/openapi.ts.hbs"
				}
			];

			actionsArray.forEach(action => {
				action.type = "add";
				action.skipIfExists = true;
			});

			actionsArray.push({
				type: "append",
				path: "src/api/v1/index.js",
				pattern: 'import { Router } from "express";',
				template: 'import {{camelCase name}}Routes from "./modules/{{kebabCase name}}/routes";'
			});
			actionsArray.push({
				type: "append",
				path: "src/api/v1/index.js",
				pattern: "Routes);",
				template: "router.use({{camelCase name}}Routes);"
			});
			actionsArray.push({
				type: "append",
				path: "src/openapi/paths/index.ts",
				pattern: '/openapi";',
				template: `import {{camelCase name}}OpenAPI from "../../api/v1/modules/{{kebabCase name}}/openapi";`
			});
			actionsArray.push({
				type: "append",
				path: "src/openapi/paths/index.ts",
				pattern: "paths = {",
				template: "    ...{{camelCase name}}OpenAPI,"
			});
			return actionsArray;
		}
	});

	plop.setGenerator("route", {
		description: "Add a new route to an existing module",
		prompts: [
			{
				type: "input",
				name: "module",
				message: "Module name (e.g. customers):"
			},
			{
				type: "input",
				name: "route",
				message: "Function name (e.g. inviteApplicant):"
			},
			{
				type: "input",
				name: "path",
				message: "Route path (e.g. /customers/:customerID/dummy):"
			},
			{
				type: "list",
				name: "method",
				message: "Choose HTTP method:",
				choices: ["get", "post", "put", "patch", "delete"],
				default: "get"
			},
			{
				type: "list",
				name: "ext",
				message: "Choose file extension:",
				choices: [".ts", ".js"],
				default: ".ts"
			}
		],
		actions: [
			// 1. Add route
			{
				type: "modify",
				path: "src/api/v1/modules/{{kebabCase module}}/routes{{ext}}",
				// eslint-disable-next-line require-unicode-regexp
				pattern: /(module\.exports\s*=\s*router;)/,
				template: `
					router.route("{{path}}").{{method}}(
						validateUser,
						validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
						validateSchema(schema.{{camelCase route}}),
						api.{{camelCase route}}
					).all(methodNotAllowed);
					
					$1
				`
			},

			// 2. Modify schema object
			{
				type: "modify",
				path: "src/api/v1/modules/{{kebabCase module}}/schema{{ext}}",
				// eslint-disable-next-line require-unicode-regexp
				pattern: /(?=}\s*;)/,
				template: `
					,{{camelCase route}}: {
						
					}
				`
			},

			// 3. Append controller function
			{
				type: "modify",
				path: "src/api/v1/modules/{{kebabCase module}}/controller{{ext}}",
				// eslint-disable-next-line require-unicode-regexp
				pattern: /(export const controller = {\s*[\s\S]*?)(};)/,
				template: `$1
					,{{camelCase route}}: catchAsync(async (req, res) => {
						const response = await {{camelCase module}}.{{camelCase route}}(
							req.params,
							req.body,
							res.locals.user,
							req.query
						);
						res.jsend.success(response, "");
					})
				$2`
			},

			// 4. Modify existing class in <module>.ts
			{
				type: "modify",
				path: "src/api/v1/modules/{{kebabCase module}}/{{kebabCase module}}{{ext}}",
				// eslint-disable-next-line require-unicode-regexp
				pattern: /(?=^}\s*$)/m,
				template: `
					async {{camelCase route}}(_params, _body, _user, _query){
						await Promise.resolve();
						return {};
					}
				`
			},

			// 5. Append to openapi.ts
			{
				type: "modify",
				path: "src/api/v1/modules/{{kebabCase module}}/openapi.ts",
				// eslint-disable-next-line require-unicode-regexp
				pattern: /(};\s*export default .*OpenAPI;)/,
				template: `
				,"{{openApiPath path}}": {
					{{method}}: {
						summary: "{{properCase route}} API",
						description: "",
						tags: ["{{properCase module}}"],
						security: [{ bearerAuth: [] }],
						parameters: [
							{
								name: "",
								in: "path",
								required: true,
								schema: {}
							}
						],
						requestBody: {
							required: true,
							content: {
								"application/json": {
									schema: {}
								}
							}
						},
						responses: {
							"200": { $ref: "#/components/responses/SuccessResponse" },
							"400": { $ref: "#/components/responses/BadRequest" },
							"401": { $ref: "#/components/responses/Unauthorized" },
							"403": { $ref: "#/components/responses/Forbidden" },
							"500": { $ref: "#/components/responses/InternalServerError" }
						}
					}
				},
			
			$1`
			}
		]
	});
}
