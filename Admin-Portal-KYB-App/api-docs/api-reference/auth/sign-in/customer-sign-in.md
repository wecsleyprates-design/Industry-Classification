<!-- Source: https://docs.worthai.com/api-reference/auth/sign-in/customer-sign-in.md -->
# Customer Sign In

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Customer Sign In

> This endpoint allows customers to sign in with their email and password.

See Response -> Data -> customer_details below for the customerID used in other requests.



## OpenAPI

````yaml post /customer/sign-in
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
  /customer/sign-in:
    post:
      tags:
        - Sign In
      summary: Customer Sign In
      description: >-
        This endpoint allows customers to sign in with their email and password.


        See Response -> Data -> customer_details below for the customerID used
        in other requests.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                email:
                  type: string
                  format: email
                  description: User's email address
                password:
                  type: string
                  description: User's password
              required:
                - email
                - password
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
                    example: Logged In successfully
                  data:
                    type: object
                    properties:
                      user_details:
                        type: object
                        properties:
                          id:
                            type: string
                            format: uuid
                          first_name:
                            type: string
                          last_name:
                            type: string
                          email:
                            type: string
                            format: email
                          is_email_verified:
                            type: boolean
                      access_token:
                        type: string
                        description: JWT access token - DEPRECATED
                      id_token:
                        type: string
                        description: >-
                          JWT ID token - used as the authorization bearer
                          <token> for other endpoints.
                      refresh_token:
                        type: string
                        description: >-
                          Refresh token - used for refreshing the bearer token
                          at the Customer Refresh Token endpoint.
                      permissions:
                        type: array
                        items:
                          type: string
                        example:
                          - id: 7
                            code: customer_user:read
                            label: 'Customer user Read Only '
                          - id: 8
                            code: customer_user:write
                            label: Customer user Read Write
                      customer_details:
                        type: object
                        properties:
                          id:
                            type: string
                            format: uuid
                            description: >-
                              Also known as customerID when used in other
                              endpoint requests.
                          name:
                            type: string
              example:
                status: success
                message: Logged In successfully
                data:
                  status: success
                  message: Logged In successfully
                  data:
                    user_details:
                      id: b03d6f6a-063b-4e71-8195-9f6f590a6257
                      first_name: Sandbox
                      last_name: Customer Admin
                      email: dummy.customer@email.com
                      is_email_verified: true
                    access_token: >-
                      eyJraWQiOiJvb2FtdlA3MURjRlMxeFVoVEsyZDd0ckVjWXd0MDh0dGhyRkxOaDNRZER3PSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiJhNTQ0NGJhNS1lNjlhLTQzNTEtYjYzYy04NzlkNjE4YWU2ZTAiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV9sWXZBbUphTmkiLCJjbGllbnRfaWQiOiIyMGM4cXNwNmRldXJsNmE5Z2lmcjl1MmptcCIsIm9yaWdpbl9qdGkiOiJkMzY3ODBlMC00Zjk2LTQ4NWUtYjUyNS00ZDgzOWI0ZmQ4NDgiLCJldmVudF9pZCI6IjkzOGEzMTAzLTg0MDctNDFlNy1hYTIxLWY1YTU4MTA0YTYyZCIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3MDc3NDQ5NDYsImV4cCI6MTcwNzc0ODU0NiwiaWF0IjoxNzA3NzQ0OTQ2LCJqdGkiOiIyMzY5YTJiZi1kODg4LTQ2ZDQtYTYzOS0xMjI4MDg1YzRkMmQiLCJ1c2VybmFtZSI6ImE1NDQ0YmE1LWU2OWEtNDM1MS1iNjNjLTg3OWQ2MThhZTZlMCJ9.lNxRmFa3P-KvALWEgE7H_W2D8CQirTpOIU0U9ITtKz6J0dkE-WY0DhpMD8W73i2ul7_eiPQ59aDAi2jAZdS0AKgQJ3iwLU3ciYR10k2CKA-3fGByAUKBrZI4kHWQ0fdhj3ZIR65ddCxZLkMK3w1G0KK3VAQ1y6nipQQbZXXcybu_a7NP2G55M4A-syFqUqYxwESNb-W6YajdZon9NXoj-4ZzBdwjhWuyt1-5m8WilaxQvHBSCsAq7isvw-9HTZaUczvIXk1ZYhKRjqeaYAu9JtYbQP28Lx9Gj5bscQ40wJXR40l_iIoc032tntW-Gcnn-NU3uV1-_9MO3qeLICZq_Q
                    id_token: >-
                      eyJraWQiOiJrdEk4ZUttOWh3VUZiWUlCMTJiSXNDbWJwT1JTV05jXC8ybjA4QmU4YW8yaz0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhNTQ0NGJhNS1lNjlhLTQzNTEtYjYzYy04NzlkNjE4YWU2ZTAiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiaXNzIjoiaHR0cHM6XC9cL2NvZ25pdG8taWRwLnVzLWVhc3QtMS5hbWF6b25hd3MuY29tXC91cy1lYXN0LTFfbFl2QW1KYU5pIiwiY3VzdG9tOmlkIjoiYjAzZDZmNmEtMDYzYi00ZTcxLTgxOTUtOWY2ZjU5MGE2MjU3IiwiY29nbml0bzp1c2VybmFtZSI6ImE1NDQ0YmE1LWU2OWEtNDM1MS1iNjNjLTg3OWQ2MThhZTZlMCIsImdpdmVuX25hbWUiOiJTYW5kYm94Iiwib3JpZ2luX2p0aSI6ImQzNjc4MGUwLTRmOTYtNDg1ZS1iNTI1LTRkODM5YjRmZDg0OCIsImF1ZCI6IjIwYzhxc3A2ZGV1cmw2YTlnaWZyOXUyam1wIiwiZXZlbnRfaWQiOiI5MzhhMzEwMy04NDA3LTQxZTctYWEyMS1mNWE1ODEwNGE2MmQiLCJ1cGRhdGVkX2F0IjoxNzA3NzMwMDA4MTA3LCJ0b2tlbl91c2UiOiJpZCIsImF1dGhfdGltZSI6MTcwNzc0NDk0NiwiZXhwIjoxNzA3NzQ4NTQ2LCJpYXQiOjE3MDc3NDQ5NDYsImZhbWlseV9uYW1lIjoiQ3VzdG9tZXIgQWRtaW4iLCJqdGkiOiJiMWJiZGFhOC00OWQ3LTQ1YjgtYmNkNi0wMDFhMWZlYjE1MDYiLCJlbWFpbCI6InNhbmRib3gtdGVzdCtjdXN0b21lckBqb2lud29ydGguY29tIn0.WW5__TX42GjyhtzAxAo6Domogd9USSF5h0FoyToG_WciHTuCiH3vYNddweasL1_fT4txBfcVknzscfG5QJHc_zjT4HPO4mIFnP9r5o3YwR39ISMZGKgxbVZZxnNBcSh0QzB-CGtno7q6JUl34zjhD4DyqB-TMW5QSQKYdDw4HcnCsXYvWjTc-NwANAZWyC8_NtVdcTWqw43K4Dx5JWoEXnrbYDDcUe0qahmhJ7jEl7plvBqy-L6CA_kjV9-mR86V0ipHXOTBZKzm8Aj3NrRP7s-AtitQ0uHHQhciatiK8YbcBmT5eUqlw1PQfk0vHVXlHSZ6cRsv9j9p5mWmgzrzMw
                    refresh_token: >-
                      eyJjdHkiOiJKV1QiLCJlbmMiOiJBMjU2R0NNIiwiYWxnIjoiUlNBLU9BRVAifQ.umDyw5UZoMp13_sUpCT9PmiS9IDywTz9uF_KA8b8KE5fiYU9FsQO2btjkpXXXsDL6KQZSUe-S8UA0FJ7G0IaihO2-HsuEdknVSPfeKmQhi4snmkEMqgC7KYKAJ7y1YN9KJb97bLvZVTPoMduMHGIBEHkGGMdxWxiEUXQakRECtB2ttFbrkf1oIRHfoF6_OnNCJKps-HcudtpJYPhrKR128IWAkFNqXKD8uWqjki7hbSY1uhAAfIR2jwfknfT1jnXzVNVoSuQczKBe31HSLCGV1Dw_Ytp6t2BrTb8By54xxtFHo-Xyv6-fsO5kE-QHF-0NeHQuwv6VyjxtExJkc4dxg.56ZfBFARjlPOdRgb.Ze8K6TdNml7JVP1xfvc6-zYl1nJ3QKdyCuPpOwyQ9QP7k6zspZfUlrGyjwUsrkPVWFpyHnTe3CsvlGyO_6XsPEmM-u4244wEQomYfnCkzeipc2-LbXRzGBSjIMjP2X_C5vIzanVcedASnZhksxQsl4r3DzhrFtVaxNhciD6hTSxLut9NPHhJv2lOEJ57s5dqPviDcpws7X2PBFTjpQRj1bvz15RI-ngbNsmOmqf9N4tpe2zDCiVYNl-mu6k3kIQhx2Bci1jfN7koEVHOAW-ul0yBF0WMcSYwpdurutdIFfpWNNhssb5JvqqWgC0SiPcWKa4gRwmpBmjwauJcD-Yb-S3AbW88f687lPyTuamHAHP6MPtN9M4ZYq9qhyTywpXZbEnP_RmM5XqKBd8bdgg8Z_-LycEKF7wIRua5Z06_b_A5JyD2fCt_MerBsDZhOGZbKNmc0xi4Eg7wITrSab59MktUNbb6apB0Y2RS89dtvyBoq1qv5vLb5S-eaUCtcD5OFDleGhS5xIjD1rBx7CUcmOAe2m28603pELoPmr5KBcCCa3WCc9xAiaSLORAO3hvzX-Nq_x7l5Mb8lFy-dhDVDgL9z8Uzy-mAl1SgyamVcJ9NaEJfkHYKJ6J3THv3Zg08_1Sx8J3y0XNpZWntfjdqgPXE1r52HAWbZJtelMH5lbtxY0VLy8o1DwlDlvMyNfAmBCtHUwaEC3WKQQVLRXAS6iFZBOYaU0vYyZZHDF95G0Ot-vYI5UZsLR_Rd8j-rmrDww5CjIujzwEhSAQBcr-WqIQFSxjArqp4ufWdooiTevYyGzCGkAqqOymHvPZbVW8FvL-UlUEZBJVMKKSSB-VlwT1E9xZH-376HuNR4hwjDEQtWgzZo3xd-P0w965AztBCLguFQRJ1cuGKXPI9Si-jF_8jvjFIGcAru9Jva2zYseFTANeRL_Z1NUqddkfF_aHShPuc2p6sqjEExEbAQhe41nuZpPbcbuhbo9QKsksvhberanU3_Tu9lXf2sUyrLyCM7IR-_f-4ciiyw2vFb9VMz4n_qJo_6lx_UEVRA_CFXyYLVgU5cs2b9Ee5uh56Md36hXBEMSZzaqbf2aAJXQ2d_dEh0B_9cbv11zg2ZLBU_L8LLq_pJQtOgpSkYJMLayQiW8ubNZBSbLzPVHo0sxZPpsighZZSNoZ_nKoiuKpTx2sppzHftZ5gqND38GLplfnKvhpYEHclcS_XGg3kcogEAZXFXSt_aslNUQP6Zwr2OlF_fMvzH4U69_CFgMGquM1PKglr64dxb6_ZZ78jcYmpr4OVWytqv26enfteIYEXZoSVzUVfQOMBFcWo_A.JBsycA0HGpTemXd1Xluhgw
                    subrole:
                      id: 30de5456-973e-4ba6-a98f-a55183326a0a
                      code: owner
                      label: Owner
                    permissions:
                      - id: 7
                        code: customer_user:read
                        label: 'Customer user Read Only '
                      - id: 8
                        code: customer_user:write
                        label: Customer user Read Write
                      - id: 9
                        code: customer_user:create
                        label: Customer user Create
                      - id: 10
                        code: case:read
                        label: 'Applicant Case Read Only '
                      - id: 11
                        code: case:write
                        label: Applicant Case Read Write
                      - id: 12
                        code: case:create
                        label: Applicant Case Create
                      - id: 13
                        code: profile:read
                        label: Profile Read
                      - id: 14
                        code: profile:write
                        label: Profile Write
                      - id: 15
                        code: brand_settings:read
                        label: Brand Settings Read
                      - id: 16
                        code: brand_settings:write
                        label: Brand Settings Write
                      - id: 17
                        code: businesses:read
                        label: Businesses Read Only
                      - id: 18
                        code: businesses:write
                        label: Businesses owner Read Write
                      - id: 19
                        code: businesses:create
                        label: Businesses owner Create
                    customer_details:
                      id: 2e6438cb-ec3f-4e94-b5c9-8c058d2efaf1
                      name: Sandbox
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
                    example: Incorrect username or password.
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
                message: Incorrect username or password.
                errorCode: INVALID
                data:
                  errorName: SignInApiError
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '500':
          description: Internal server error
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: error
                  message:
                    type: string
                    example: Incorrect username or password.
                  errorCode:
                    type: string
                    example: UNKNOWN_ERROR
                  data:
                    type: object
                    properties:
                      errorName:
                        type: string
                        example: NotAuthorizedException
              example:
                status: error
                message: Incorrect username or password.
                errorCode: UNKNOWN_ERROR
                data:
                  errorName: NotAuthorizedException
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

````

Built with [Mintlify](https://mintlify.com).