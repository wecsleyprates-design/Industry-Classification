<!-- Source: https://docs.worthai.com/api-reference/auth/sign-in/customer-refresh-token.md -->
# Customer Refresh Token

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Customer Refresh Token

> Refreshes the customer's authentication token to maintain session validity.



## OpenAPI

````yaml post /refresh-token/customer
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
  /refresh-token/customer:
    post:
      tags:
        - Sign In
      summary: Customer Refresh Token
      description: >-
        Refreshes the customer's authentication token to maintain session
        validity.
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
                    example: Success
                  data:
                    type: object
                    properties:
                      access_token:
                        type: string
                        description: JWT access token
                      id_token:
                        type: string
                        description: JWT ID token
              example:
                status: success
                message: Success
                data:
                  access_token: >-
                    eyJraWQiOiJvb2FtdlA3MURjRlMxeFVoVEsyZDd0ckVjWXd0MDh0dGhyRkxOaDNRZER3PSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiIxM2VkYWY1YS1kOTRkLTQ1MWUtOWU0MS05Zjg4MWQ5NzBlNmMiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV9sWXZBbUphTmkiLCJjbGllbnRfaWQiOiIyMGM4cXNwNmRldXJsNmE5Z2lmcjl1MmptcCIsIm9yaWdpbl9qdGkiOiI3MWE0ODZlMi1jZmQzLTRhYTgtYjFhYS0zZTI2YWNiZDA2MTkiLCJldmVudF9pZCI6ImJlNWFhMDk4LTY4ZTctNGU3MS05YWE1LTdhYmNlYjkyZTlkMyIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3MDczODg0MTUsImV4cCI6MTcwNzM5MjAxOCwiaWF0IjoxNzA3Mzg4NDE4LCJqdGkiOiJhMzA3MzZmYy0yNTliLTQ5NGYtYmI3Zi1jMGQyYzYwYzAwOTgiLCJ1c2VybmFtZSI6IjEzZWRhZjVhLWQ5NGQtNDUxZS05ZTQxLTlmODgxZDk3MGU2YyJ9.UIHX6viTrK0CRD3kFDimS9hDsEBOozxrnURi_CeQAa3zGz1a4R5zALsMSGA_n3X8YHo_srZiW-MGyzO7xh3n3w9_aLPZEJeq-0Erh23Euyp-vv8l_bkyyo3_-z18iZq4gmjOnuyC05NWdUQJbYeHuvqUQ6PcytFyliXKvLbK03_6-3hsC48Q9hH3iYcFP4EOTzddLmy8rkq2w771N54rAda_l4HG3tz3f1qhwAXraotAhbrORks82DDOYCyRPLf9R5i7YItGo-PWGiY-i2u354SP_hChgrcl7IHIazqBW_YLYiCX6wPjHt0j9SMCuVAFvYYtdWqoJfdo2sKT-BlWIg
                  id_token: >-
                    eyJraWQiOiJrdEk4ZUttOWh3VUZiWUlCMTJiSXNDbWJwT1JTV05jXC8ybjA4QmU4YW8yaz0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxM2VkYWY1YS1kOTRkLTQ1MWUtOWU0MS05Zjg4MWQ5NzBlNmMiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiaXNzIjoiaHR0cHM6XC9cL2NvZ25pdG8taWRwLnVzLWVhc3QtMS5hbWF6b25hd3MuY29tXC91cy1lYXN0LTFfbFl2QW1KYU5pIiwiY3VzdG9tOmlkIjoiNTc0M2FiM2YtMjA3Zi00YjU1LWFhN2YtNzc2MTk3ZjkwMTk2IiwiY29nbml0bzp1c2VybmFtZSI6IjEzZWRhZjVhLWQ5NGQtNDUxZS05ZTQxLTlmODgxZDk3MGU2YyIsImdpdmVuX25hbWUiOiJTZW10dSIsIm9yaWdpbl9qdGkiOiI3MWE0ODZlMi1jZmQzLTRhYTgtYjFhYS0zZTI2YWNiZDA2MTkiLCJhdWQiOiIyMGM4cXNwNmRldXJsNmE5Z2lmcjl1MmptcCIsImV2ZW50X2lkIjoiYmU1YWEwOTgtNjhlNy00ZTcxLTlhYTUtN2FiY2ViOTJlOWQzIiwidXBkYXRlZF9hdCI6MTcwMTY4MTcxMjg3MCwidG9rZW5fdXNlIjoiaWQiLCJhdXRoX3RpbWUiOjE3MDczODg0MTUsImV4cCI6MTcwNzM5MjAxOCwiaWF0IjoxNzA3Mzg4NDE4LCJmYW1pbHlfbmFtZSI6IlNpbWdoIiwianRpIjoiZjYwZmNhZTctN2Q2MS00MzhkLTgxNWQtNzEzMTJhNzE0MGY4IiwiZW1haWwiOiJjb29sZXJtYXN0ZXJAeW9wbWFpbC5jb20ifQ.d1Hqsa8m2P9Occu_6UMqCak_WCeZ7sEUIIZdSd-z407ZOX1Mjd1JH7jpgP5lz_74rvKFTqAfxyNnWpaVDbbE5JU05MF2mZtYY3wlGpevhdi9dz8pXHGC7WvpPkovNLRZD7abToO8AYSDb-uBbLCyvpgwiLp6zJdwp2LZLB6n4n2doI4JEEzQzYtSxxtMAEh8FN8A-ZGTi1I56avmbPvu4668YveRPBfKOTOMN7kUF34FfpYvtU2WP_ulkyw_559BPGbUXJk5hGvcvsGQvDT6PPvdhoR2vlALYxNMf1A35z8yQohPzZbWqi8bVePYLOdEgDBH1Y4gKR1ikczrios-zw
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
                    example: Refresh Token is Required
                  errorCode:
                    type: string
                    example: INVALID
                  data:
                    type: object
                    properties:
                      errorName:
                        type: string
                        example: SignInApiError
              example:
                status: fail
                message: Refresh Token is Required
                errorCode: INVALID
                data:
                  errorName: SignInApiError
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '500':
          $ref: '#/components/responses/InternalServerError'
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

````

Built with [Mintlify](https://mintlify.com).