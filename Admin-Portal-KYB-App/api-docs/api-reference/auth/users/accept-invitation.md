<!-- Source: https://docs.worthai.com/api-reference/auth/users/accept-invitation.md -->
# Accept Invitation

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Accept Invitation

> Allows a user to accept an invitation using an invite token.



## OpenAPI

````yaml post /invite/{inviteToken}/accept
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
  /invite/{inviteToken}/accept:
    post:
      tags:
        - Users
      summary: Accept Invitation
      description: Allows a user to accept an invitation using an invite token.
      parameters:
        - name: inviteToken
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: false
        content:
          application/json:
            schema:
              type: object
              properties:
                password:
                  type: string
                  description: >-
                    User's password (optional, must meet complexity
                    requirements)
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
                    example: Invitation Accepted.
                  data:
                    type: object
                    properties:
                      access_token:
                        type: string
                        example: <your_access_token_here>
                      id_token:
                        type: string
                        example: <your_id_token_here>
                      refresh_token:
                        type: string
                        example: <your_refresh_token_here>
                      is_email_verified:
                        type: boolean
                        example: true
                      business_id:
                        type: string
                        format: uuid
                        example: d2f6f265-1e6c-4cb7-a5f2-e080e86811f9
              example:
                status: success
                message: Invitation Accepted.
                data:
                  access_token: >-
                    eyJraWQiOiJYeHVkcWQ1eU1GeitBWjJTQTlNQzhXZ2VweXFkVkdpTTA4VEc2TkgxbEdJPSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiJjYzc0MGFmMC0xMjExLTQwN2EtODAwMy00OWU2NTE2YTRkMDQiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV9wV1dORFlUWXoiLCJjbGllbnRfaWQiOiI3dDY1cGJmN2p2Ym5scWhxZmUyMWEyOWE1OSIsIm9yaWdpbl9qdGkiOiJjYWVjZTUwMC1jYTc3LTRiMjAtOTBkMy0wMzM3MDZjMTEwOTEiLCJldmVudF9pZCI6IjlkNmM2Njg1LTY1ZjUtNDYyMy04Mjk0LTNjMjE1NWZlYzFjNyIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3MDczOTE2MTQsImV4cCI6MTcwNzM5NTIxNCwiaWF0IjoxNzA3MzkxNjE0LCJqdGkiOiJjNDQ0YTIzNC04NmVjLTRkOTYtYmNjOC0yNDZkNzIyMzE5ZTEiLCJ1c2VybmFtZSI6ImNjNzQwYWYwLTEyMTEtNDA3YS04MDAzLTQ5ZTY1MTZhNGQwNCJ9.R5lH4MC5nLu29DPQLdp_YBtmZoOXdTu14E4k6MJtfoZOLiu-6UjxfelDoCSrqGlDDOJYfm6wgLS2BfR9hFI0Cw2BzVP98MTw8P4D4jkyz4g7j7a0-UZDhlDy5pDTKWVnnF5LY7uJwr1jFHuNRJDp-gSVLG-wHOlFJ9Kww7Cu86rm3dNki-G5oVAs-cHbhxBEHNZcio8KawqokmnK42Iwbnqeua5ZaGoZGHDNFWCTB6HLrboqU7skcdom7mvgK-ec2X4sATLCDUQF0xE0uOjJ3mOkAR0Mj7Xsm_CUhF7Yh1NZ6PTlMW6jHitvieDIT-hj40EuSVz91VH1F2Z9Idhqnw
                  id_token: >-
                    eyJraWQiOiJQMlp2Y3ZwRzU3V01hYWhZbnRzYnBwbStaVkt6Z2dcL3lcL0hRMnByQUVcL3pBPSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiJjYzc0MGFmMC0xMjExLTQwN2EtODAwMy00OWU2NTE2YTRkMDQiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV9wV1dORFlUWXoiLCJjdXN0b206aWQiOiI1OTEzZTk4MS1mZWM4LTQ3ZmQtOWM2NS1mNDAzYTkyOWEwNTQiLCJjb2duaXRvOnVzZXJuYW1lIjoiY2M3NDBhZjAtMTIxMS00MDdhLTgwMDMtNDllNjUxNmE0ZDA0IiwiZ2l2ZW5fbmFtZSI6ImZzYWZkIiwib3JpZ2luX2p0aSI6ImNhZWNlNTAwLWNhNzctNGIyMC05MGQzLTAzMzcwNmMxMTA5MSIsImF1ZCI6Ijd0NjVwYmY3anZibmxxaHFmZTIxYTI5YTU5IiwiZXZlbnRfaWQiOiI5ZDZjNjY4NS02NWY1LTQ2MjMtODI5NC0zYzIxNTVmZWMxYzciLCJ1cGRhdGVkX2F0IjoxNzA3MzkxNDE2Mjc2LCJ0b2tlbl91c2UiOiJpZCIsImF1dGhfdGltZSI6MTcwNzM5MTYxNCwiZXhwIjoxNzA3Mzk1MjE0LCJpYXQiOjE3MDczOTE2MTQsImZhbWlseV9uYW1lIjoiYXNkZnNhZCIsImp0aSI6IjA0OGM5MDFhLTlmMjctNDc3OC1iYTJjLTFmNTFkOTczMTEwOSIsImVtYWlsIjoicHJhc2FkLmRlc2FpKzExMTNAd2luaml0LmNvbSJ9.Y6S0hRdSVWK4uVPbxJjqE5faddgYiHqkodOiXrrfQvSufck5VEtXrztjSIR80Gkd9cZS3r23wLfT3Tn3z0SagOdgKLTJKtc6aa6O-SS4om_zjlbp0IksxfR-ZPXaNNURz8qhbWtR0XL3Zy7R2dItzs_eQ7BLACX0UTD-hQGHsS7s3veUT68E3mr-K8bmEiXTFCuMFTBq2GbqL0FVICnRVKtdnjVt8zeIKGylo8bugm6Tf-gOM9888fZpussq44QpbCKIqgbmcX5KAfhFeKY7pRwD0YS0P7_KaKiiSeBPSJMeESJdE7bw62bZVH3L0tj-k2vi2iXgksFSXkXp_oiDvQ
                  refresh_token: >-
                    eyJjdHkiOiJKV1QiLCJlbmMiOiJBMjU2R0NNIiwiYWxnIjoiUlNBLU9BRVAifQ.W6LaTokZ-1JkF4Ux2uNjQ5xLmguhoNFw_cVhaZZCfQBBBG9N9nkQKlj-9zlY84jGWE8EHqHUfDF2pbdZek77CNDvCubh-61WZh4Kql4bobPqlqPNPP0DNxcuLy3xmSaXsToKvnlH-iyguvqZbzaE1osPty64SuNfVIdQcbb2l7w3OLfuLW82upsQMkqHAq01jQvzYJtN4tuKXaVlHTPHpgZj-DD_U6kc9x-dazmxPJLwf9TDCXuvEfEgghsyMDHceGrn3PtqPlzXGJwXw1Tzg6BDK5ZS_A6pErGsW9Jm7DoGDkZfCv8vDovsMc1H0uKLqDEx2pT9WFY9IxMT8CkmRA.HxXC97MP7p7avGqx.LdtZsZ5ZlKbFxNJJvUwe-S1k835v24YHhuX2grYWpWQuP7mq-8QY6ehqWjLuuL8bF3WS59eWsi2tI5uD-Ui-qHYo14TJ7md8fhbQsIEAv7y3ImfhDv8-ZEZF7CnvVlyKf8LED71-oxhcnYz4WQrxGDsRGw0z2ApkYfrZ9NyK9OBfywmQZx5tTUuwSboO7ZVh8n747r87AMq4mSfcDpIrCGcS-1r1U1DndK8b5Tl9bPRGT650--CsryxZDjr80Ns36HklrAWWzRgBQ9A3ZZdWPL2_oreJmp1WxftF9Rf6DeZz97A582tifMPBHcFmn0Cy4hSI9CPtRQ3JkDtTiIoxmBnUPdAZ7xIoQ-3Do69uBMOW06JqKl1N6k9PG4xaPcjGTeCznGtqZpPTNy7SdtdukjcoiPiUaFfEi8COUfb0O1u3WHb1-3uJfpLKDHDXL9Jg6L05eUtKWGHgGQ10VIrahBq4SljC2sXm3iQ8-uaL--bUmSm_l8XPegEbwpFzd2pXs82Bg5i__6lwj0AjEvsiVfnOcqbK6KtC9dlcSwqWml7XYdhnKYtyrOsm5aQEJGLfhFtIPiugM7MbriYBfWgYTmHsbuooUsFtAb4rpVhGHcV9NLTQ3MCiGfou3f6V0yNEOTSP23OS01feYGQjh41Aa09uOOO-OoCA8McrgMaql3rLq85tQ_CerLO7d17-JBrDFIpjqDTw61yD3KmAnOM6GZTjV9PJhShxXEdRu9qJtvhfSWl6mPY6kQRvQ93iXcWTmw7bAKpfQ6LIjLLUlvNkmwG3bijvTj1Xu8wgpol3wSWuUSoCGgElPN_iULIc-5iRtLxFf-aXpax8Q8zYLwDvkt48oPFurafAOnvyGZGjO3U_6rhVIOPQI7UrcqRp_j32TKi6b10-w0Nt0mbT2HWlRkO4qGwP3odjXYLOuqBwFXszEgiLt9Zbnt-VK3rqnk_NL0aN66qcJMGp0iE_tKKBV6Xr0JExYZ_7ev-xCRYGMau1U23CQ045Dih6RBxPxqXWpsePrwp-TCzCvm9hl-aEJw0DPXAluJQsdIiuYcbEpNET_N80ftwSZELmG95JVy9J8taEAEUguWwgPQyA5-oylzDw7J4R7DLJBEyH8EekxL53BOFLnvCVVjRlSfeHsUgCNCIh3Mx1U0A2-aU33pJRT0eJ2yuN6TOvZTq_N7HGRY54t4Kpa-ViwuNM5L8f6TRatdaVzEDNzmMUndxUZVMtl5THYh4_py-y2d7ZA9RGpL22b7kPctVsjThg2cvyOSxXdRfVFu6jdXfUPwD8rGxTx2e62hRZ2lzwEqXIxZHxO7TfHBa584pcz1HJYAk.sEQPCUdVUrS6hWV1pMZPaw
                  is_email_verified: true
                  business_id: d2f6f265-1e6c-4cb7-a5f2-e080e86811f9
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
                    example: >-
                      password should be at least 8 characters long, password
                      should contain at least 1 lower-cased letter, password
                      should contain at least 1 upper-cased letter, password
                      should contain at least 1 symbol
                  errorCode:
                    type: string
                    example: INVALID
                  data:
                    type: object
                    properties:
                      errorName:
                        type: string
                        example: ValidationMiddlewareError
              example:
                status: fail
                message: >-
                  password should be at least 8 characters long, password should
                  contain at least 1 lower-cased letter, password should contain
                  at least 1 upper-cased letter, password should contain at
                  least 1 symbol
                errorCode: INVALID
                data:
                  errorName: ValidationMiddlewareError
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '500':
          description: Internal Server Error
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
                    example: invalid signature
                  errorCode:
                    type: string
                    example: UNKNOWN_ERROR
                  data:
                    type: object
                    properties:
                      errorName:
                        type: string
                        example: JsonWebTokenError
              example:
                status: error
                message: invalid signature
                errorCode: UNKNOWN_ERROR
                data:
                  errorName: JsonWebTokenError
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