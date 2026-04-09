<!-- Source: https://docs.worthai.com/api-reference/worth-360-report/generate-worth-360-report-using-customer.md -->
# Generate Worth 360 Report Using Customer

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Generate Worth 360 Report Using Customer



## OpenAPI

````yaml post /reports/customers/{customerID}/businesses/{businessID}
openapi: 3.1.0
info:
  title: For Customer's Businesses Worth 360 Report APIs
  contact: {}
  version: '1.0'
servers:
  - url: https://api.joinworth.com/report/api/v1
    variables: {}
security: []
tags:
  - name: Misc
    description: ''
paths:
  /reports/customers/{customerID}/businesses/{businessID}:
    parameters: []
    post:
      tags:
        - Misc
      summary: Generate Worth 360 Report Using Customer
      operationId: GenerateWorth360ReportUsingCustomer
      parameters:
        - name: customerID
          in: path
          description: ''
          required: true
          style: simple
          schema:
            type: string
            examples:
              - '{{customer_id}}'
        - name: businessID
          in: path
          description: ''
          required: true
          style: simple
          schema:
            type: string
            examples:
              - 26a5d832-3f4e-4b43-84f2-e19c594bd7c1
      responses:
        '200':
          description: OK
          headers:
            Date:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: Fri, 11 Apr 2025 09:11:12 GMT
            Content-Length:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '131'
            Connection:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: keep-alive
            Content-Security-Policy:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: >-
                    default-src 'self';base-uri 'self';font-src 'self' https:
                    data:;form-action 'self';frame-ancestors 'self';img-src
                    'self' data:;object-src 'none';script-src
                    'self';script-src-attr 'none';style-src 'self' https:
                    'unsafe-inline';upgrade-insecure-requests
            Cross-Origin-Opener-Policy:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: same-origin
            Cross-Origin-Resource-Policy:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: same-origin
            Origin-Agent-Cluster:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '?1'
            Referrer-Policy:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: no-referrer
            Strict-Transport-Security:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: max-age=15552000; includeSubDomains
            X-Content-Type-Options:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: nosniff
            X-DNS-Prefetch-Control:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: 'off'
            X-Download-Options:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: noopen
            X-Frame-Options:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: SAMEORIGIN
            X-Permitted-Cross-Domain-Policies:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: none
            X-XSS-Protection:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '0'
            Vary:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: Origin
            Access-Control-Allow-Credentials:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: 'true'
            ETag:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: W/"83-JH46WhEmCK7NwDpK/yZ7gpaja/c"
          content:
            application/json; charset=utf-8:
              schema:
                allOf:
                  - $ref: >-
                      #/components/schemas/SuccessWorth360ReportGenerationUsingCustomerStartedSuccessfully
                  - examples:
                      - status: success
                        message: Report generation started successfully
                        data:
                          report_id: 4eb20a20-f29f-4907-b305-b6d074ffff50
                contentMediaType: application/json; charset=utf-8
              example:
                status: success
                message: Report generation started successfully
                data:
                  report_id: 4eb20a20-f29f-4907-b305-b6d074ffff50
      deprecated: false
      security:
        - bearer: []
components:
  schemas:
    SuccessWorth360ReportGenerationUsingCustomerStartedSuccessfully:
      title: SuccessWorth360ReportGenerationUsingCustomerStartedSuccessfully
      type: object
      properties:
        status:
          type: string
        message:
          type: string
        data:
          $ref: '#/components/schemas/Data5'
      examples:
        - status: success
          message: Report generation started successfully
          data:
            report_id: 4eb20a20-f29f-4907-b305-b6d074ffff50
    Data5:
      title: Data5
      type: object
      properties:
        report_id:
          type: string
      examples:
        - report_id: 4eb20a20-f29f-4907-b305-b6d074ffff50
  securitySchemes:
    bearer:
      type: http
      scheme: bearer

````

Built with [Mintlify](https://mintlify.com).