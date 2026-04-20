<!-- Source: https://docs.worthai.com/api-reference/auth/customers/update-customer-user-by-id.md -->
# Update Customer User By ID

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Update Customer User By ID

> Update user details for a specific customer.



## OpenAPI

````yaml patch /customers/{customerID}/users/{userID}
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
  /customers/{customerID}/users/{userID}:
    patch:
      tags:
        - Customers
      summary: Update Customer User By ID
      description: Update user details for a specific customer.
      parameters:
        - name: customerID
          in: path
          required: true
          schema:
            type: string
        - name: userID
          in: path
          required: true
          schema:
            type: string
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
                status:
                  type: string
                  enum:
                    - ACTIVE
                    - INACTIVE
                  description: User status (ACTIVE or INACTIVE)
              minProperties: 1
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
                  message:
                    type: string
              example:
                status: success
                message: User details updated successfully
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          description: Not Found
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                  message:
                    type: string
                  errorCode:
                    type: string
                  data:
                    type: object
                    properties:
                      errorName:
                        type: string
                    required:
                      - errorName
                required:
                  - status
                  - message
                  - errorCode
                  - data
              example:
                status: fail
                message: Customer user does not exist
                errorCode: INVALID
                data:
                  errorName: CustomersApiError
        '500':
          $ref: '#/components/responses/InternalServerError'
      security:
        - bearerAuth: []
components:
  responses:
    BadRequest:
      description: Invalid Request
      content:
        application/json:
          schema:
            type: object
            properties:
              message:
                type: string
                example: Error occurred
              errorCode:
                type: string
                example: ERR_INTERNAL_SERVER
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