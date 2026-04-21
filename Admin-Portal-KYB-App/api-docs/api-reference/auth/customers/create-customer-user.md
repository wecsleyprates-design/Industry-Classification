<!-- Source: https://docs.worthai.com/api-reference/auth/customers/create-customer-user.md -->
# Create Customer User

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Create Customer User

> Allows Customer to create a new user under a specific customer.



## OpenAPI

````yaml post /customers/{customerID}/users
openapi: 3.1.0
info:
  title: Auth Service
  version: 1.0.0
  description: API documentation for Auth Service
servers:
  - url: https://api.joinworth.com/auth/api/v1
    description: Production server
security: []
paths:
  /customers/{customerID}/users:
    post:
      tags:
        - Customers
      summary: Create Customer User
      description: Allows Customer to create a new user under a specific customer.
      parameters:
        - name: customerID
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                first_name:
                  type: string
                  description: First name of the user
                last_name:
                  type: string
                  description: Last name of the user
                email:
                  type: string
                  format: email
                  description: Email address of the user
                mobile:
                  type: string
                  description: Mobile number of the user
                subrole:
                  type: object
                  description: Subrole details
                  properties:
                    id:
                      type: string
                      description: Unique identifier for the subrole
                    code:
                      type: string
                      description: Code representing the subrole
                    label:
                      type: string
                      description: Label or name of the subrole
                  required:
                    - id
                    - code
                    - label
              required:
                - first_name
                - last_name
                - email
                - subrole
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: success
                  message:
                    type: string
                    example: Customer user created.
                  data:
                    type: object
                    properties:
                      user_id:
                        type: string
                        format: uuid
                        example: 053cfb4b-2073-4ede-afc0-26579bb3e1b8
              example:
                status: success
                message: Customer user created.
                data:
                  user_id: 053cfb4b-2073-4ede-afc0-26579bb3e1b8
        '400':
          description: Bad Request
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: fail
                  message:
                    type: string
                    example: Another customer user exists with the same email.
                  errorCode:
                    type: string
                    example: INVALID
                  data:
                    type: object
                    properties:
                      errorName:
                        type: string
                        example: CustomersApiError
                    required:
                      - errorName
                required:
                  - status
                  - message
                  - errorCode
                  - data
              example:
                status: fail
                message: Another customer user exists with the same email.
                errorCode: INVALID
                data:
                  errorName: CustomersApiError
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '500':
          $ref: '#/components/responses/InternalServerError'
      security:
        - bearerAuth: []
components:
  responses:
    Unauthorized:
      description: Unauthorized
      content:
        application/json:
          schema:
            type: object
            properties:
              message:
                type: string
                example: Unauthorized
              errorCode:
                type: string
                example: ERR_UNAUTHORIZED
    Forbidden:
      description: Forbidden
      content:
        application/json:
          schema:
            type: object
            properties:
              message:
                type: string
                example: Forbidden
              errorCode:
                type: string
                example: ERR_FORBIDDEN
    InternalServerError:
      description: Internal Server Error
      content:
        application/json:
          schema:
            type: object
            properties:
              message:
                type: string
                example: Internal Server Error
              errorCode:
                type: string
                example: ERR_INTERNAL_SERVER
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

````