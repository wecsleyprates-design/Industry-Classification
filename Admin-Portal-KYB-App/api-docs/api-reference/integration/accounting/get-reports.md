<!-- Source: https://docs.worthai.com/api-reference/integration/accounting/get-reports.md -->
# Get Reports

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Reports

> Retrieve reports (balance sheet, income statement, or cash flow) associated with a particular business_id.



## OpenAPI

````yaml get /accounting/report/{business_id}/{report}
openapi: 3.1.0
info:
  title: Integration Service
  description: >-
    This service is responsible for all integrations and contains all
    integration information about the business.
  contact: {}
  version: '1.0'
servers:
  - url: https://api.joinworth.com/integration/api/v1
    variables: {}
  - url: http://localhost:3005/api/v1/accounting/taxStatus
    variables: {}
  - url: http://example.com
    variables: {}
  - url: http://localhost:3000/api/v1
    variables: {}
security: []
tags:
  - name: Banking
  - name: Financials
  - name: Accounting
  - name: Public Records
  - name: manual-filing
  - name: Taxation
  - name: OpenCorporates
  - name: ZoomInfo
  - name: Verification
  - name: Verification
  - name: FAQ Chatbot
  - name: Applicants
  - name: Extract Document Details
  - name: Charts / Stats
  - name: Credit Bureau (Equifax)
  - name: Insights
    description: >-
      AI Insights Assistant that can help generate an insights report.
      Additionally users can converse with a chatbot about their report.
  - name: Risk Alerts
  - name: Queue Management
  - name: Data Scrape
  - name: White Label
  - name: File Executions
  - name: Files
  - name: OCR
  - name: Customer Integration Settings
  - name: Facts
    description: >-
      Facts provide a common interface to pick the most authoritative values for
      attribues that may be sourced from different sources.


      E.g.: Which address do we surface as the primary address for a business?
      Determine that by collecting all addresses we have and returning the
      address with the highest degree of confidence.
  - name: Adverse Media
  - name: Misc
    description: ''
paths:
  /accounting/report/{business_id}/{report}:
    parameters: []
    get:
      tags:
        - Accounting
      summary: Get Reports
      description: >-
        Retrieve reports (balance sheet, income statement, or cash flow)
        associated with a particular business_id.
      operationId: GetReports
      parameters:
        - name: business_id
          in: path
          description: Business ID
          required: true
          style: simple
          schema:
            type: string
            examples:
              - f17295d4-5237-4079-8b18-8786eddf49f3
        - name: report
          in: path
          description: >-
            Value from given list [ "accounting_balancesheet",
            "accounting_incomestatement", "accounting_cashflow"]
          required: true
          style: simple
          schema:
            type: string
            examples:
              - accounting_balancesheet
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
                  example: Wed, 14 Feb 2024 07:49:12 GMT
            Content-Length:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '77833'
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
                  example: W/"13009-x2o2/cKf8U38RMVb8sa7gt5X4pY"
          content:
            application/json; charset=utf-8:
              schema:
                allOf:
                  - $ref: '#/components/schemas/SuccessBalanceSheet'
                  - examples:
                      - status: success
                        message: Successful
                        data:
                          count: 20
                          page: 1
                          accounting_balancesheet:
                            - id: 837a9495-986a-4cae-b5c1-937da7d2c68f
                              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                              platform_id: 8
                              external_id: f6c14930-8ec2-5570-ace6-aa22d5feb47d
                              start_date: '2024-02-01T00:00:00.000Z'
                              end_date: '2024-02-29T00:00:00.000Z'
                              currency: USD
                              total_assets: '0'
                              total_equity: '0'
                              total_liabilities: '0'
                              assets:
                                name: Assets
                                items:
                                  - name: Cash & Bank
                                    items:
                                      - name: Cash
                                        items: []
                                        value: null
                                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                                      - name: Petty Cash
                                        items: []
                                        value: null
                                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                                    value: '0'
                                    account_id: null
                                  - name: Current Asset
                                    items:
                                      - name: Accounts Receivable
                                        items: []
                                        value: null
                                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                                      - name: Customer Deposits
                                        items: []
                                        value: null
                                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                                      - name: Deferred Discounts
                                        items: []
                                        value: null
                                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                                      - name: Deposits
                                        items: []
                                        value: null
                                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                                      - name: Prepaid Expenses
                                        items: []
                                        value: null
                                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                                    value: '0'
                                    account_id: null
                                  - name: Property, Plant, and Equipment
                                    items:
                                      - name: Furniture - Accumulated Depreciation
                                        items: []
                                        value: null
                                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                                      - name: Property, Plant, and Equipment
                                        items: []
                                        value: null
                                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                                      - name: Furniture
                                        items: []
                                        value: null
                                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                                      - name: Office Equipment
                                        items: []
                                        value: null
                                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                                      - name: >-
                                          Office Equipment - Accumulated
                                          Depreciation
                                        items: []
                                        value: null
                                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                                    value: '0'
                                    account_id: null
                                value: '0'
                                account_id: null
                              equity:
                                name: Equity
                                items:
                                  - name: Common Stock
                                    items: []
                                    value: null
                                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                                  - name: Opening Balance
                                    items: []
                                    value: null
                                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                                  - name: Opening Balance Adjustments
                                    items: []
                                    value: null
                                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                                  - name: Owner's Equity
                                    items: []
                                    value: null
                                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                                  - name: Retained Earnings
                                    items: []
                                    value: null
                                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                                  - name: Dividends
                                    items: []
                                    value: null
                                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                                value: '0'
                                account_id: null
                              liabilities:
                                name: Liabilities
                                items:
                                  - name: Accounts Payable
                                    items: []
                                    value: null
                                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                                  - name: Customer Credit
                                    items: []
                                    value: null
                                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                                  - name: Taxes Payable
                                    items: []
                                    value: null
                                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                                  - name: Income Tax Payable
                                    items: []
                                    value: null
                                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                                  - name: Property Tax Payable
                                    items: []
                                    value: null
                                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                                  - name: Accruals
                                    items: []
                                    value: null
                                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                                  - name: Accrued Payroll
                                    items: []
                                    value: null
                                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                                  - name: Accrued Rent
                                    items: []
                                    value: null
                                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                                  - name: Credit Cards
                                    items: []
                                    value: null
                                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                                  - name: Unearned Revenue
                                    items: []
                                    value: null
                                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                                value: '0'
                                account_id: null
                              meta:
                                note: Computed by Rutter
                              created_at: '2024-02-13T22:06:15.154Z'
                              updated_at: '2024-02-13T22:06:15.137Z'
                              task_status: SUCCESS
                            - id: 8a50526a-a008-45bb-be08-b1086e7c1ac7
                              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                              platform_id: 8
                              external_id: bec3592b-1450-55bc-85b3-5713aeb143c5
                              start_date: '2024-01-01T00:00:00.000Z'
                              end_date: '2024-01-31T00:00:00.000Z'
                              currency: USD
                              total_assets: '0'
                              total_equity: '0'
                              total_liabilities: '0'
                              assets:
                                name: Assets
                                items:
                                  - name: Cash & Bank
                                    items:
                                      - name: Cash
                                        items: []
                                        value: null
                                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                                      - name: Petty Cash
                                        items: []
                                        value: null
                                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                                    value: '0'
                                    account_id: null
                                  - name: Current Asset
                                    items:
                                      - name: Accounts Receivable
                                        items: []
                                        value: null
                                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                                      - name: Customer Deposits
                                        items: []
                                        value: null
                                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                                      - name: Deferred Discounts
                                        items: []
                                        value: null
                                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                                      - name: Deposits
                                        items: []
                                        value: null
                                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                                      - name: Prepaid Expenses
                                        items: []
                                        value: null
                                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                                    value: '0'
                                    account_id: null
                                  - name: Property, Plant, and Equipment
                                    items:
                                      - name: Furniture - Accumulated Depreciation
                                        items: []
                                        value: null
                                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                                      - name: Property, Plant, and Equipment
                                        items: []
                                        value: null
                                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                                      - name: Furniture
                                        items: []
                                        value: null
                                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                                      - name: Office Equipment
                                        items: []
                                        value: null
                                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                                      - name: >-
                                          Office Equipment - Accumulated
                                          Depreciation
                                        items: []
                                        value: null
                                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                                    value: '0'
                                    account_id: null
                                value: '0'
                                account_id: null
                              equity:
                                name: Equity
                                items:
                                  - name: Common Stock
                                    items: []
                                    value: null
                                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                                  - name: Opening Balance
                                    items: []
                                    value: null
                                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                                  - name: Opening Balance Adjustments
                                    items: []
                                    value: null
                                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                                  - name: Owner's Equity
                                    items: []
                                    value: null
                                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                                  - name: Retained Earnings
                                    items: []
                                    value: null
                                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                                  - name: Dividends
                                    items: []
                                    value: null
                                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                                value: '0'
                                account_id: null
                              liabilities:
                                name: Liabilities
                                items:
                                  - name: Accounts Payable
                                    items: []
                                    value: null
                                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                                  - name: Customer Credit
                                    items: []
                                    value: null
                                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                                  - name: Taxes Payable
                                    items: []
                                    value: null
                                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                                  - name: Income Tax Payable
                                    items: []
                                    value: null
                                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                                  - name: Property Tax Payable
                                    items: []
                                    value: null
                                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                                  - name: Accruals
                                    items: []
                                    value: null
                                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                                  - name: Accrued Payroll
                                    items: []
                                    value: null
                                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                                  - name: Accrued Rent
                                    items: []
                                    value: null
                                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                                  - name: Credit Cards
                                    items: []
                                    value: null
                                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                                  - name: Unearned Revenue
                                    items: []
                                    value: null
                                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                                value: '0'
                                account_id: null
                              meta:
                                note: Computed by Rutter
                              created_at: '2024-02-13T22:06:15.159Z'
                              updated_at: '2024-02-13T22:06:15.133Z'
                              task_status: SUCCESS
                            - id: 470c45a4-6a99-4cec-a590-6b919e4ad877
                              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                              platform_id: 8
                              external_id: 7d697f90-3edb-5db9-a5b5-bb25ab510cc8
                              start_date: '2023-12-01T00:00:00.000Z'
                              end_date: '2023-12-31T00:00:00.000Z'
                              currency: USD
                              total_assets: '0'
                              total_equity: '0'
                              total_liabilities: '0'
                              assets:
                                name: Assets
                                items:
                                  - name: Cash & Bank
                                    items:
                                      - name: Cash
                                        items: []
                                        value: null
                                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                                      - name: Petty Cash
                                        items: []
                                        value: null
                                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                                    value: '0'
                                    account_id: null
                                  - name: Current Asset
                                    items:
                                      - name: Accounts Receivable
                                        items: []
                                        value: null
                                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                                      - name: Customer Deposits
                                        items: []
                                        value: null
                                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                                      - name: Deferred Discounts
                                        items: []
                                        value: null
                                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                                      - name: Deposits
                                        items: []
                                        value: null
                                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                                      - name: Prepaid Expenses
                                        items: []
                                        value: null
                                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                                    value: '0'
                                    account_id: null
                                  - name: Property, Plant, and Equipment
                                    items:
                                      - name: Furniture - Accumulated Depreciation
                                        items: []
                                        value: null
                                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                                      - name: Property, Plant, and Equipment
                                        items: []
                                        value: null
                                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                                      - name: Furniture
                                        items: []
                                        value: null
                                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                                      - name: Office Equipment
                                        items: []
                                        value: null
                                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                                      - name: >-
                                          Office Equipment - Accumulated
                                          Depreciation
                                        items: []
                                        value: null
                                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                                    value: '0'
                                    account_id: null
                                value: '0'
                                account_id: null
                              equity:
                                name: Equity
                                items:
                                  - name: Common Stock
                                    items: []
                                    value: null
                                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                                  - name: Opening Balance
                                    items: []
                                    value: null
                                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                                  - name: Opening Balance Adjustments
                                    items: []
                                    value: null
                                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                                  - name: Owner's Equity
                                    items: []
                                    value: null
                                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                                  - name: Retained Earnings
                                    items: []
                                    value: null
                                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                                  - name: Dividends
                                    items: []
                                    value: null
                                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                                value: '0'
                                account_id: null
                              liabilities:
                                name: Liabilities
                                items:
                                  - name: Accounts Payable
                                    items: []
                                    value: null
                                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                                  - name: Customer Credit
                                    items: []
                                    value: null
                                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                                  - name: Taxes Payable
                                    items: []
                                    value: null
                                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                                  - name: Income Tax Payable
                                    items: []
                                    value: null
                                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                                  - name: Property Tax Payable
                                    items: []
                                    value: null
                                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                                  - name: Accruals
                                    items: []
                                    value: null
                                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                                  - name: Accrued Payroll
                                    items: []
                                    value: null
                                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                                  - name: Accrued Rent
                                    items: []
                                    value: null
                                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                                  - name: Credit Cards
                                    items: []
                                    value: null
                                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                                  - name: Unearned Revenue
                                    items: []
                                    value: null
                                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                                value: '0'
                                account_id: null
                              meta:
                                note: Computed by Rutter
                              created_at: '2024-02-13T22:06:15.161Z'
                              updated_at: '2024-02-13T22:06:15.129Z'
                              task_status: SUCCESS
                            - id: 83958e6f-4e56-47fa-9b8b-62267c77a9b5
                              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                              platform_id: 8
                              external_id: 231f6533-bb17-58f0-85f3-ceeb072bfed9
                              start_date: '2023-11-01T00:00:00.000Z'
                              end_date: '2023-11-30T00:00:00.000Z'
                              currency: USD
                              total_assets: '0'
                              total_equity: '0'
                              total_liabilities: '0'
                              assets:
                                name: Assets
                                items:
                                  - name: Cash & Bank
                                    items:
                                      - name: Cash
                                        items: []
                                        value: null
                                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                                      - name: Petty Cash
                                        items: []
                                        value: null
                                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                                    value: '0'
                                    account_id: null
                                  - name: Current Asset
                                    items:
                                      - name: Accounts Receivable
                                        items: []
                                        value: null
                                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                                      - name: Customer Deposits
                                        items: []
                                        value: null
                                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                                      - name: Deferred Discounts
                                        items: []
                                        value: null
                                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                                      - name: Deposits
                                        items: []
                                        value: null
                                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                                      - name: Prepaid Expenses
                                        items: []
                                        value: null
                                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                                    value: '0'
                                    account_id: null
                                  - name: Property, Plant, and Equipment
                                    items:
                                      - name: Furniture - Accumulated Depreciation
                                        items: []
                                        value: null
                                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                                      - name: Property, Plant, and Equipment
                                        items: []
                                        value: null
                                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                                      - name: Furniture
                                        items: []
                                        value: null
                                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                                      - name: Office Equipment
                                        items: []
                                        value: null
                                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                                      - name: >-
                                          Office Equipment - Accumulated
                                          Depreciation
                                        items: []
                                        value: null
                                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                                    value: '0'
                                    account_id: null
                                value: '0'
                                account_id: null
                              equity:
                                name: Equity
                                items:
                                  - name: Common Stock
                                    items: []
                                    value: null
                                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                                  - name: Opening Balance
                                    items: []
                                    value: null
                                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                                  - name: Opening Balance Adjustments
                                    items: []
                                    value: null
                                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                                  - name: Owner's Equity
                                    items: []
                                    value: null
                                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                                  - name: Retained Earnings
                                    items: []
                                    value: null
                                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                                  - name: Dividends
                                    items: []
                                    value: null
                                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                                value: '0'
                                account_id: null
                              liabilities:
                                name: Liabilities
                                items:
                                  - name: Accounts Payable
                                    items: []
                                    value: null
                                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                                  - name: Customer Credit
                                    items: []
                                    value: null
                                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                                  - name: Taxes Payable
                                    items: []
                                    value: null
                                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                                  - name: Income Tax Payable
                                    items: []
                                    value: null
                                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                                  - name: Property Tax Payable
                                    items: []
                                    value: null
                                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                                  - name: Accruals
                                    items: []
                                    value: null
                                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                                  - name: Accrued Payroll
                                    items: []
                                    value: null
                                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                                  - name: Accrued Rent
                                    items: []
                                    value: null
                                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                                  - name: Credit Cards
                                    items: []
                                    value: null
                                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                                  - name: Unearned Revenue
                                    items: []
                                    value: null
                                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                                value: '0'
                                account_id: null
                              meta:
                                note: Computed by Rutter
                              created_at: '2024-02-13T22:06:15.164Z'
                              updated_at: '2024-02-13T22:06:15.127Z'
                              task_status: SUCCESS
                            - id: c3f64d61-da65-4c86-8ede-27570293e7ee
                              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                              platform_id: 8
                              external_id: 9e6880ad-dfb9-5520-9f7e-63abe67417e8
                              start_date: '2023-10-01T00:00:00.000Z'
                              end_date: '2023-10-31T00:00:00.000Z'
                              currency: USD
                              total_assets: '0'
                              total_equity: '0'
                              total_liabilities: '0'
                              assets:
                                name: Assets
                                items:
                                  - name: Cash & Bank
                                    items:
                                      - name: Cash
                                        items: []
                                        value: null
                                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                                      - name: Petty Cash
                                        items: []
                                        value: null
                                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                                    value: '0'
                                    account_id: null
                                  - name: Current Asset
                                    items:
                                      - name: Accounts Receivable
                                        items: []
                                        value: null
                                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                                      - name: Customer Deposits
                                        items: []
                                        value: null
                                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                                      - name: Deferred Discounts
                                        items: []
                                        value: null
                                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                                      - name: Deposits
                                        items: []
                                        value: null
                                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                                      - name: Prepaid Expenses
                                        items: []
                                        value: null
                                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                                    value: '0'
                                    account_id: null
                                  - name: Property, Plant, and Equipment
                                    items:
                                      - name: Furniture - Accumulated Depreciation
                                        items: []
                                        value: null
                                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                                      - name: Property, Plant, and Equipment
                                        items: []
                                        value: null
                                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                                      - name: Furniture
                                        items: []
                                        value: null
                                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                                      - name: Office Equipment
                                        items: []
                                        value: null
                                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                                      - name: >-
                                          Office Equipment - Accumulated
                                          Depreciation
                                        items: []
                                        value: null
                                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                                    value: '0'
                                    account_id: null
                                value: '0'
                                account_id: null
                              equity:
                                name: Equity
                                items:
                                  - name: Common Stock
                                    items: []
                                    value: null
                                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                                  - name: Opening Balance
                                    items: []
                                    value: null
                                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                                  - name: Opening Balance Adjustments
                                    items: []
                                    value: null
                                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                                  - name: Owner's Equity
                                    items: []
                                    value: null
                                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                                  - name: Retained Earnings
                                    items: []
                                    value: null
                                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                                  - name: Dividends
                                    items: []
                                    value: null
                                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                                value: '0'
                                account_id: null
                              liabilities:
                                name: Liabilities
                                items:
                                  - name: Accounts Payable
                                    items: []
                                    value: null
                                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                                  - name: Customer Credit
                                    items: []
                                    value: null
                                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                                  - name: Taxes Payable
                                    items: []
                                    value: null
                                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                                  - name: Income Tax Payable
                                    items: []
                                    value: null
                                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                                  - name: Property Tax Payable
                                    items: []
                                    value: null
                                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                                  - name: Accruals
                                    items: []
                                    value: null
                                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                                  - name: Accrued Payroll
                                    items: []
                                    value: null
                                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                                  - name: Accrued Rent
                                    items: []
                                    value: null
                                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                                  - name: Credit Cards
                                    items: []
                                    value: null
                                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                                  - name: Unearned Revenue
                                    items: []
                                    value: null
                                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                                value: '0'
                                account_id: null
                              meta:
                                note: Computed by Rutter
                              created_at: '2024-02-13T22:06:15.166Z'
                              updated_at: '2024-02-13T22:06:15.120Z'
                              task_status: SUCCESS
                            - id: 08f37ff7-adef-4e37-a397-f4a5e7aca2a5
                              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                              platform_id: 8
                              external_id: a2b548af-9a1b-5235-bbe6-9ea65c5bc20b
                              start_date: '2023-09-01T00:00:00.000Z'
                              end_date: '2023-09-30T00:00:00.000Z'
                              currency: USD
                              total_assets: '0'
                              total_equity: '0'
                              total_liabilities: '0'
                              assets:
                                name: Assets
                                items:
                                  - name: Cash & Bank
                                    items:
                                      - name: Cash
                                        items: []
                                        value: null
                                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                                      - name: Petty Cash
                                        items: []
                                        value: null
                                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                                    value: '0'
                                    account_id: null
                                  - name: Current Asset
                                    items:
                                      - name: Accounts Receivable
                                        items: []
                                        value: null
                                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                                      - name: Customer Deposits
                                        items: []
                                        value: null
                                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                                      - name: Deferred Discounts
                                        items: []
                                        value: null
                                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                                      - name: Deposits
                                        items: []
                                        value: null
                                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                                      - name: Prepaid Expenses
                                        items: []
                                        value: null
                                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                                    value: '0'
                                    account_id: null
                                  - name: Property, Plant, and Equipment
                                    items:
                                      - name: Furniture - Accumulated Depreciation
                                        items: []
                                        value: null
                                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                                      - name: Property, Plant, and Equipment
                                        items: []
                                        value: null
                                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                                      - name: Furniture
                                        items: []
                                        value: null
                                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                                      - name: Office Equipment
                                        items: []
                                        value: null
                                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                                      - name: >-
                                          Office Equipment - Accumulated
                                          Depreciation
                                        items: []
                                        value: null
                                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                                    value: '0'
                                    account_id: null
                                value: '0'
                                account_id: null
                              equity:
                                name: Equity
                                items:
                                  - name: Common Stock
                                    items: []
                                    value: null
                                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                                  - name: Opening Balance
                                    items: []
                                    value: null
                                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                                  - name: Opening Balance Adjustments
                                    items: []
                                    value: null
                                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                                  - name: Owner's Equity
                                    items: []
                                    value: null
                                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                                  - name: Retained Earnings
                                    items: []
                                    value: null
                                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                                  - name: Dividends
                                    items: []
                                    value: null
                                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                                value: '0'
                                account_id: null
                              liabilities:
                                name: Liabilities
                                items:
                                  - name: Accounts Payable
                                    items: []
                                    value: null
                                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                                  - name: Customer Credit
                                    items: []
                                    value: null
                                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                                  - name: Taxes Payable
                                    items: []
                                    value: null
                                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                                  - name: Income Tax Payable
                                    items: []
                                    value: null
                                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                                  - name: Property Tax Payable
                                    items: []
                                    value: null
                                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                                  - name: Accruals
                                    items: []
                                    value: null
                                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                                  - name: Accrued Payroll
                                    items: []
                                    value: null
                                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                                  - name: Accrued Rent
                                    items: []
                                    value: null
                                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                                  - name: Credit Cards
                                    items: []
                                    value: null
                                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                                  - name: Unearned Revenue
                                    items: []
                                    value: null
                                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                                value: '0'
                                account_id: null
                              meta:
                                note: Computed by Rutter
                              created_at: '2024-02-13T22:06:15.168Z'
                              updated_at: '2024-02-13T22:06:15.115Z'
                              task_status: SUCCESS
                            - id: 8a343105-994b-4730-b754-33e940a4506c
                              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                              platform_id: 8
                              external_id: 344c4b2f-9ec1-5591-aa91-11ac2f87a221
                              start_date: '2023-08-01T00:00:00.000Z'
                              end_date: '2023-08-31T00:00:00.000Z'
                              currency: USD
                              total_assets: '0'
                              total_equity: '0'
                              total_liabilities: '0'
                              assets:
                                name: Assets
                                items:
                                  - name: Cash & Bank
                                    items:
                                      - name: Cash
                                        items: []
                                        value: null
                                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                                      - name: Petty Cash
                                        items: []
                                        value: null
                                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                                    value: '0'
                                    account_id: null
                                  - name: Current Asset
                                    items:
                                      - name: Accounts Receivable
                                        items: []
                                        value: null
                                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                                      - name: Customer Deposits
                                        items: []
                                        value: null
                                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                                      - name: Deferred Discounts
                                        items: []
                                        value: null
                                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                                      - name: Deposits
                                        items: []
                                        value: null
                                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                                      - name: Prepaid Expenses
                                        items: []
                                        value: null
                                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                                    value: '0'
                                    account_id: null
                                  - name: Property, Plant, and Equipment
                                    items:
                                      - name: Furniture - Accumulated Depreciation
                                        items: []
                                        value: null
                                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                                      - name: Property, Plant, and Equipment
                                        items: []
                                        value: null
                                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                                      - name: Furniture
                                        items: []
                                        value: null
                                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                                      - name: Office Equipment
                                        items: []
                                        value: null
                                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                                      - name: >-
                                          Office Equipment - Accumulated
                                          Depreciation
                                        items: []
                                        value: null
                                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                                    value: '0'
                                    account_id: null
                                value: '0'
                                account_id: null
                              equity:
                                name: Equity
                                items:
                                  - name: Common Stock
                                    items: []
                                    value: null
                                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                                  - name: Opening Balance
                                    items: []
                                    value: null
                                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                                  - name: Opening Balance Adjustments
                                    items: []
                                    value: null
                                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                                  - name: Owner's Equity
                                    items: []
                                    value: null
                                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                                  - name: Retained Earnings
                                    items: []
                                    value: null
                                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                                  - name: Dividends
                                    items: []
                                    value: null
                                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                                value: '0'
                                account_id: null
                              liabilities:
                                name: Liabilities
                                items:
                                  - name: Accounts Payable
                                    items: []
                                    value: null
                                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                                  - name: Customer Credit
                                    items: []
                                    value: null
                                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                                  - name: Taxes Payable
                                    items: []
                                    value: null
                                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                                  - name: Income Tax Payable
                                    items: []
                                    value: null
                                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                                  - name: Property Tax Payable
                                    items: []
                                    value: null
                                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                                  - name: Accruals
                                    items: []
                                    value: null
                                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                                  - name: Accrued Payroll
                                    items: []
                                    value: null
                                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                                  - name: Accrued Rent
                                    items: []
                                    value: null
                                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                                  - name: Credit Cards
                                    items: []
                                    value: null
                                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                                  - name: Unearned Revenue
                                    items: []
                                    value: null
                                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                                value: '0'
                                account_id: null
                              meta:
                                note: Computed by Rutter
                              created_at: '2024-02-13T22:06:15.170Z'
                              updated_at: '2024-02-13T22:06:15.110Z'
                              task_status: SUCCESS
                            - id: 20cf3f3f-857a-418b-918e-d97b84e8699c
                              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                              platform_id: 8
                              external_id: 254d96c0-6447-50f2-a56b-49577c48978a
                              start_date: '2023-07-01T00:00:00.000Z'
                              end_date: '2023-07-31T00:00:00.000Z'
                              currency: USD
                              total_assets: '0'
                              total_equity: '0'
                              total_liabilities: '0'
                              assets:
                                name: Assets
                                items:
                                  - name: Cash & Bank
                                    items:
                                      - name: Cash
                                        items: []
                                        value: null
                                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                                      - name: Petty Cash
                                        items: []
                                        value: null
                                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                                    value: '0'
                                    account_id: null
                                  - name: Current Asset
                                    items:
                                      - name: Accounts Receivable
                                        items: []
                                        value: null
                                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                                      - name: Customer Deposits
                                        items: []
                                        value: null
                                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                                      - name: Deferred Discounts
                                        items: []
                                        value: null
                                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                                      - name: Deposits
                                        items: []
                                        value: null
                                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                                      - name: Prepaid Expenses
                                        items: []
                                        value: null
                                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                                    value: '0'
                                    account_id: null
                                  - name: Property, Plant, and Equipment
                                    items:
                                      - name: Furniture - Accumulated Depreciation
                                        items: []
                                        value: null
                                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                                      - name: Property, Plant, and Equipment
                                        items: []
                                        value: null
                                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                                      - name: Furniture
                                        items: []
                                        value: null
                                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                                      - name: Office Equipment
                                        items: []
                                        value: null
                                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                                      - name: >-
                                          Office Equipment - Accumulated
                                          Depreciation
                                        items: []
                                        value: null
                                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                                    value: '0'
                                    account_id: null
                                value: '0'
                                account_id: null
                              equity:
                                name: Equity
                                items:
                                  - name: Common Stock
                                    items: []
                                    value: null
                                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                                  - name: Opening Balance
                                    items: []
                                    value: null
                                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                                  - name: Opening Balance Adjustments
                                    items: []
                                    value: null
                                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                                  - name: Owner's Equity
                                    items: []
                                    value: null
                                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                                  - name: Retained Earnings
                                    items: []
                                    value: null
                                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                                  - name: Dividends
                                    items: []
                                    value: null
                                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                                value: '0'
                                account_id: null
                              liabilities:
                                name: Liabilities
                                items:
                                  - name: Accounts Payable
                                    items: []
                                    value: null
                                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                                  - name: Customer Credit
                                    items: []
                                    value: null
                                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                                  - name: Taxes Payable
                                    items: []
                                    value: null
                                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                                  - name: Income Tax Payable
                                    items: []
                                    value: null
                                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                                  - name: Property Tax Payable
                                    items: []
                                    value: null
                                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                                  - name: Accruals
                                    items: []
                                    value: null
                                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                                  - name: Accrued Payroll
                                    items: []
                                    value: null
                                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                                  - name: Accrued Rent
                                    items: []
                                    value: null
                                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                                  - name: Credit Cards
                                    items: []
                                    value: null
                                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                                  - name: Unearned Revenue
                                    items: []
                                    value: null
                                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                                value: '0'
                                account_id: null
                              meta:
                                note: Computed by Rutter
                              created_at: '2024-02-13T22:06:15.172Z'
                              updated_at: '2024-02-13T22:06:15.106Z'
                              task_status: SUCCESS
                            - id: f4c1acd2-6cfb-4a11-8ff1-58079159f3e1
                              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                              platform_id: 8
                              external_id: b37c6a61-4b03-59af-806c-0c59b9574f6d
                              start_date: '2023-06-01T00:00:00.000Z'
                              end_date: '2023-06-30T00:00:00.000Z'
                              currency: USD
                              total_assets: '0'
                              total_equity: '0'
                              total_liabilities: '0'
                              assets:
                                name: Assets
                                items:
                                  - name: Cash & Bank
                                    items:
                                      - name: Cash
                                        items: []
                                        value: null
                                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                                      - name: Petty Cash
                                        items: []
                                        value: null
                                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                                    value: '0'
                                    account_id: null
                                  - name: Current Asset
                                    items:
                                      - name: Accounts Receivable
                                        items: []
                                        value: null
                                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                                      - name: Customer Deposits
                                        items: []
                                        value: null
                                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                                      - name: Deferred Discounts
                                        items: []
                                        value: null
                                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                                      - name: Deposits
                                        items: []
                                        value: null
                                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                                      - name: Prepaid Expenses
                                        items: []
                                        value: null
                                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                                    value: '0'
                                    account_id: null
                                  - name: Property, Plant, and Equipment
                                    items:
                                      - name: Furniture - Accumulated Depreciation
                                        items: []
                                        value: null
                                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                                      - name: Property, Plant, and Equipment
                                        items: []
                                        value: null
                                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                                      - name: Furniture
                                        items: []
                                        value: null
                                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                                      - name: Office Equipment
                                        items: []
                                        value: null
                                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                                      - name: >-
                                          Office Equipment - Accumulated
                                          Depreciation
                                        items: []
                                        value: null
                                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                                    value: '0'
                                    account_id: null
                                value: '0'
                                account_id: null
                              equity:
                                name: Equity
                                items:
                                  - name: Common Stock
                                    items: []
                                    value: null
                                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                                  - name: Opening Balance
                                    items: []
                                    value: null
                                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                                  - name: Opening Balance Adjustments
                                    items: []
                                    value: null
                                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                                  - name: Owner's Equity
                                    items: []
                                    value: null
                                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                                  - name: Retained Earnings
                                    items: []
                                    value: null
                                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                                  - name: Dividends
                                    items: []
                                    value: null
                                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                                value: '0'
                                account_id: null
                              liabilities:
                                name: Liabilities
                                items:
                                  - name: Accounts Payable
                                    items: []
                                    value: null
                                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                                  - name: Customer Credit
                                    items: []
                                    value: null
                                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                                  - name: Taxes Payable
                                    items: []
                                    value: null
                                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                                  - name: Income Tax Payable
                                    items: []
                                    value: null
                                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                                  - name: Property Tax Payable
                                    items: []
                                    value: null
                                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                                  - name: Accruals
                                    items: []
                                    value: null
                                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                                  - name: Accrued Payroll
                                    items: []
                                    value: null
                                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                                  - name: Accrued Rent
                                    items: []
                                    value: null
                                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                                  - name: Credit Cards
                                    items: []
                                    value: null
                                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                                  - name: Unearned Revenue
                                    items: []
                                    value: null
                                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                                value: '0'
                                account_id: null
                              meta:
                                note: Computed by Rutter
                              created_at: '2024-02-13T22:06:15.174Z'
                              updated_at: '2024-02-13T22:06:15.101Z'
                              task_status: SUCCESS
                            - id: 9e608eb4-59c2-4ae5-bdff-01658e88e208
                              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                              platform_id: 8
                              external_id: c1d0c8f3-e8bc-510d-9dcf-3afe83f234c1
                              start_date: '2023-05-01T00:00:00.000Z'
                              end_date: '2023-05-31T00:00:00.000Z'
                              currency: USD
                              total_assets: '0'
                              total_equity: '0'
                              total_liabilities: '0'
                              assets:
                                name: Assets
                                items:
                                  - name: Cash & Bank
                                    items:
                                      - name: Cash
                                        items: []
                                        value: null
                                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                                      - name: Petty Cash
                                        items: []
                                        value: null
                                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                                    value: '0'
                                    account_id: null
                                  - name: Current Asset
                                    items:
                                      - name: Accounts Receivable
                                        items: []
                                        value: null
                                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                                      - name: Customer Deposits
                                        items: []
                                        value: null
                                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                                      - name: Deferred Discounts
                                        items: []
                                        value: null
                                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                                      - name: Deposits
                                        items: []
                                        value: null
                                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                                      - name: Prepaid Expenses
                                        items: []
                                        value: null
                                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                                    value: '0'
                                    account_id: null
                                  - name: Property, Plant, and Equipment
                                    items:
                                      - name: Furniture - Accumulated Depreciation
                                        items: []
                                        value: null
                                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                                      - name: Property, Plant, and Equipment
                                        items: []
                                        value: null
                                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                                      - name: Furniture
                                        items: []
                                        value: null
                                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                                      - name: Office Equipment
                                        items: []
                                        value: null
                                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                                      - name: >-
                                          Office Equipment - Accumulated
                                          Depreciation
                                        items: []
                                        value: null
                                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                                    value: '0'
                                    account_id: null
                                value: '0'
                                account_id: null
                              equity:
                                name: Equity
                                items:
                                  - name: Common Stock
                                    items: []
                                    value: null
                                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                                  - name: Opening Balance
                                    items: []
                                    value: null
                                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                                  - name: Opening Balance Adjustments
                                    items: []
                                    value: null
                                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                                  - name: Owner's Equity
                                    items: []
                                    value: null
                                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                                  - name: Retained Earnings
                                    items: []
                                    value: null
                                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                                  - name: Dividends
                                    items: []
                                    value: null
                                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                                value: '0'
                                account_id: null
                              liabilities:
                                name: Liabilities
                                items:
                                  - name: Accounts Payable
                                    items: []
                                    value: null
                                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                                  - name: Customer Credit
                                    items: []
                                    value: null
                                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                                  - name: Taxes Payable
                                    items: []
                                    value: null
                                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                                  - name: Income Tax Payable
                                    items: []
                                    value: null
                                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                                  - name: Property Tax Payable
                                    items: []
                                    value: null
                                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                                  - name: Accruals
                                    items: []
                                    value: null
                                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                                  - name: Accrued Payroll
                                    items: []
                                    value: null
                                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                                  - name: Accrued Rent
                                    items: []
                                    value: null
                                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                                  - name: Credit Cards
                                    items: []
                                    value: null
                                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                                  - name: Unearned Revenue
                                    items: []
                                    value: null
                                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                                value: '0'
                                account_id: null
                              meta:
                                note: Computed by Rutter
                              created_at: '2024-02-13T22:06:15.176Z'
                              updated_at: '2024-02-13T22:06:15.097Z'
                              task_status: SUCCESS
                            - id: 97b7e48a-7dbe-4984-bf3a-54c9bfe91817
                              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                              platform_id: 8
                              external_id: e236c83b-38a3-52a8-8793-8bbc1507ce58
                              start_date: '2023-04-01T00:00:00.000Z'
                              end_date: '2023-04-30T00:00:00.000Z'
                              currency: USD
                              total_assets: '0'
                              total_equity: '0'
                              total_liabilities: '0'
                              assets:
                                name: Assets
                                items:
                                  - name: Cash & Bank
                                    items:
                                      - name: Cash
                                        items: []
                                        value: null
                                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                                      - name: Petty Cash
                                        items: []
                                        value: null
                                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                                    value: '0'
                                    account_id: null
                                  - name: Current Asset
                                    items:
                                      - name: Accounts Receivable
                                        items: []
                                        value: null
                                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                                      - name: Customer Deposits
                                        items: []
                                        value: null
                                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                                      - name: Deferred Discounts
                                        items: []
                                        value: null
                                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                                      - name: Deposits
                                        items: []
                                        value: null
                                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                                      - name: Prepaid Expenses
                                        items: []
                                        value: null
                                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                                    value: '0'
                                    account_id: null
                                  - name: Property, Plant, and Equipment
                                    items:
                                      - name: Furniture - Accumulated Depreciation
                                        items: []
                                        value: null
                                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                                      - name: Property, Plant, and Equipment
                                        items: []
                                        value: null
                                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                                      - name: Furniture
                                        items: []
                                        value: null
                                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                                      - name: Office Equipment
                                        items: []
                                        value: null
                                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                                      - name: >-
                                          Office Equipment - Accumulated
                                          Depreciation
                                        items: []
                                        value: null
                                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                                    value: '0'
                                    account_id: null
                                value: '0'
                                account_id: null
                              equity:
                                name: Equity
                                items:
                                  - name: Common Stock
                                    items: []
                                    value: null
                                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                                  - name: Opening Balance
                                    items: []
                                    value: null
                                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                                  - name: Opening Balance Adjustments
                                    items: []
                                    value: null
                                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                                  - name: Owner's Equity
                                    items: []
                                    value: null
                                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                                  - name: Retained Earnings
                                    items: []
                                    value: null
                                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                                  - name: Dividends
                                    items: []
                                    value: null
                                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                                value: '0'
                                account_id: null
                              liabilities:
                                name: Liabilities
                                items:
                                  - name: Accounts Payable
                                    items: []
                                    value: null
                                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                                  - name: Customer Credit
                                    items: []
                                    value: null
                                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                                  - name: Taxes Payable
                                    items: []
                                    value: null
                                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                                  - name: Income Tax Payable
                                    items: []
                                    value: null
                                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                                  - name: Property Tax Payable
                                    items: []
                                    value: null
                                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                                  - name: Accruals
                                    items: []
                                    value: null
                                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                                  - name: Accrued Payroll
                                    items: []
                                    value: null
                                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                                  - name: Accrued Rent
                                    items: []
                                    value: null
                                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                                  - name: Credit Cards
                                    items: []
                                    value: null
                                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                                  - name: Unearned Revenue
                                    items: []
                                    value: null
                                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                                value: '0'
                                account_id: null
                              meta:
                                note: Computed by Rutter
                              created_at: '2024-02-13T22:06:15.178Z'
                              updated_at: '2024-02-13T22:06:15.092Z'
                              task_status: SUCCESS
                            - id: 7e215746-64b5-47aa-a1e1-8ddcdfb4ed69
                              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                              platform_id: 8
                              external_id: 50a8564b-7d16-5216-85b3-05e2813bf44c
                              start_date: '2023-03-01T00:00:00.000Z'
                              end_date: '2023-03-31T00:00:00.000Z'
                              currency: USD
                              total_assets: '0'
                              total_equity: '0'
                              total_liabilities: '0'
                              assets:
                                name: Assets
                                items:
                                  - name: Cash & Bank
                                    items:
                                      - name: Cash
                                        items: []
                                        value: null
                                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                                      - name: Petty Cash
                                        items: []
                                        value: null
                                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                                    value: '0'
                                    account_id: null
                                  - name: Current Asset
                                    items:
                                      - name: Accounts Receivable
                                        items: []
                                        value: null
                                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                                      - name: Customer Deposits
                                        items: []
                                        value: null
                                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                                      - name: Deferred Discounts
                                        items: []
                                        value: null
                                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                                      - name: Deposits
                                        items: []
                                        value: null
                                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                                      - name: Prepaid Expenses
                                        items: []
                                        value: null
                                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                                    value: '0'
                                    account_id: null
                                  - name: Property, Plant, and Equipment
                                    items:
                                      - name: Furniture - Accumulated Depreciation
                                        items: []
                                        value: null
                                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                                      - name: Property, Plant, and Equipment
                                        items: []
                                        value: null
                                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                                      - name: Furniture
                                        items: []
                                        value: null
                                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                                      - name: Office Equipment
                                        items: []
                                        value: null
                                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                                      - name: >-
                                          Office Equipment - Accumulated
                                          Depreciation
                                        items: []
                                        value: null
                                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                                    value: '0'
                                    account_id: null
                                value: '0'
                                account_id: null
                              equity:
                                name: Equity
                                items:
                                  - name: Common Stock
                                    items: []
                                    value: null
                                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                                  - name: Opening Balance
                                    items: []
                                    value: null
                                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                                  - name: Opening Balance Adjustments
                                    items: []
                                    value: null
                                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                                  - name: Owner's Equity
                                    items: []
                                    value: null
                                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                                  - name: Retained Earnings
                                    items: []
                                    value: null
                                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                                  - name: Dividends
                                    items: []
                                    value: null
                                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                                value: '0'
                                account_id: null
                              liabilities:
                                name: Liabilities
                                items:
                                  - name: Accounts Payable
                                    items: []
                                    value: null
                                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                                  - name: Customer Credit
                                    items: []
                                    value: null
                                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                                  - name: Taxes Payable
                                    items: []
                                    value: null
                                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                                  - name: Income Tax Payable
                                    items: []
                                    value: null
                                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                                  - name: Property Tax Payable
                                    items: []
                                    value: null
                                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                                  - name: Accruals
                                    items: []
                                    value: null
                                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                                  - name: Accrued Payroll
                                    items: []
                                    value: null
                                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                                  - name: Accrued Rent
                                    items: []
                                    value: null
                                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                                  - name: Credit Cards
                                    items: []
                                    value: null
                                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                                  - name: Unearned Revenue
                                    items: []
                                    value: null
                                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                                value: '0'
                                account_id: null
                              meta:
                                note: Computed by Rutter
                              created_at: '2024-02-13T22:06:15.181Z'
                              updated_at: '2024-02-13T22:06:15.088Z'
                              task_status: SUCCESS
                            - id: 88097521-aff7-49ca-bfe4-45ab6c4bbfb6
                              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                              platform_id: 8
                              external_id: ccccc50d-d4d6-598c-84e0-ed8d6ed1229f
                              start_date: '2023-02-01T00:00:00.000Z'
                              end_date: '2023-02-28T00:00:00.000Z'
                              currency: USD
                              total_assets: '0'
                              total_equity: '0'
                              total_liabilities: '0'
                              assets:
                                name: Assets
                                items:
                                  - name: Cash & Bank
                                    items:
                                      - name: Cash
                                        items: []
                                        value: null
                                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                                      - name: Petty Cash
                                        items: []
                                        value: null
                                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                                    value: '0'
                                    account_id: null
                                  - name: Current Asset
                                    items:
                                      - name: Accounts Receivable
                                        items: []
                                        value: null
                                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                                      - name: Customer Deposits
                                        items: []
                                        value: null
                                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                                      - name: Deferred Discounts
                                        items: []
                                        value: null
                                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                                      - name: Deposits
                                        items: []
                                        value: null
                                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                                      - name: Prepaid Expenses
                                        items: []
                                        value: null
                                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                                    value: '0'
                                    account_id: null
                                  - name: Property, Plant, and Equipment
                                    items:
                                      - name: Furniture - Accumulated Depreciation
                                        items: []
                                        value: null
                                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                                      - name: Property, Plant, and Equipment
                                        items: []
                                        value: null
                                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                                      - name: Furniture
                                        items: []
                                        value: null
                                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                                      - name: Office Equipment
                                        items: []
                                        value: null
                                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                                      - name: >-
                                          Office Equipment - Accumulated
                                          Depreciation
                                        items: []
                                        value: null
                                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                                    value: '0'
                                    account_id: null
                                value: '0'
                                account_id: null
                              equity:
                                name: Equity
                                items:
                                  - name: Common Stock
                                    items: []
                                    value: null
                                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                                  - name: Opening Balance
                                    items: []
                                    value: null
                                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                                  - name: Opening Balance Adjustments
                                    items: []
                                    value: null
                                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                                  - name: Owner's Equity
                                    items: []
                                    value: null
                                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                                  - name: Retained Earnings
                                    items: []
                                    value: null
                                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                                  - name: Dividends
                                    items: []
                                    value: null
                                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                                value: '0'
                                account_id: null
                              liabilities:
                                name: Liabilities
                                items:
                                  - name: Accounts Payable
                                    items: []
                                    value: null
                                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                                  - name: Customer Credit
                                    items: []
                                    value: null
                                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                                  - name: Taxes Payable
                                    items: []
                                    value: null
                                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                                  - name: Income Tax Payable
                                    items: []
                                    value: null
                                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                                  - name: Property Tax Payable
                                    items: []
                                    value: null
                                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                                  - name: Accruals
                                    items: []
                                    value: null
                                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                                  - name: Accrued Payroll
                                    items: []
                                    value: null
                                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                                  - name: Accrued Rent
                                    items: []
                                    value: null
                                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                                  - name: Credit Cards
                                    items: []
                                    value: null
                                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                                  - name: Unearned Revenue
                                    items: []
                                    value: null
                                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                                value: '0'
                                account_id: null
                              meta:
                                note: Computed by Rutter
                              created_at: '2024-02-13T22:06:15.183Z'
                              updated_at: '2024-02-13T22:06:15.084Z'
                              task_status: SUCCESS
                            - id: 876ddf7e-a0e8-49fe-b4fc-39a9c1551ede
                              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                              platform_id: 8
                              external_id: edfc4e0f-5b8a-55ff-ab71-608b74dfe159
                              start_date: '2023-01-01T00:00:00.000Z'
                              end_date: '2023-01-31T00:00:00.000Z'
                              currency: USD
                              total_assets: '0'
                              total_equity: '0'
                              total_liabilities: '0'
                              assets:
                                name: Assets
                                items:
                                  - name: Cash & Bank
                                    items:
                                      - name: Cash
                                        items: []
                                        value: null
                                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                                      - name: Petty Cash
                                        items: []
                                        value: null
                                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                                    value: '0'
                                    account_id: null
                                  - name: Current Asset
                                    items:
                                      - name: Accounts Receivable
                                        items: []
                                        value: null
                                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                                      - name: Customer Deposits
                                        items: []
                                        value: null
                                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                                      - name: Deferred Discounts
                                        items: []
                                        value: null
                                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                                      - name: Deposits
                                        items: []
                                        value: null
                                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                                      - name: Prepaid Expenses
                                        items: []
                                        value: null
                                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                                    value: '0'
                                    account_id: null
                                  - name: Property, Plant, and Equipment
                                    items:
                                      - name: Furniture - Accumulated Depreciation
                                        items: []
                                        value: null
                                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                                      - name: Property, Plant, and Equipment
                                        items: []
                                        value: null
                                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                                      - name: Furniture
                                        items: []
                                        value: null
                                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                                      - name: Office Equipment
                                        items: []
                                        value: null
                                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                                      - name: >-
                                          Office Equipment - Accumulated
                                          Depreciation
                                        items: []
                                        value: null
                                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                                    value: '0'
                                    account_id: null
                                value: '0'
                                account_id: null
                              equity:
                                name: Equity
                                items:
                                  - name: Common Stock
                                    items: []
                                    value: null
                                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                                  - name: Opening Balance
                                    items: []
                                    value: null
                                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                                  - name: Opening Balance Adjustments
                                    items: []
                                    value: null
                                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                                  - name: Owner's Equity
                                    items: []
                                    value: null
                                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                                  - name: Retained Earnings
                                    items: []
                                    value: null
                                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                                  - name: Dividends
                                    items: []
                                    value: null
                                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                                value: '0'
                                account_id: null
                              liabilities:
                                name: Liabilities
                                items:
                                  - name: Accounts Payable
                                    items: []
                                    value: null
                                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                                  - name: Customer Credit
                                    items: []
                                    value: null
                                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                                  - name: Taxes Payable
                                    items: []
                                    value: null
                                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                                  - name: Income Tax Payable
                                    items: []
                                    value: null
                                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                                  - name: Property Tax Payable
                                    items: []
                                    value: null
                                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                                  - name: Accruals
                                    items: []
                                    value: null
                                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                                  - name: Accrued Payroll
                                    items: []
                                    value: null
                                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                                  - name: Accrued Rent
                                    items: []
                                    value: null
                                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                                  - name: Credit Cards
                                    items: []
                                    value: null
                                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                                  - name: Unearned Revenue
                                    items: []
                                    value: null
                                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                                value: '0'
                                account_id: null
                              meta:
                                note: Computed by Rutter
                              created_at: '2024-02-13T22:06:15.195Z'
                              updated_at: '2024-02-13T22:06:15.079Z'
                              task_status: SUCCESS
                            - id: b744219b-7a29-42c6-b043-e773ae5e6a64
                              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                              platform_id: 8
                              external_id: eb5b803a-15f8-5712-bd0d-b5e931488999
                              start_date: '2022-12-01T00:00:00.000Z'
                              end_date: '2022-12-31T00:00:00.000Z'
                              currency: USD
                              total_assets: '0'
                              total_equity: '0'
                              total_liabilities: '0'
                              assets:
                                name: Assets
                                items:
                                  - name: Cash & Bank
                                    items:
                                      - name: Cash
                                        items: []
                                        value: null
                                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                                      - name: Petty Cash
                                        items: []
                                        value: null
                                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                                    value: '0'
                                    account_id: null
                                  - name: Current Asset
                                    items:
                                      - name: Accounts Receivable
                                        items: []
                                        value: null
                                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                                      - name: Customer Deposits
                                        items: []
                                        value: null
                                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                                      - name: Deferred Discounts
                                        items: []
                                        value: null
                                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                                      - name: Deposits
                                        items: []
                                        value: null
                                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                                      - name: Prepaid Expenses
                                        items: []
                                        value: null
                                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                                    value: '0'
                                    account_id: null
                                  - name: Property, Plant, and Equipment
                                    items:
                                      - name: Furniture - Accumulated Depreciation
                                        items: []
                                        value: null
                                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                                      - name: Property, Plant, and Equipment
                                        items: []
                                        value: null
                                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                                      - name: Furniture
                                        items: []
                                        value: null
                                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                                      - name: Office Equipment
                                        items: []
                                        value: null
                                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                                      - name: >-
                                          Office Equipment - Accumulated
                                          Depreciation
                                        items: []
                                        value: null
                                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                                    value: '0'
                                    account_id: null
                                value: '0'
                                account_id: null
                              equity:
                                name: Equity
                                items:
                                  - name: Common Stock
                                    items: []
                                    value: null
                                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                                  - name: Opening Balance
                                    items: []
                                    value: null
                                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                                  - name: Opening Balance Adjustments
                                    items: []
                                    value: null
                                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                                  - name: Owner's Equity
                                    items: []
                                    value: null
                                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                                  - name: Retained Earnings
                                    items: []
                                    value: null
                                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                                  - name: Dividends
                                    items: []
                                    value: null
                                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                                value: '0'
                                account_id: null
                              liabilities:
                                name: Liabilities
                                items:
                                  - name: Accounts Payable
                                    items: []
                                    value: null
                                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                                  - name: Customer Credit
                                    items: []
                                    value: null
                                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                                  - name: Taxes Payable
                                    items: []
                                    value: null
                                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                                  - name: Income Tax Payable
                                    items: []
                                    value: null
                                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                                  - name: Property Tax Payable
                                    items: []
                                    value: null
                                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                                  - name: Accruals
                                    items: []
                                    value: null
                                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                                  - name: Accrued Payroll
                                    items: []
                                    value: null
                                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                                  - name: Accrued Rent
                                    items: []
                                    value: null
                                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                                  - name: Credit Cards
                                    items: []
                                    value: null
                                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                                  - name: Unearned Revenue
                                    items: []
                                    value: null
                                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                                value: '0'
                                account_id: null
                              meta:
                                note: Computed by Rutter
                              created_at: '2024-02-13T22:06:15.197Z'
                              updated_at: '2024-02-13T22:06:15.075Z'
                              task_status: SUCCESS
                            - id: 9ccf4961-0416-403e-bee3-626a02063e66
                              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                              platform_id: 8
                              external_id: 947dd708-0ee4-54fb-9a87-abe2fb30e64f
                              start_date: '2022-11-01T00:00:00.000Z'
                              end_date: '2022-11-30T00:00:00.000Z'
                              currency: USD
                              total_assets: '0'
                              total_equity: '0'
                              total_liabilities: '0'
                              assets:
                                name: Assets
                                items:
                                  - name: Cash & Bank
                                    items:
                                      - name: Cash
                                        items: []
                                        value: null
                                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                                      - name: Petty Cash
                                        items: []
                                        value: null
                                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                                    value: '0'
                                    account_id: null
                                  - name: Current Asset
                                    items:
                                      - name: Accounts Receivable
                                        items: []
                                        value: null
                                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                                      - name: Customer Deposits
                                        items: []
                                        value: null
                                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                                      - name: Deferred Discounts
                                        items: []
                                        value: null
                                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                                      - name: Deposits
                                        items: []
                                        value: null
                                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                                      - name: Prepaid Expenses
                                        items: []
                                        value: null
                                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                                    value: '0'
                                    account_id: null
                                  - name: Property, Plant, and Equipment
                                    items:
                                      - name: Furniture - Accumulated Depreciation
                                        items: []
                                        value: null
                                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                                      - name: Property, Plant, and Equipment
                                        items: []
                                        value: null
                                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                                      - name: Furniture
                                        items: []
                                        value: null
                                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                                      - name: Office Equipment
                                        items: []
                                        value: null
                                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                                      - name: >-
                                          Office Equipment - Accumulated
                                          Depreciation
                                        items: []
                                        value: null
                                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                                    value: '0'
                                    account_id: null
                                value: '0'
                                account_id: null
                              equity:
                                name: Equity
                                items:
                                  - name: Common Stock
                                    items: []
                                    value: null
                                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                                  - name: Opening Balance
                                    items: []
                                    value: null
                                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                                  - name: Opening Balance Adjustments
                                    items: []
                                    value: null
                                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                                  - name: Owner's Equity
                                    items: []
                                    value: null
                                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                                  - name: Retained Earnings
                                    items: []
                                    value: null
                                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                                  - name: Dividends
                                    items: []
                                    value: null
                                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                                value: '0'
                                account_id: null
                              liabilities:
                                name: Liabilities
                                items:
                                  - name: Accounts Payable
                                    items: []
                                    value: null
                                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                                  - name: Customer Credit
                                    items: []
                                    value: null
                                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                                  - name: Taxes Payable
                                    items: []
                                    value: null
                                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                                  - name: Income Tax Payable
                                    items: []
                                    value: null
                                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                                  - name: Property Tax Payable
                                    items: []
                                    value: null
                                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                                  - name: Accruals
                                    items: []
                                    value: null
                                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                                  - name: Accrued Payroll
                                    items: []
                                    value: null
                                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                                  - name: Accrued Rent
                                    items: []
                                    value: null
                                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                                  - name: Credit Cards
                                    items: []
                                    value: null
                                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                                  - name: Unearned Revenue
                                    items: []
                                    value: null
                                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                                value: '0'
                                account_id: null
                              meta:
                                note: Computed by Rutter
                              created_at: '2024-02-13T22:06:15.199Z'
                              updated_at: '2024-02-13T22:06:15.070Z'
                              task_status: SUCCESS
                            - id: f5832348-b350-40eb-b84d-86f2fa5480b4
                              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                              platform_id: 8
                              external_id: 05eadcf6-5a8e-553f-854e-7c2f93e0fd02
                              start_date: '2022-10-01T00:00:00.000Z'
                              end_date: '2022-10-31T00:00:00.000Z'
                              currency: USD
                              total_assets: '0'
                              total_equity: '0'
                              total_liabilities: '0'
                              assets:
                                name: Assets
                                items:
                                  - name: Cash & Bank
                                    items:
                                      - name: Cash
                                        items: []
                                        value: null
                                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                                      - name: Petty Cash
                                        items: []
                                        value: null
                                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                                    value: '0'
                                    account_id: null
                                  - name: Current Asset
                                    items:
                                      - name: Accounts Receivable
                                        items: []
                                        value: null
                                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                                      - name: Customer Deposits
                                        items: []
                                        value: null
                                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                                      - name: Deferred Discounts
                                        items: []
                                        value: null
                                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                                      - name: Deposits
                                        items: []
                                        value: null
                                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                                      - name: Prepaid Expenses
                                        items: []
                                        value: null
                                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                                    value: '0'
                                    account_id: null
                                  - name: Property, Plant, and Equipment
                                    items:
                                      - name: Furniture - Accumulated Depreciation
                                        items: []
                                        value: null
                                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                                      - name: Property, Plant, and Equipment
                                        items: []
                                        value: null
                                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                                      - name: Furniture
                                        items: []
                                        value: null
                                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                                      - name: Office Equipment
                                        items: []
                                        value: null
                                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                                      - name: >-
                                          Office Equipment - Accumulated
                                          Depreciation
                                        items: []
                                        value: null
                                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                                    value: '0'
                                    account_id: null
                                value: '0'
                                account_id: null
                              equity:
                                name: Equity
                                items:
                                  - name: Common Stock
                                    items: []
                                    value: null
                                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                                  - name: Opening Balance
                                    items: []
                                    value: null
                                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                                  - name: Opening Balance Adjustments
                                    items: []
                                    value: null
                                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                                  - name: Owner's Equity
                                    items: []
                                    value: null
                                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                                  - name: Retained Earnings
                                    items: []
                                    value: null
                                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                                  - name: Dividends
                                    items: []
                                    value: null
                                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                                value: '0'
                                account_id: null
                              liabilities:
                                name: Liabilities
                                items:
                                  - name: Accounts Payable
                                    items: []
                                    value: null
                                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                                  - name: Customer Credit
                                    items: []
                                    value: null
                                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                                  - name: Taxes Payable
                                    items: []
                                    value: null
                                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                                  - name: Income Tax Payable
                                    items: []
                                    value: null
                                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                                  - name: Property Tax Payable
                                    items: []
                                    value: null
                                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                                  - name: Accruals
                                    items: []
                                    value: null
                                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                                  - name: Accrued Payroll
                                    items: []
                                    value: null
                                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                                  - name: Accrued Rent
                                    items: []
                                    value: null
                                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                                  - name: Credit Cards
                                    items: []
                                    value: null
                                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                                  - name: Unearned Revenue
                                    items: []
                                    value: null
                                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                                value: '0'
                                account_id: null
                              meta:
                                note: Computed by Rutter
                              created_at: '2024-02-13T22:06:15.202Z'
                              updated_at: '2024-02-13T22:06:15.063Z'
                              task_status: SUCCESS
                            - id: 4161652b-6e0d-413c-91cd-1598e7a19f82
                              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                              platform_id: 8
                              external_id: 0a5bab96-ba8f-55c9-be9d-ab9021dd9af6
                              start_date: '2022-09-01T00:00:00.000Z'
                              end_date: '2022-09-30T00:00:00.000Z'
                              currency: USD
                              total_assets: '0'
                              total_equity: '0'
                              total_liabilities: '0'
                              assets:
                                name: Assets
                                items:
                                  - name: Cash & Bank
                                    items:
                                      - name: Cash
                                        items: []
                                        value: null
                                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                                      - name: Petty Cash
                                        items: []
                                        value: null
                                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                                    value: '0'
                                    account_id: null
                                  - name: Current Asset
                                    items:
                                      - name: Accounts Receivable
                                        items: []
                                        value: null
                                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                                      - name: Customer Deposits
                                        items: []
                                        value: null
                                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                                      - name: Deferred Discounts
                                        items: []
                                        value: null
                                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                                      - name: Deposits
                                        items: []
                                        value: null
                                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                                      - name: Prepaid Expenses
                                        items: []
                                        value: null
                                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                                    value: '0'
                                    account_id: null
                                  - name: Property, Plant, and Equipment
                                    items:
                                      - name: Furniture - Accumulated Depreciation
                                        items: []
                                        value: null
                                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                                      - name: Property, Plant, and Equipment
                                        items: []
                                        value: null
                                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                                      - name: Furniture
                                        items: []
                                        value: null
                                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                                      - name: Office Equipment
                                        items: []
                                        value: null
                                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                                      - name: >-
                                          Office Equipment - Accumulated
                                          Depreciation
                                        items: []
                                        value: null
                                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                                    value: '0'
                                    account_id: null
                                value: '0'
                                account_id: null
                              equity:
                                name: Equity
                                items:
                                  - name: Common Stock
                                    items: []
                                    value: null
                                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                                  - name: Opening Balance
                                    items: []
                                    value: null
                                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                                  - name: Opening Balance Adjustments
                                    items: []
                                    value: null
                                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                                  - name: Owner's Equity
                                    items: []
                                    value: null
                                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                                  - name: Retained Earnings
                                    items: []
                                    value: null
                                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                                  - name: Dividends
                                    items: []
                                    value: null
                                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                                value: '0'
                                account_id: null
                              liabilities:
                                name: Liabilities
                                items:
                                  - name: Accounts Payable
                                    items: []
                                    value: null
                                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                                  - name: Customer Credit
                                    items: []
                                    value: null
                                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                                  - name: Taxes Payable
                                    items: []
                                    value: null
                                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                                  - name: Income Tax Payable
                                    items: []
                                    value: null
                                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                                  - name: Property Tax Payable
                                    items: []
                                    value: null
                                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                                  - name: Accruals
                                    items: []
                                    value: null
                                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                                  - name: Accrued Payroll
                                    items: []
                                    value: null
                                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                                  - name: Accrued Rent
                                    items: []
                                    value: null
                                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                                  - name: Credit Cards
                                    items: []
                                    value: null
                                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                                  - name: Unearned Revenue
                                    items: []
                                    value: null
                                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                                value: '0'
                                account_id: null
                              meta:
                                note: Computed by Rutter
                              created_at: '2024-02-13T22:06:15.204Z'
                              updated_at: '2024-02-13T22:06:15.057Z'
                              task_status: SUCCESS
                            - id: ab36a33d-5e5e-4b88-8fab-9490350d3f63
                              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                              platform_id: 8
                              external_id: 173355db-05a1-53ca-9533-f39956ee00a9
                              start_date: '2022-08-01T00:00:00.000Z'
                              end_date: '2022-08-31T00:00:00.000Z'
                              currency: USD
                              total_assets: '0'
                              total_equity: '0'
                              total_liabilities: '0'
                              assets:
                                name: Assets
                                items:
                                  - name: Cash & Bank
                                    items:
                                      - name: Cash
                                        items: []
                                        value: null
                                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                                      - name: Petty Cash
                                        items: []
                                        value: null
                                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                                    value: '0'
                                    account_id: null
                                  - name: Current Asset
                                    items:
                                      - name: Accounts Receivable
                                        items: []
                                        value: null
                                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                                      - name: Customer Deposits
                                        items: []
                                        value: null
                                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                                      - name: Deferred Discounts
                                        items: []
                                        value: null
                                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                                      - name: Deposits
                                        items: []
                                        value: null
                                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                                      - name: Prepaid Expenses
                                        items: []
                                        value: null
                                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                                    value: '0'
                                    account_id: null
                                  - name: Property, Plant, and Equipment
                                    items:
                                      - name: Furniture - Accumulated Depreciation
                                        items: []
                                        value: null
                                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                                      - name: Property, Plant, and Equipment
                                        items: []
                                        value: null
                                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                                      - name: Furniture
                                        items: []
                                        value: null
                                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                                      - name: Office Equipment
                                        items: []
                                        value: null
                                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                                      - name: >-
                                          Office Equipment - Accumulated
                                          Depreciation
                                        items: []
                                        value: null
                                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                                    value: '0'
                                    account_id: null
                                value: '0'
                                account_id: null
                              equity:
                                name: Equity
                                items:
                                  - name: Common Stock
                                    items: []
                                    value: null
                                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                                  - name: Opening Balance
                                    items: []
                                    value: null
                                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                                  - name: Opening Balance Adjustments
                                    items: []
                                    value: null
                                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                                  - name: Owner's Equity
                                    items: []
                                    value: null
                                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                                  - name: Retained Earnings
                                    items: []
                                    value: null
                                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                                  - name: Dividends
                                    items: []
                                    value: null
                                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                                value: '0'
                                account_id: null
                              liabilities:
                                name: Liabilities
                                items:
                                  - name: Accounts Payable
                                    items: []
                                    value: null
                                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                                  - name: Customer Credit
                                    items: []
                                    value: null
                                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                                  - name: Taxes Payable
                                    items: []
                                    value: null
                                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                                  - name: Income Tax Payable
                                    items: []
                                    value: null
                                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                                  - name: Property Tax Payable
                                    items: []
                                    value: null
                                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                                  - name: Accruals
                                    items: []
                                    value: null
                                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                                  - name: Accrued Payroll
                                    items: []
                                    value: null
                                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                                  - name: Accrued Rent
                                    items: []
                                    value: null
                                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                                  - name: Credit Cards
                                    items: []
                                    value: null
                                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                                  - name: Unearned Revenue
                                    items: []
                                    value: null
                                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                                value: '0'
                                account_id: null
                              meta:
                                note: Computed by Rutter
                              created_at: '2024-02-13T22:06:15.206Z'
                              updated_at: '2024-02-13T22:06:15.053Z'
                              task_status: SUCCESS
                            - id: 1d9eef16-eda3-4ecb-93a0-effcd9cceb34
                              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                              platform_id: 8
                              external_id: 47c1c5b5-101d-5fc3-b4ab-b72d4607791e
                              start_date: '2022-07-01T00:00:00.000Z'
                              end_date: '2022-07-31T00:00:00.000Z'
                              currency: USD
                              total_assets: '0'
                              total_equity: '0'
                              total_liabilities: '0'
                              assets:
                                name: Assets
                                items:
                                  - name: Cash & Bank
                                    items:
                                      - name: Cash
                                        items: []
                                        value: null
                                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                                      - name: Petty Cash
                                        items: []
                                        value: null
                                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                                    value: '0'
                                    account_id: null
                                  - name: Current Asset
                                    items:
                                      - name: Accounts Receivable
                                        items: []
                                        value: null
                                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                                      - name: Customer Deposits
                                        items: []
                                        value: null
                                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                                      - name: Deferred Discounts
                                        items: []
                                        value: null
                                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                                      - name: Deposits
                                        items: []
                                        value: null
                                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                                      - name: Prepaid Expenses
                                        items: []
                                        value: null
                                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                                    value: '0'
                                    account_id: null
                                  - name: Property, Plant, and Equipment
                                    items:
                                      - name: Furniture - Accumulated Depreciation
                                        items: []
                                        value: null
                                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                                      - name: Property, Plant, and Equipment
                                        items: []
                                        value: null
                                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                                      - name: Furniture
                                        items: []
                                        value: null
                                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                                      - name: Office Equipment
                                        items: []
                                        value: null
                                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                                      - name: >-
                                          Office Equipment - Accumulated
                                          Depreciation
                                        items: []
                                        value: null
                                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                                    value: '0'
                                    account_id: null
                                value: '0'
                                account_id: null
                              equity:
                                name: Equity
                                items:
                                  - name: Common Stock
                                    items: []
                                    value: null
                                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                                  - name: Opening Balance
                                    items: []
                                    value: null
                                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                                  - name: Opening Balance Adjustments
                                    items: []
                                    value: null
                                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                                  - name: Owner's Equity
                                    items: []
                                    value: null
                                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                                  - name: Retained Earnings
                                    items: []
                                    value: null
                                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                                  - name: Dividends
                                    items: []
                                    value: null
                                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                                value: '0'
                                account_id: null
                              liabilities:
                                name: Liabilities
                                items:
                                  - name: Accounts Payable
                                    items: []
                                    value: null
                                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                                  - name: Customer Credit
                                    items: []
                                    value: null
                                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                                  - name: Taxes Payable
                                    items: []
                                    value: null
                                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                                  - name: Income Tax Payable
                                    items: []
                                    value: null
                                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                                  - name: Property Tax Payable
                                    items: []
                                    value: null
                                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                                  - name: Accruals
                                    items: []
                                    value: null
                                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                                  - name: Accrued Payroll
                                    items: []
                                    value: null
                                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                                  - name: Accrued Rent
                                    items: []
                                    value: null
                                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                                  - name: Credit Cards
                                    items: []
                                    value: null
                                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                                  - name: Unearned Revenue
                                    items: []
                                    value: null
                                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                                value: '0'
                                account_id: null
                              meta:
                                note: Computed by Rutter
                              created_at: '2024-02-13T22:06:15.208Z'
                              updated_at: '2024-02-13T22:06:15.048Z'
                              task_status: SUCCESS
                          total: '63'
                contentMediaType: application/json; charset=utf-8
              example:
                status: success
                message: Successful
                data:
                  count: 20
                  page: 1
                  accounting_balancesheet:
                    - id: 837a9495-986a-4cae-b5c1-937da7d2c68f
                      business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                      business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                      platform_id: 8
                      external_id: f6c14930-8ec2-5570-ace6-aa22d5feb47d
                      start_date: '2024-02-01T00:00:00.000Z'
                      end_date: '2024-02-29T00:00:00.000Z'
                      currency: USD
                      total_assets: '0'
                      total_equity: '0'
                      total_liabilities: '0'
                      assets:
                        name: Assets
                        items:
                          - name: Cash & Bank
                            items:
                              - name: Cash
                                items: []
                                value: null
                                account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                              - name: Petty Cash
                                items: []
                                value: null
                                account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                            value: '0'
                            account_id: null
                          - name: Current Asset
                            items:
                              - name: Accounts Receivable
                                items: []
                                value: null
                                account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                              - name: Customer Deposits
                                items: []
                                value: null
                                account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                              - name: Deferred Discounts
                                items: []
                                value: null
                                account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                              - name: Deposits
                                items: []
                                value: null
                                account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                              - name: Prepaid Expenses
                                items: []
                                value: null
                                account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                            value: '0'
                            account_id: null
                          - name: Property, Plant, and Equipment
                            items:
                              - name: Furniture - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                              - name: Property, Plant, and Equipment
                                items: []
                                value: null
                                account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                              - name: Furniture
                                items: []
                                value: null
                                account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                              - name: Office Equipment
                                items: []
                                value: null
                                account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                              - name: Office Equipment - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: de710f63-acd8-48a2-aab1-6130b8069646
                            value: '0'
                            account_id: null
                        value: '0'
                        account_id: null
                      equity:
                        name: Equity
                        items:
                          - name: Common Stock
                            items: []
                            value: null
                            account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                          - name: Opening Balance
                            items: []
                            value: null
                            account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                          - name: Opening Balance Adjustments
                            items: []
                            value: null
                            account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                          - name: Owner's Equity
                            items: []
                            value: null
                            account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                          - name: Retained Earnings
                            items: []
                            value: null
                            account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                          - name: Dividends
                            items: []
                            value: null
                            account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                        value: '0'
                        account_id: null
                      liabilities:
                        name: Liabilities
                        items:
                          - name: Accounts Payable
                            items: []
                            value: null
                            account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                          - name: Customer Credit
                            items: []
                            value: null
                            account_id: 41174cde-0a50-4504-8469-10299f7b5308
                          - name: Taxes Payable
                            items: []
                            value: null
                            account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                          - name: Income Tax Payable
                            items: []
                            value: null
                            account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                          - name: Property Tax Payable
                            items: []
                            value: null
                            account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                          - name: Accruals
                            items: []
                            value: null
                            account_id: f588b351-5c5f-4062-b18b-6903c8286057
                          - name: Accrued Payroll
                            items: []
                            value: null
                            account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                          - name: Accrued Rent
                            items: []
                            value: null
                            account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                          - name: Credit Cards
                            items: []
                            value: null
                            account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                          - name: Unearned Revenue
                            items: []
                            value: null
                            account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                        value: '0'
                        account_id: null
                      meta:
                        note: Computed by Rutter
                      created_at: '2024-02-13T22:06:15.154Z'
                      updated_at: '2024-02-13T22:06:15.137Z'
                      task_status: SUCCESS
                    - id: 8a50526a-a008-45bb-be08-b1086e7c1ac7
                      business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                      business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                      platform_id: 8
                      external_id: bec3592b-1450-55bc-85b3-5713aeb143c5
                      start_date: '2024-01-01T00:00:00.000Z'
                      end_date: '2024-01-31T00:00:00.000Z'
                      currency: USD
                      total_assets: '0'
                      total_equity: '0'
                      total_liabilities: '0'
                      assets:
                        name: Assets
                        items:
                          - name: Cash & Bank
                            items:
                              - name: Cash
                                items: []
                                value: null
                                account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                              - name: Petty Cash
                                items: []
                                value: null
                                account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                            value: '0'
                            account_id: null
                          - name: Current Asset
                            items:
                              - name: Accounts Receivable
                                items: []
                                value: null
                                account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                              - name: Customer Deposits
                                items: []
                                value: null
                                account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                              - name: Deferred Discounts
                                items: []
                                value: null
                                account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                              - name: Deposits
                                items: []
                                value: null
                                account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                              - name: Prepaid Expenses
                                items: []
                                value: null
                                account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                            value: '0'
                            account_id: null
                          - name: Property, Plant, and Equipment
                            items:
                              - name: Furniture - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                              - name: Property, Plant, and Equipment
                                items: []
                                value: null
                                account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                              - name: Furniture
                                items: []
                                value: null
                                account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                              - name: Office Equipment
                                items: []
                                value: null
                                account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                              - name: Office Equipment - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: de710f63-acd8-48a2-aab1-6130b8069646
                            value: '0'
                            account_id: null
                        value: '0'
                        account_id: null
                      equity:
                        name: Equity
                        items:
                          - name: Common Stock
                            items: []
                            value: null
                            account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                          - name: Opening Balance
                            items: []
                            value: null
                            account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                          - name: Opening Balance Adjustments
                            items: []
                            value: null
                            account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                          - name: Owner's Equity
                            items: []
                            value: null
                            account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                          - name: Retained Earnings
                            items: []
                            value: null
                            account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                          - name: Dividends
                            items: []
                            value: null
                            account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                        value: '0'
                        account_id: null
                      liabilities:
                        name: Liabilities
                        items:
                          - name: Accounts Payable
                            items: []
                            value: null
                            account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                          - name: Customer Credit
                            items: []
                            value: null
                            account_id: 41174cde-0a50-4504-8469-10299f7b5308
                          - name: Taxes Payable
                            items: []
                            value: null
                            account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                          - name: Income Tax Payable
                            items: []
                            value: null
                            account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                          - name: Property Tax Payable
                            items: []
                            value: null
                            account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                          - name: Accruals
                            items: []
                            value: null
                            account_id: f588b351-5c5f-4062-b18b-6903c8286057
                          - name: Accrued Payroll
                            items: []
                            value: null
                            account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                          - name: Accrued Rent
                            items: []
                            value: null
                            account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                          - name: Credit Cards
                            items: []
                            value: null
                            account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                          - name: Unearned Revenue
                            items: []
                            value: null
                            account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                        value: '0'
                        account_id: null
                      meta:
                        note: Computed by Rutter
                      created_at: '2024-02-13T22:06:15.159Z'
                      updated_at: '2024-02-13T22:06:15.133Z'
                      task_status: SUCCESS
                    - id: 470c45a4-6a99-4cec-a590-6b919e4ad877
                      business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                      business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                      platform_id: 8
                      external_id: 7d697f90-3edb-5db9-a5b5-bb25ab510cc8
                      start_date: '2023-12-01T00:00:00.000Z'
                      end_date: '2023-12-31T00:00:00.000Z'
                      currency: USD
                      total_assets: '0'
                      total_equity: '0'
                      total_liabilities: '0'
                      assets:
                        name: Assets
                        items:
                          - name: Cash & Bank
                            items:
                              - name: Cash
                                items: []
                                value: null
                                account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                              - name: Petty Cash
                                items: []
                                value: null
                                account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                            value: '0'
                            account_id: null
                          - name: Current Asset
                            items:
                              - name: Accounts Receivable
                                items: []
                                value: null
                                account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                              - name: Customer Deposits
                                items: []
                                value: null
                                account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                              - name: Deferred Discounts
                                items: []
                                value: null
                                account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                              - name: Deposits
                                items: []
                                value: null
                                account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                              - name: Prepaid Expenses
                                items: []
                                value: null
                                account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                            value: '0'
                            account_id: null
                          - name: Property, Plant, and Equipment
                            items:
                              - name: Furniture - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                              - name: Property, Plant, and Equipment
                                items: []
                                value: null
                                account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                              - name: Furniture
                                items: []
                                value: null
                                account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                              - name: Office Equipment
                                items: []
                                value: null
                                account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                              - name: Office Equipment - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: de710f63-acd8-48a2-aab1-6130b8069646
                            value: '0'
                            account_id: null
                        value: '0'
                        account_id: null
                      equity:
                        name: Equity
                        items:
                          - name: Common Stock
                            items: []
                            value: null
                            account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                          - name: Opening Balance
                            items: []
                            value: null
                            account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                          - name: Opening Balance Adjustments
                            items: []
                            value: null
                            account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                          - name: Owner's Equity
                            items: []
                            value: null
                            account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                          - name: Retained Earnings
                            items: []
                            value: null
                            account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                          - name: Dividends
                            items: []
                            value: null
                            account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                        value: '0'
                        account_id: null
                      liabilities:
                        name: Liabilities
                        items:
                          - name: Accounts Payable
                            items: []
                            value: null
                            account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                          - name: Customer Credit
                            items: []
                            value: null
                            account_id: 41174cde-0a50-4504-8469-10299f7b5308
                          - name: Taxes Payable
                            items: []
                            value: null
                            account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                          - name: Income Tax Payable
                            items: []
                            value: null
                            account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                          - name: Property Tax Payable
                            items: []
                            value: null
                            account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                          - name: Accruals
                            items: []
                            value: null
                            account_id: f588b351-5c5f-4062-b18b-6903c8286057
                          - name: Accrued Payroll
                            items: []
                            value: null
                            account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                          - name: Accrued Rent
                            items: []
                            value: null
                            account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                          - name: Credit Cards
                            items: []
                            value: null
                            account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                          - name: Unearned Revenue
                            items: []
                            value: null
                            account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                        value: '0'
                        account_id: null
                      meta:
                        note: Computed by Rutter
                      created_at: '2024-02-13T22:06:15.161Z'
                      updated_at: '2024-02-13T22:06:15.129Z'
                      task_status: SUCCESS
                    - id: 83958e6f-4e56-47fa-9b8b-62267c77a9b5
                      business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                      business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                      platform_id: 8
                      external_id: 231f6533-bb17-58f0-85f3-ceeb072bfed9
                      start_date: '2023-11-01T00:00:00.000Z'
                      end_date: '2023-11-30T00:00:00.000Z'
                      currency: USD
                      total_assets: '0'
                      total_equity: '0'
                      total_liabilities: '0'
                      assets:
                        name: Assets
                        items:
                          - name: Cash & Bank
                            items:
                              - name: Cash
                                items: []
                                value: null
                                account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                              - name: Petty Cash
                                items: []
                                value: null
                                account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                            value: '0'
                            account_id: null
                          - name: Current Asset
                            items:
                              - name: Accounts Receivable
                                items: []
                                value: null
                                account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                              - name: Customer Deposits
                                items: []
                                value: null
                                account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                              - name: Deferred Discounts
                                items: []
                                value: null
                                account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                              - name: Deposits
                                items: []
                                value: null
                                account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                              - name: Prepaid Expenses
                                items: []
                                value: null
                                account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                            value: '0'
                            account_id: null
                          - name: Property, Plant, and Equipment
                            items:
                              - name: Furniture - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                              - name: Property, Plant, and Equipment
                                items: []
                                value: null
                                account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                              - name: Furniture
                                items: []
                                value: null
                                account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                              - name: Office Equipment
                                items: []
                                value: null
                                account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                              - name: Office Equipment - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: de710f63-acd8-48a2-aab1-6130b8069646
                            value: '0'
                            account_id: null
                        value: '0'
                        account_id: null
                      equity:
                        name: Equity
                        items:
                          - name: Common Stock
                            items: []
                            value: null
                            account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                          - name: Opening Balance
                            items: []
                            value: null
                            account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                          - name: Opening Balance Adjustments
                            items: []
                            value: null
                            account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                          - name: Owner's Equity
                            items: []
                            value: null
                            account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                          - name: Retained Earnings
                            items: []
                            value: null
                            account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                          - name: Dividends
                            items: []
                            value: null
                            account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                        value: '0'
                        account_id: null
                      liabilities:
                        name: Liabilities
                        items:
                          - name: Accounts Payable
                            items: []
                            value: null
                            account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                          - name: Customer Credit
                            items: []
                            value: null
                            account_id: 41174cde-0a50-4504-8469-10299f7b5308
                          - name: Taxes Payable
                            items: []
                            value: null
                            account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                          - name: Income Tax Payable
                            items: []
                            value: null
                            account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                          - name: Property Tax Payable
                            items: []
                            value: null
                            account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                          - name: Accruals
                            items: []
                            value: null
                            account_id: f588b351-5c5f-4062-b18b-6903c8286057
                          - name: Accrued Payroll
                            items: []
                            value: null
                            account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                          - name: Accrued Rent
                            items: []
                            value: null
                            account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                          - name: Credit Cards
                            items: []
                            value: null
                            account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                          - name: Unearned Revenue
                            items: []
                            value: null
                            account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                        value: '0'
                        account_id: null
                      meta:
                        note: Computed by Rutter
                      created_at: '2024-02-13T22:06:15.164Z'
                      updated_at: '2024-02-13T22:06:15.127Z'
                      task_status: SUCCESS
                    - id: c3f64d61-da65-4c86-8ede-27570293e7ee
                      business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                      business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                      platform_id: 8
                      external_id: 9e6880ad-dfb9-5520-9f7e-63abe67417e8
                      start_date: '2023-10-01T00:00:00.000Z'
                      end_date: '2023-10-31T00:00:00.000Z'
                      currency: USD
                      total_assets: '0'
                      total_equity: '0'
                      total_liabilities: '0'
                      assets:
                        name: Assets
                        items:
                          - name: Cash & Bank
                            items:
                              - name: Cash
                                items: []
                                value: null
                                account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                              - name: Petty Cash
                                items: []
                                value: null
                                account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                            value: '0'
                            account_id: null
                          - name: Current Asset
                            items:
                              - name: Accounts Receivable
                                items: []
                                value: null
                                account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                              - name: Customer Deposits
                                items: []
                                value: null
                                account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                              - name: Deferred Discounts
                                items: []
                                value: null
                                account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                              - name: Deposits
                                items: []
                                value: null
                                account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                              - name: Prepaid Expenses
                                items: []
                                value: null
                                account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                            value: '0'
                            account_id: null
                          - name: Property, Plant, and Equipment
                            items:
                              - name: Furniture - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                              - name: Property, Plant, and Equipment
                                items: []
                                value: null
                                account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                              - name: Furniture
                                items: []
                                value: null
                                account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                              - name: Office Equipment
                                items: []
                                value: null
                                account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                              - name: Office Equipment - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: de710f63-acd8-48a2-aab1-6130b8069646
                            value: '0'
                            account_id: null
                        value: '0'
                        account_id: null
                      equity:
                        name: Equity
                        items:
                          - name: Common Stock
                            items: []
                            value: null
                            account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                          - name: Opening Balance
                            items: []
                            value: null
                            account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                          - name: Opening Balance Adjustments
                            items: []
                            value: null
                            account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                          - name: Owner's Equity
                            items: []
                            value: null
                            account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                          - name: Retained Earnings
                            items: []
                            value: null
                            account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                          - name: Dividends
                            items: []
                            value: null
                            account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                        value: '0'
                        account_id: null
                      liabilities:
                        name: Liabilities
                        items:
                          - name: Accounts Payable
                            items: []
                            value: null
                            account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                          - name: Customer Credit
                            items: []
                            value: null
                            account_id: 41174cde-0a50-4504-8469-10299f7b5308
                          - name: Taxes Payable
                            items: []
                            value: null
                            account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                          - name: Income Tax Payable
                            items: []
                            value: null
                            account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                          - name: Property Tax Payable
                            items: []
                            value: null
                            account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                          - name: Accruals
                            items: []
                            value: null
                            account_id: f588b351-5c5f-4062-b18b-6903c8286057
                          - name: Accrued Payroll
                            items: []
                            value: null
                            account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                          - name: Accrued Rent
                            items: []
                            value: null
                            account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                          - name: Credit Cards
                            items: []
                            value: null
                            account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                          - name: Unearned Revenue
                            items: []
                            value: null
                            account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                        value: '0'
                        account_id: null
                      meta:
                        note: Computed by Rutter
                      created_at: '2024-02-13T22:06:15.166Z'
                      updated_at: '2024-02-13T22:06:15.120Z'
                      task_status: SUCCESS
                    - id: 08f37ff7-adef-4e37-a397-f4a5e7aca2a5
                      business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                      business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                      platform_id: 8
                      external_id: a2b548af-9a1b-5235-bbe6-9ea65c5bc20b
                      start_date: '2023-09-01T00:00:00.000Z'
                      end_date: '2023-09-30T00:00:00.000Z'
                      currency: USD
                      total_assets: '0'
                      total_equity: '0'
                      total_liabilities: '0'
                      assets:
                        name: Assets
                        items:
                          - name: Cash & Bank
                            items:
                              - name: Cash
                                items: []
                                value: null
                                account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                              - name: Petty Cash
                                items: []
                                value: null
                                account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                            value: '0'
                            account_id: null
                          - name: Current Asset
                            items:
                              - name: Accounts Receivable
                                items: []
                                value: null
                                account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                              - name: Customer Deposits
                                items: []
                                value: null
                                account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                              - name: Deferred Discounts
                                items: []
                                value: null
                                account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                              - name: Deposits
                                items: []
                                value: null
                                account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                              - name: Prepaid Expenses
                                items: []
                                value: null
                                account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                            value: '0'
                            account_id: null
                          - name: Property, Plant, and Equipment
                            items:
                              - name: Furniture - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                              - name: Property, Plant, and Equipment
                                items: []
                                value: null
                                account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                              - name: Furniture
                                items: []
                                value: null
                                account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                              - name: Office Equipment
                                items: []
                                value: null
                                account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                              - name: Office Equipment - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: de710f63-acd8-48a2-aab1-6130b8069646
                            value: '0'
                            account_id: null
                        value: '0'
                        account_id: null
                      equity:
                        name: Equity
                        items:
                          - name: Common Stock
                            items: []
                            value: null
                            account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                          - name: Opening Balance
                            items: []
                            value: null
                            account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                          - name: Opening Balance Adjustments
                            items: []
                            value: null
                            account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                          - name: Owner's Equity
                            items: []
                            value: null
                            account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                          - name: Retained Earnings
                            items: []
                            value: null
                            account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                          - name: Dividends
                            items: []
                            value: null
                            account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                        value: '0'
                        account_id: null
                      liabilities:
                        name: Liabilities
                        items:
                          - name: Accounts Payable
                            items: []
                            value: null
                            account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                          - name: Customer Credit
                            items: []
                            value: null
                            account_id: 41174cde-0a50-4504-8469-10299f7b5308
                          - name: Taxes Payable
                            items: []
                            value: null
                            account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                          - name: Income Tax Payable
                            items: []
                            value: null
                            account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                          - name: Property Tax Payable
                            items: []
                            value: null
                            account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                          - name: Accruals
                            items: []
                            value: null
                            account_id: f588b351-5c5f-4062-b18b-6903c8286057
                          - name: Accrued Payroll
                            items: []
                            value: null
                            account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                          - name: Accrued Rent
                            items: []
                            value: null
                            account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                          - name: Credit Cards
                            items: []
                            value: null
                            account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                          - name: Unearned Revenue
                            items: []
                            value: null
                            account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                        value: '0'
                        account_id: null
                      meta:
                        note: Computed by Rutter
                      created_at: '2024-02-13T22:06:15.168Z'
                      updated_at: '2024-02-13T22:06:15.115Z'
                      task_status: SUCCESS
                    - id: 8a343105-994b-4730-b754-33e940a4506c
                      business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                      business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                      platform_id: 8
                      external_id: 344c4b2f-9ec1-5591-aa91-11ac2f87a221
                      start_date: '2023-08-01T00:00:00.000Z'
                      end_date: '2023-08-31T00:00:00.000Z'
                      currency: USD
                      total_assets: '0'
                      total_equity: '0'
                      total_liabilities: '0'
                      assets:
                        name: Assets
                        items:
                          - name: Cash & Bank
                            items:
                              - name: Cash
                                items: []
                                value: null
                                account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                              - name: Petty Cash
                                items: []
                                value: null
                                account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                            value: '0'
                            account_id: null
                          - name: Current Asset
                            items:
                              - name: Accounts Receivable
                                items: []
                                value: null
                                account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                              - name: Customer Deposits
                                items: []
                                value: null
                                account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                              - name: Deferred Discounts
                                items: []
                                value: null
                                account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                              - name: Deposits
                                items: []
                                value: null
                                account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                              - name: Prepaid Expenses
                                items: []
                                value: null
                                account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                            value: '0'
                            account_id: null
                          - name: Property, Plant, and Equipment
                            items:
                              - name: Furniture - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                              - name: Property, Plant, and Equipment
                                items: []
                                value: null
                                account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                              - name: Furniture
                                items: []
                                value: null
                                account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                              - name: Office Equipment
                                items: []
                                value: null
                                account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                              - name: Office Equipment - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: de710f63-acd8-48a2-aab1-6130b8069646
                            value: '0'
                            account_id: null
                        value: '0'
                        account_id: null
                      equity:
                        name: Equity
                        items:
                          - name: Common Stock
                            items: []
                            value: null
                            account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                          - name: Opening Balance
                            items: []
                            value: null
                            account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                          - name: Opening Balance Adjustments
                            items: []
                            value: null
                            account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                          - name: Owner's Equity
                            items: []
                            value: null
                            account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                          - name: Retained Earnings
                            items: []
                            value: null
                            account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                          - name: Dividends
                            items: []
                            value: null
                            account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                        value: '0'
                        account_id: null
                      liabilities:
                        name: Liabilities
                        items:
                          - name: Accounts Payable
                            items: []
                            value: null
                            account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                          - name: Customer Credit
                            items: []
                            value: null
                            account_id: 41174cde-0a50-4504-8469-10299f7b5308
                          - name: Taxes Payable
                            items: []
                            value: null
                            account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                          - name: Income Tax Payable
                            items: []
                            value: null
                            account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                          - name: Property Tax Payable
                            items: []
                            value: null
                            account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                          - name: Accruals
                            items: []
                            value: null
                            account_id: f588b351-5c5f-4062-b18b-6903c8286057
                          - name: Accrued Payroll
                            items: []
                            value: null
                            account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                          - name: Accrued Rent
                            items: []
                            value: null
                            account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                          - name: Credit Cards
                            items: []
                            value: null
                            account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                          - name: Unearned Revenue
                            items: []
                            value: null
                            account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                        value: '0'
                        account_id: null
                      meta:
                        note: Computed by Rutter
                      created_at: '2024-02-13T22:06:15.170Z'
                      updated_at: '2024-02-13T22:06:15.110Z'
                      task_status: SUCCESS
                    - id: 20cf3f3f-857a-418b-918e-d97b84e8699c
                      business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                      business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                      platform_id: 8
                      external_id: 254d96c0-6447-50f2-a56b-49577c48978a
                      start_date: '2023-07-01T00:00:00.000Z'
                      end_date: '2023-07-31T00:00:00.000Z'
                      currency: USD
                      total_assets: '0'
                      total_equity: '0'
                      total_liabilities: '0'
                      assets:
                        name: Assets
                        items:
                          - name: Cash & Bank
                            items:
                              - name: Cash
                                items: []
                                value: null
                                account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                              - name: Petty Cash
                                items: []
                                value: null
                                account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                            value: '0'
                            account_id: null
                          - name: Current Asset
                            items:
                              - name: Accounts Receivable
                                items: []
                                value: null
                                account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                              - name: Customer Deposits
                                items: []
                                value: null
                                account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                              - name: Deferred Discounts
                                items: []
                                value: null
                                account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                              - name: Deposits
                                items: []
                                value: null
                                account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                              - name: Prepaid Expenses
                                items: []
                                value: null
                                account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                            value: '0'
                            account_id: null
                          - name: Property, Plant, and Equipment
                            items:
                              - name: Furniture - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                              - name: Property, Plant, and Equipment
                                items: []
                                value: null
                                account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                              - name: Furniture
                                items: []
                                value: null
                                account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                              - name: Office Equipment
                                items: []
                                value: null
                                account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                              - name: Office Equipment - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: de710f63-acd8-48a2-aab1-6130b8069646
                            value: '0'
                            account_id: null
                        value: '0'
                        account_id: null
                      equity:
                        name: Equity
                        items:
                          - name: Common Stock
                            items: []
                            value: null
                            account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                          - name: Opening Balance
                            items: []
                            value: null
                            account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                          - name: Opening Balance Adjustments
                            items: []
                            value: null
                            account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                          - name: Owner's Equity
                            items: []
                            value: null
                            account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                          - name: Retained Earnings
                            items: []
                            value: null
                            account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                          - name: Dividends
                            items: []
                            value: null
                            account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                        value: '0'
                        account_id: null
                      liabilities:
                        name: Liabilities
                        items:
                          - name: Accounts Payable
                            items: []
                            value: null
                            account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                          - name: Customer Credit
                            items: []
                            value: null
                            account_id: 41174cde-0a50-4504-8469-10299f7b5308
                          - name: Taxes Payable
                            items: []
                            value: null
                            account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                          - name: Income Tax Payable
                            items: []
                            value: null
                            account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                          - name: Property Tax Payable
                            items: []
                            value: null
                            account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                          - name: Accruals
                            items: []
                            value: null
                            account_id: f588b351-5c5f-4062-b18b-6903c8286057
                          - name: Accrued Payroll
                            items: []
                            value: null
                            account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                          - name: Accrued Rent
                            items: []
                            value: null
                            account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                          - name: Credit Cards
                            items: []
                            value: null
                            account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                          - name: Unearned Revenue
                            items: []
                            value: null
                            account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                        value: '0'
                        account_id: null
                      meta:
                        note: Computed by Rutter
                      created_at: '2024-02-13T22:06:15.172Z'
                      updated_at: '2024-02-13T22:06:15.106Z'
                      task_status: SUCCESS
                    - id: f4c1acd2-6cfb-4a11-8ff1-58079159f3e1
                      business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                      business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                      platform_id: 8
                      external_id: b37c6a61-4b03-59af-806c-0c59b9574f6d
                      start_date: '2023-06-01T00:00:00.000Z'
                      end_date: '2023-06-30T00:00:00.000Z'
                      currency: USD
                      total_assets: '0'
                      total_equity: '0'
                      total_liabilities: '0'
                      assets:
                        name: Assets
                        items:
                          - name: Cash & Bank
                            items:
                              - name: Cash
                                items: []
                                value: null
                                account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                              - name: Petty Cash
                                items: []
                                value: null
                                account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                            value: '0'
                            account_id: null
                          - name: Current Asset
                            items:
                              - name: Accounts Receivable
                                items: []
                                value: null
                                account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                              - name: Customer Deposits
                                items: []
                                value: null
                                account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                              - name: Deferred Discounts
                                items: []
                                value: null
                                account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                              - name: Deposits
                                items: []
                                value: null
                                account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                              - name: Prepaid Expenses
                                items: []
                                value: null
                                account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                            value: '0'
                            account_id: null
                          - name: Property, Plant, and Equipment
                            items:
                              - name: Furniture - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                              - name: Property, Plant, and Equipment
                                items: []
                                value: null
                                account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                              - name: Furniture
                                items: []
                                value: null
                                account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                              - name: Office Equipment
                                items: []
                                value: null
                                account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                              - name: Office Equipment - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: de710f63-acd8-48a2-aab1-6130b8069646
                            value: '0'
                            account_id: null
                        value: '0'
                        account_id: null
                      equity:
                        name: Equity
                        items:
                          - name: Common Stock
                            items: []
                            value: null
                            account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                          - name: Opening Balance
                            items: []
                            value: null
                            account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                          - name: Opening Balance Adjustments
                            items: []
                            value: null
                            account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                          - name: Owner's Equity
                            items: []
                            value: null
                            account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                          - name: Retained Earnings
                            items: []
                            value: null
                            account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                          - name: Dividends
                            items: []
                            value: null
                            account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                        value: '0'
                        account_id: null
                      liabilities:
                        name: Liabilities
                        items:
                          - name: Accounts Payable
                            items: []
                            value: null
                            account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                          - name: Customer Credit
                            items: []
                            value: null
                            account_id: 41174cde-0a50-4504-8469-10299f7b5308
                          - name: Taxes Payable
                            items: []
                            value: null
                            account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                          - name: Income Tax Payable
                            items: []
                            value: null
                            account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                          - name: Property Tax Payable
                            items: []
                            value: null
                            account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                          - name: Accruals
                            items: []
                            value: null
                            account_id: f588b351-5c5f-4062-b18b-6903c8286057
                          - name: Accrued Payroll
                            items: []
                            value: null
                            account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                          - name: Accrued Rent
                            items: []
                            value: null
                            account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                          - name: Credit Cards
                            items: []
                            value: null
                            account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                          - name: Unearned Revenue
                            items: []
                            value: null
                            account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                        value: '0'
                        account_id: null
                      meta:
                        note: Computed by Rutter
                      created_at: '2024-02-13T22:06:15.174Z'
                      updated_at: '2024-02-13T22:06:15.101Z'
                      task_status: SUCCESS
                    - id: 9e608eb4-59c2-4ae5-bdff-01658e88e208
                      business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                      business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                      platform_id: 8
                      external_id: c1d0c8f3-e8bc-510d-9dcf-3afe83f234c1
                      start_date: '2023-05-01T00:00:00.000Z'
                      end_date: '2023-05-31T00:00:00.000Z'
                      currency: USD
                      total_assets: '0'
                      total_equity: '0'
                      total_liabilities: '0'
                      assets:
                        name: Assets
                        items:
                          - name: Cash & Bank
                            items:
                              - name: Cash
                                items: []
                                value: null
                                account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                              - name: Petty Cash
                                items: []
                                value: null
                                account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                            value: '0'
                            account_id: null
                          - name: Current Asset
                            items:
                              - name: Accounts Receivable
                                items: []
                                value: null
                                account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                              - name: Customer Deposits
                                items: []
                                value: null
                                account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                              - name: Deferred Discounts
                                items: []
                                value: null
                                account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                              - name: Deposits
                                items: []
                                value: null
                                account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                              - name: Prepaid Expenses
                                items: []
                                value: null
                                account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                            value: '0'
                            account_id: null
                          - name: Property, Plant, and Equipment
                            items:
                              - name: Furniture - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                              - name: Property, Plant, and Equipment
                                items: []
                                value: null
                                account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                              - name: Furniture
                                items: []
                                value: null
                                account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                              - name: Office Equipment
                                items: []
                                value: null
                                account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                              - name: Office Equipment - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: de710f63-acd8-48a2-aab1-6130b8069646
                            value: '0'
                            account_id: null
                        value: '0'
                        account_id: null
                      equity:
                        name: Equity
                        items:
                          - name: Common Stock
                            items: []
                            value: null
                            account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                          - name: Opening Balance
                            items: []
                            value: null
                            account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                          - name: Opening Balance Adjustments
                            items: []
                            value: null
                            account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                          - name: Owner's Equity
                            items: []
                            value: null
                            account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                          - name: Retained Earnings
                            items: []
                            value: null
                            account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                          - name: Dividends
                            items: []
                            value: null
                            account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                        value: '0'
                        account_id: null
                      liabilities:
                        name: Liabilities
                        items:
                          - name: Accounts Payable
                            items: []
                            value: null
                            account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                          - name: Customer Credit
                            items: []
                            value: null
                            account_id: 41174cde-0a50-4504-8469-10299f7b5308
                          - name: Taxes Payable
                            items: []
                            value: null
                            account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                          - name: Income Tax Payable
                            items: []
                            value: null
                            account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                          - name: Property Tax Payable
                            items: []
                            value: null
                            account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                          - name: Accruals
                            items: []
                            value: null
                            account_id: f588b351-5c5f-4062-b18b-6903c8286057
                          - name: Accrued Payroll
                            items: []
                            value: null
                            account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                          - name: Accrued Rent
                            items: []
                            value: null
                            account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                          - name: Credit Cards
                            items: []
                            value: null
                            account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                          - name: Unearned Revenue
                            items: []
                            value: null
                            account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                        value: '0'
                        account_id: null
                      meta:
                        note: Computed by Rutter
                      created_at: '2024-02-13T22:06:15.176Z'
                      updated_at: '2024-02-13T22:06:15.097Z'
                      task_status: SUCCESS
                    - id: 97b7e48a-7dbe-4984-bf3a-54c9bfe91817
                      business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                      business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                      platform_id: 8
                      external_id: e236c83b-38a3-52a8-8793-8bbc1507ce58
                      start_date: '2023-04-01T00:00:00.000Z'
                      end_date: '2023-04-30T00:00:00.000Z'
                      currency: USD
                      total_assets: '0'
                      total_equity: '0'
                      total_liabilities: '0'
                      assets:
                        name: Assets
                        items:
                          - name: Cash & Bank
                            items:
                              - name: Cash
                                items: []
                                value: null
                                account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                              - name: Petty Cash
                                items: []
                                value: null
                                account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                            value: '0'
                            account_id: null
                          - name: Current Asset
                            items:
                              - name: Accounts Receivable
                                items: []
                                value: null
                                account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                              - name: Customer Deposits
                                items: []
                                value: null
                                account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                              - name: Deferred Discounts
                                items: []
                                value: null
                                account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                              - name: Deposits
                                items: []
                                value: null
                                account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                              - name: Prepaid Expenses
                                items: []
                                value: null
                                account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                            value: '0'
                            account_id: null
                          - name: Property, Plant, and Equipment
                            items:
                              - name: Furniture - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                              - name: Property, Plant, and Equipment
                                items: []
                                value: null
                                account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                              - name: Furniture
                                items: []
                                value: null
                                account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                              - name: Office Equipment
                                items: []
                                value: null
                                account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                              - name: Office Equipment - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: de710f63-acd8-48a2-aab1-6130b8069646
                            value: '0'
                            account_id: null
                        value: '0'
                        account_id: null
                      equity:
                        name: Equity
                        items:
                          - name: Common Stock
                            items: []
                            value: null
                            account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                          - name: Opening Balance
                            items: []
                            value: null
                            account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                          - name: Opening Balance Adjustments
                            items: []
                            value: null
                            account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                          - name: Owner's Equity
                            items: []
                            value: null
                            account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                          - name: Retained Earnings
                            items: []
                            value: null
                            account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                          - name: Dividends
                            items: []
                            value: null
                            account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                        value: '0'
                        account_id: null
                      liabilities:
                        name: Liabilities
                        items:
                          - name: Accounts Payable
                            items: []
                            value: null
                            account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                          - name: Customer Credit
                            items: []
                            value: null
                            account_id: 41174cde-0a50-4504-8469-10299f7b5308
                          - name: Taxes Payable
                            items: []
                            value: null
                            account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                          - name: Income Tax Payable
                            items: []
                            value: null
                            account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                          - name: Property Tax Payable
                            items: []
                            value: null
                            account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                          - name: Accruals
                            items: []
                            value: null
                            account_id: f588b351-5c5f-4062-b18b-6903c8286057
                          - name: Accrued Payroll
                            items: []
                            value: null
                            account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                          - name: Accrued Rent
                            items: []
                            value: null
                            account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                          - name: Credit Cards
                            items: []
                            value: null
                            account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                          - name: Unearned Revenue
                            items: []
                            value: null
                            account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                        value: '0'
                        account_id: null
                      meta:
                        note: Computed by Rutter
                      created_at: '2024-02-13T22:06:15.178Z'
                      updated_at: '2024-02-13T22:06:15.092Z'
                      task_status: SUCCESS
                    - id: 7e215746-64b5-47aa-a1e1-8ddcdfb4ed69
                      business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                      business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                      platform_id: 8
                      external_id: 50a8564b-7d16-5216-85b3-05e2813bf44c
                      start_date: '2023-03-01T00:00:00.000Z'
                      end_date: '2023-03-31T00:00:00.000Z'
                      currency: USD
                      total_assets: '0'
                      total_equity: '0'
                      total_liabilities: '0'
                      assets:
                        name: Assets
                        items:
                          - name: Cash & Bank
                            items:
                              - name: Cash
                                items: []
                                value: null
                                account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                              - name: Petty Cash
                                items: []
                                value: null
                                account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                            value: '0'
                            account_id: null
                          - name: Current Asset
                            items:
                              - name: Accounts Receivable
                                items: []
                                value: null
                                account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                              - name: Customer Deposits
                                items: []
                                value: null
                                account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                              - name: Deferred Discounts
                                items: []
                                value: null
                                account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                              - name: Deposits
                                items: []
                                value: null
                                account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                              - name: Prepaid Expenses
                                items: []
                                value: null
                                account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                            value: '0'
                            account_id: null
                          - name: Property, Plant, and Equipment
                            items:
                              - name: Furniture - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                              - name: Property, Plant, and Equipment
                                items: []
                                value: null
                                account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                              - name: Furniture
                                items: []
                                value: null
                                account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                              - name: Office Equipment
                                items: []
                                value: null
                                account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                              - name: Office Equipment - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: de710f63-acd8-48a2-aab1-6130b8069646
                            value: '0'
                            account_id: null
                        value: '0'
                        account_id: null
                      equity:
                        name: Equity
                        items:
                          - name: Common Stock
                            items: []
                            value: null
                            account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                          - name: Opening Balance
                            items: []
                            value: null
                            account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                          - name: Opening Balance Adjustments
                            items: []
                            value: null
                            account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                          - name: Owner's Equity
                            items: []
                            value: null
                            account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                          - name: Retained Earnings
                            items: []
                            value: null
                            account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                          - name: Dividends
                            items: []
                            value: null
                            account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                        value: '0'
                        account_id: null
                      liabilities:
                        name: Liabilities
                        items:
                          - name: Accounts Payable
                            items: []
                            value: null
                            account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                          - name: Customer Credit
                            items: []
                            value: null
                            account_id: 41174cde-0a50-4504-8469-10299f7b5308
                          - name: Taxes Payable
                            items: []
                            value: null
                            account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                          - name: Income Tax Payable
                            items: []
                            value: null
                            account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                          - name: Property Tax Payable
                            items: []
                            value: null
                            account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                          - name: Accruals
                            items: []
                            value: null
                            account_id: f588b351-5c5f-4062-b18b-6903c8286057
                          - name: Accrued Payroll
                            items: []
                            value: null
                            account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                          - name: Accrued Rent
                            items: []
                            value: null
                            account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                          - name: Credit Cards
                            items: []
                            value: null
                            account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                          - name: Unearned Revenue
                            items: []
                            value: null
                            account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                        value: '0'
                        account_id: null
                      meta:
                        note: Computed by Rutter
                      created_at: '2024-02-13T22:06:15.181Z'
                      updated_at: '2024-02-13T22:06:15.088Z'
                      task_status: SUCCESS
                    - id: 88097521-aff7-49ca-bfe4-45ab6c4bbfb6
                      business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                      business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                      platform_id: 8
                      external_id: ccccc50d-d4d6-598c-84e0-ed8d6ed1229f
                      start_date: '2023-02-01T00:00:00.000Z'
                      end_date: '2023-02-28T00:00:00.000Z'
                      currency: USD
                      total_assets: '0'
                      total_equity: '0'
                      total_liabilities: '0'
                      assets:
                        name: Assets
                        items:
                          - name: Cash & Bank
                            items:
                              - name: Cash
                                items: []
                                value: null
                                account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                              - name: Petty Cash
                                items: []
                                value: null
                                account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                            value: '0'
                            account_id: null
                          - name: Current Asset
                            items:
                              - name: Accounts Receivable
                                items: []
                                value: null
                                account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                              - name: Customer Deposits
                                items: []
                                value: null
                                account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                              - name: Deferred Discounts
                                items: []
                                value: null
                                account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                              - name: Deposits
                                items: []
                                value: null
                                account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                              - name: Prepaid Expenses
                                items: []
                                value: null
                                account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                            value: '0'
                            account_id: null
                          - name: Property, Plant, and Equipment
                            items:
                              - name: Furniture - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                              - name: Property, Plant, and Equipment
                                items: []
                                value: null
                                account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                              - name: Furniture
                                items: []
                                value: null
                                account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                              - name: Office Equipment
                                items: []
                                value: null
                                account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                              - name: Office Equipment - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: de710f63-acd8-48a2-aab1-6130b8069646
                            value: '0'
                            account_id: null
                        value: '0'
                        account_id: null
                      equity:
                        name: Equity
                        items:
                          - name: Common Stock
                            items: []
                            value: null
                            account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                          - name: Opening Balance
                            items: []
                            value: null
                            account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                          - name: Opening Balance Adjustments
                            items: []
                            value: null
                            account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                          - name: Owner's Equity
                            items: []
                            value: null
                            account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                          - name: Retained Earnings
                            items: []
                            value: null
                            account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                          - name: Dividends
                            items: []
                            value: null
                            account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                        value: '0'
                        account_id: null
                      liabilities:
                        name: Liabilities
                        items:
                          - name: Accounts Payable
                            items: []
                            value: null
                            account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                          - name: Customer Credit
                            items: []
                            value: null
                            account_id: 41174cde-0a50-4504-8469-10299f7b5308
                          - name: Taxes Payable
                            items: []
                            value: null
                            account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                          - name: Income Tax Payable
                            items: []
                            value: null
                            account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                          - name: Property Tax Payable
                            items: []
                            value: null
                            account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                          - name: Accruals
                            items: []
                            value: null
                            account_id: f588b351-5c5f-4062-b18b-6903c8286057
                          - name: Accrued Payroll
                            items: []
                            value: null
                            account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                          - name: Accrued Rent
                            items: []
                            value: null
                            account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                          - name: Credit Cards
                            items: []
                            value: null
                            account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                          - name: Unearned Revenue
                            items: []
                            value: null
                            account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                        value: '0'
                        account_id: null
                      meta:
                        note: Computed by Rutter
                      created_at: '2024-02-13T22:06:15.183Z'
                      updated_at: '2024-02-13T22:06:15.084Z'
                      task_status: SUCCESS
                    - id: 876ddf7e-a0e8-49fe-b4fc-39a9c1551ede
                      business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                      business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                      platform_id: 8
                      external_id: edfc4e0f-5b8a-55ff-ab71-608b74dfe159
                      start_date: '2023-01-01T00:00:00.000Z'
                      end_date: '2023-01-31T00:00:00.000Z'
                      currency: USD
                      total_assets: '0'
                      total_equity: '0'
                      total_liabilities: '0'
                      assets:
                        name: Assets
                        items:
                          - name: Cash & Bank
                            items:
                              - name: Cash
                                items: []
                                value: null
                                account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                              - name: Petty Cash
                                items: []
                                value: null
                                account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                            value: '0'
                            account_id: null
                          - name: Current Asset
                            items:
                              - name: Accounts Receivable
                                items: []
                                value: null
                                account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                              - name: Customer Deposits
                                items: []
                                value: null
                                account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                              - name: Deferred Discounts
                                items: []
                                value: null
                                account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                              - name: Deposits
                                items: []
                                value: null
                                account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                              - name: Prepaid Expenses
                                items: []
                                value: null
                                account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                            value: '0'
                            account_id: null
                          - name: Property, Plant, and Equipment
                            items:
                              - name: Furniture - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                              - name: Property, Plant, and Equipment
                                items: []
                                value: null
                                account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                              - name: Furniture
                                items: []
                                value: null
                                account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                              - name: Office Equipment
                                items: []
                                value: null
                                account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                              - name: Office Equipment - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: de710f63-acd8-48a2-aab1-6130b8069646
                            value: '0'
                            account_id: null
                        value: '0'
                        account_id: null
                      equity:
                        name: Equity
                        items:
                          - name: Common Stock
                            items: []
                            value: null
                            account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                          - name: Opening Balance
                            items: []
                            value: null
                            account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                          - name: Opening Balance Adjustments
                            items: []
                            value: null
                            account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                          - name: Owner's Equity
                            items: []
                            value: null
                            account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                          - name: Retained Earnings
                            items: []
                            value: null
                            account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                          - name: Dividends
                            items: []
                            value: null
                            account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                        value: '0'
                        account_id: null
                      liabilities:
                        name: Liabilities
                        items:
                          - name: Accounts Payable
                            items: []
                            value: null
                            account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                          - name: Customer Credit
                            items: []
                            value: null
                            account_id: 41174cde-0a50-4504-8469-10299f7b5308
                          - name: Taxes Payable
                            items: []
                            value: null
                            account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                          - name: Income Tax Payable
                            items: []
                            value: null
                            account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                          - name: Property Tax Payable
                            items: []
                            value: null
                            account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                          - name: Accruals
                            items: []
                            value: null
                            account_id: f588b351-5c5f-4062-b18b-6903c8286057
                          - name: Accrued Payroll
                            items: []
                            value: null
                            account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                          - name: Accrued Rent
                            items: []
                            value: null
                            account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                          - name: Credit Cards
                            items: []
                            value: null
                            account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                          - name: Unearned Revenue
                            items: []
                            value: null
                            account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                        value: '0'
                        account_id: null
                      meta:
                        note: Computed by Rutter
                      created_at: '2024-02-13T22:06:15.195Z'
                      updated_at: '2024-02-13T22:06:15.079Z'
                      task_status: SUCCESS
                    - id: b744219b-7a29-42c6-b043-e773ae5e6a64
                      business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                      business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                      platform_id: 8
                      external_id: eb5b803a-15f8-5712-bd0d-b5e931488999
                      start_date: '2022-12-01T00:00:00.000Z'
                      end_date: '2022-12-31T00:00:00.000Z'
                      currency: USD
                      total_assets: '0'
                      total_equity: '0'
                      total_liabilities: '0'
                      assets:
                        name: Assets
                        items:
                          - name: Cash & Bank
                            items:
                              - name: Cash
                                items: []
                                value: null
                                account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                              - name: Petty Cash
                                items: []
                                value: null
                                account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                            value: '0'
                            account_id: null
                          - name: Current Asset
                            items:
                              - name: Accounts Receivable
                                items: []
                                value: null
                                account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                              - name: Customer Deposits
                                items: []
                                value: null
                                account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                              - name: Deferred Discounts
                                items: []
                                value: null
                                account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                              - name: Deposits
                                items: []
                                value: null
                                account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                              - name: Prepaid Expenses
                                items: []
                                value: null
                                account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                            value: '0'
                            account_id: null
                          - name: Property, Plant, and Equipment
                            items:
                              - name: Furniture - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                              - name: Property, Plant, and Equipment
                                items: []
                                value: null
                                account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                              - name: Furniture
                                items: []
                                value: null
                                account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                              - name: Office Equipment
                                items: []
                                value: null
                                account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                              - name: Office Equipment - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: de710f63-acd8-48a2-aab1-6130b8069646
                            value: '0'
                            account_id: null
                        value: '0'
                        account_id: null
                      equity:
                        name: Equity
                        items:
                          - name: Common Stock
                            items: []
                            value: null
                            account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                          - name: Opening Balance
                            items: []
                            value: null
                            account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                          - name: Opening Balance Adjustments
                            items: []
                            value: null
                            account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                          - name: Owner's Equity
                            items: []
                            value: null
                            account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                          - name: Retained Earnings
                            items: []
                            value: null
                            account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                          - name: Dividends
                            items: []
                            value: null
                            account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                        value: '0'
                        account_id: null
                      liabilities:
                        name: Liabilities
                        items:
                          - name: Accounts Payable
                            items: []
                            value: null
                            account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                          - name: Customer Credit
                            items: []
                            value: null
                            account_id: 41174cde-0a50-4504-8469-10299f7b5308
                          - name: Taxes Payable
                            items: []
                            value: null
                            account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                          - name: Income Tax Payable
                            items: []
                            value: null
                            account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                          - name: Property Tax Payable
                            items: []
                            value: null
                            account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                          - name: Accruals
                            items: []
                            value: null
                            account_id: f588b351-5c5f-4062-b18b-6903c8286057
                          - name: Accrued Payroll
                            items: []
                            value: null
                            account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                          - name: Accrued Rent
                            items: []
                            value: null
                            account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                          - name: Credit Cards
                            items: []
                            value: null
                            account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                          - name: Unearned Revenue
                            items: []
                            value: null
                            account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                        value: '0'
                        account_id: null
                      meta:
                        note: Computed by Rutter
                      created_at: '2024-02-13T22:06:15.197Z'
                      updated_at: '2024-02-13T22:06:15.075Z'
                      task_status: SUCCESS
                    - id: 9ccf4961-0416-403e-bee3-626a02063e66
                      business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                      business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                      platform_id: 8
                      external_id: 947dd708-0ee4-54fb-9a87-abe2fb30e64f
                      start_date: '2022-11-01T00:00:00.000Z'
                      end_date: '2022-11-30T00:00:00.000Z'
                      currency: USD
                      total_assets: '0'
                      total_equity: '0'
                      total_liabilities: '0'
                      assets:
                        name: Assets
                        items:
                          - name: Cash & Bank
                            items:
                              - name: Cash
                                items: []
                                value: null
                                account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                              - name: Petty Cash
                                items: []
                                value: null
                                account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                            value: '0'
                            account_id: null
                          - name: Current Asset
                            items:
                              - name: Accounts Receivable
                                items: []
                                value: null
                                account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                              - name: Customer Deposits
                                items: []
                                value: null
                                account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                              - name: Deferred Discounts
                                items: []
                                value: null
                                account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                              - name: Deposits
                                items: []
                                value: null
                                account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                              - name: Prepaid Expenses
                                items: []
                                value: null
                                account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                            value: '0'
                            account_id: null
                          - name: Property, Plant, and Equipment
                            items:
                              - name: Furniture - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                              - name: Property, Plant, and Equipment
                                items: []
                                value: null
                                account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                              - name: Furniture
                                items: []
                                value: null
                                account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                              - name: Office Equipment
                                items: []
                                value: null
                                account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                              - name: Office Equipment - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: de710f63-acd8-48a2-aab1-6130b8069646
                            value: '0'
                            account_id: null
                        value: '0'
                        account_id: null
                      equity:
                        name: Equity
                        items:
                          - name: Common Stock
                            items: []
                            value: null
                            account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                          - name: Opening Balance
                            items: []
                            value: null
                            account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                          - name: Opening Balance Adjustments
                            items: []
                            value: null
                            account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                          - name: Owner's Equity
                            items: []
                            value: null
                            account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                          - name: Retained Earnings
                            items: []
                            value: null
                            account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                          - name: Dividends
                            items: []
                            value: null
                            account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                        value: '0'
                        account_id: null
                      liabilities:
                        name: Liabilities
                        items:
                          - name: Accounts Payable
                            items: []
                            value: null
                            account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                          - name: Customer Credit
                            items: []
                            value: null
                            account_id: 41174cde-0a50-4504-8469-10299f7b5308
                          - name: Taxes Payable
                            items: []
                            value: null
                            account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                          - name: Income Tax Payable
                            items: []
                            value: null
                            account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                          - name: Property Tax Payable
                            items: []
                            value: null
                            account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                          - name: Accruals
                            items: []
                            value: null
                            account_id: f588b351-5c5f-4062-b18b-6903c8286057
                          - name: Accrued Payroll
                            items: []
                            value: null
                            account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                          - name: Accrued Rent
                            items: []
                            value: null
                            account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                          - name: Credit Cards
                            items: []
                            value: null
                            account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                          - name: Unearned Revenue
                            items: []
                            value: null
                            account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                        value: '0'
                        account_id: null
                      meta:
                        note: Computed by Rutter
                      created_at: '2024-02-13T22:06:15.199Z'
                      updated_at: '2024-02-13T22:06:15.070Z'
                      task_status: SUCCESS
                    - id: f5832348-b350-40eb-b84d-86f2fa5480b4
                      business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                      business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                      platform_id: 8
                      external_id: 05eadcf6-5a8e-553f-854e-7c2f93e0fd02
                      start_date: '2022-10-01T00:00:00.000Z'
                      end_date: '2022-10-31T00:00:00.000Z'
                      currency: USD
                      total_assets: '0'
                      total_equity: '0'
                      total_liabilities: '0'
                      assets:
                        name: Assets
                        items:
                          - name: Cash & Bank
                            items:
                              - name: Cash
                                items: []
                                value: null
                                account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                              - name: Petty Cash
                                items: []
                                value: null
                                account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                            value: '0'
                            account_id: null
                          - name: Current Asset
                            items:
                              - name: Accounts Receivable
                                items: []
                                value: null
                                account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                              - name: Customer Deposits
                                items: []
                                value: null
                                account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                              - name: Deferred Discounts
                                items: []
                                value: null
                                account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                              - name: Deposits
                                items: []
                                value: null
                                account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                              - name: Prepaid Expenses
                                items: []
                                value: null
                                account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                            value: '0'
                            account_id: null
                          - name: Property, Plant, and Equipment
                            items:
                              - name: Furniture - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                              - name: Property, Plant, and Equipment
                                items: []
                                value: null
                                account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                              - name: Furniture
                                items: []
                                value: null
                                account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                              - name: Office Equipment
                                items: []
                                value: null
                                account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                              - name: Office Equipment - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: de710f63-acd8-48a2-aab1-6130b8069646
                            value: '0'
                            account_id: null
                        value: '0'
                        account_id: null
                      equity:
                        name: Equity
                        items:
                          - name: Common Stock
                            items: []
                            value: null
                            account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                          - name: Opening Balance
                            items: []
                            value: null
                            account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                          - name: Opening Balance Adjustments
                            items: []
                            value: null
                            account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                          - name: Owner's Equity
                            items: []
                            value: null
                            account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                          - name: Retained Earnings
                            items: []
                            value: null
                            account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                          - name: Dividends
                            items: []
                            value: null
                            account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                        value: '0'
                        account_id: null
                      liabilities:
                        name: Liabilities
                        items:
                          - name: Accounts Payable
                            items: []
                            value: null
                            account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                          - name: Customer Credit
                            items: []
                            value: null
                            account_id: 41174cde-0a50-4504-8469-10299f7b5308
                          - name: Taxes Payable
                            items: []
                            value: null
                            account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                          - name: Income Tax Payable
                            items: []
                            value: null
                            account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                          - name: Property Tax Payable
                            items: []
                            value: null
                            account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                          - name: Accruals
                            items: []
                            value: null
                            account_id: f588b351-5c5f-4062-b18b-6903c8286057
                          - name: Accrued Payroll
                            items: []
                            value: null
                            account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                          - name: Accrued Rent
                            items: []
                            value: null
                            account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                          - name: Credit Cards
                            items: []
                            value: null
                            account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                          - name: Unearned Revenue
                            items: []
                            value: null
                            account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                        value: '0'
                        account_id: null
                      meta:
                        note: Computed by Rutter
                      created_at: '2024-02-13T22:06:15.202Z'
                      updated_at: '2024-02-13T22:06:15.063Z'
                      task_status: SUCCESS
                    - id: 4161652b-6e0d-413c-91cd-1598e7a19f82
                      business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                      business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                      platform_id: 8
                      external_id: 0a5bab96-ba8f-55c9-be9d-ab9021dd9af6
                      start_date: '2022-09-01T00:00:00.000Z'
                      end_date: '2022-09-30T00:00:00.000Z'
                      currency: USD
                      total_assets: '0'
                      total_equity: '0'
                      total_liabilities: '0'
                      assets:
                        name: Assets
                        items:
                          - name: Cash & Bank
                            items:
                              - name: Cash
                                items: []
                                value: null
                                account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                              - name: Petty Cash
                                items: []
                                value: null
                                account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                            value: '0'
                            account_id: null
                          - name: Current Asset
                            items:
                              - name: Accounts Receivable
                                items: []
                                value: null
                                account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                              - name: Customer Deposits
                                items: []
                                value: null
                                account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                              - name: Deferred Discounts
                                items: []
                                value: null
                                account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                              - name: Deposits
                                items: []
                                value: null
                                account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                              - name: Prepaid Expenses
                                items: []
                                value: null
                                account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                            value: '0'
                            account_id: null
                          - name: Property, Plant, and Equipment
                            items:
                              - name: Furniture - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                              - name: Property, Plant, and Equipment
                                items: []
                                value: null
                                account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                              - name: Furniture
                                items: []
                                value: null
                                account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                              - name: Office Equipment
                                items: []
                                value: null
                                account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                              - name: Office Equipment - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: de710f63-acd8-48a2-aab1-6130b8069646
                            value: '0'
                            account_id: null
                        value: '0'
                        account_id: null
                      equity:
                        name: Equity
                        items:
                          - name: Common Stock
                            items: []
                            value: null
                            account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                          - name: Opening Balance
                            items: []
                            value: null
                            account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                          - name: Opening Balance Adjustments
                            items: []
                            value: null
                            account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                          - name: Owner's Equity
                            items: []
                            value: null
                            account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                          - name: Retained Earnings
                            items: []
                            value: null
                            account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                          - name: Dividends
                            items: []
                            value: null
                            account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                        value: '0'
                        account_id: null
                      liabilities:
                        name: Liabilities
                        items:
                          - name: Accounts Payable
                            items: []
                            value: null
                            account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                          - name: Customer Credit
                            items: []
                            value: null
                            account_id: 41174cde-0a50-4504-8469-10299f7b5308
                          - name: Taxes Payable
                            items: []
                            value: null
                            account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                          - name: Income Tax Payable
                            items: []
                            value: null
                            account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                          - name: Property Tax Payable
                            items: []
                            value: null
                            account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                          - name: Accruals
                            items: []
                            value: null
                            account_id: f588b351-5c5f-4062-b18b-6903c8286057
                          - name: Accrued Payroll
                            items: []
                            value: null
                            account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                          - name: Accrued Rent
                            items: []
                            value: null
                            account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                          - name: Credit Cards
                            items: []
                            value: null
                            account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                          - name: Unearned Revenue
                            items: []
                            value: null
                            account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                        value: '0'
                        account_id: null
                      meta:
                        note: Computed by Rutter
                      created_at: '2024-02-13T22:06:15.204Z'
                      updated_at: '2024-02-13T22:06:15.057Z'
                      task_status: SUCCESS
                    - id: ab36a33d-5e5e-4b88-8fab-9490350d3f63
                      business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                      business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                      platform_id: 8
                      external_id: 173355db-05a1-53ca-9533-f39956ee00a9
                      start_date: '2022-08-01T00:00:00.000Z'
                      end_date: '2022-08-31T00:00:00.000Z'
                      currency: USD
                      total_assets: '0'
                      total_equity: '0'
                      total_liabilities: '0'
                      assets:
                        name: Assets
                        items:
                          - name: Cash & Bank
                            items:
                              - name: Cash
                                items: []
                                value: null
                                account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                              - name: Petty Cash
                                items: []
                                value: null
                                account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                            value: '0'
                            account_id: null
                          - name: Current Asset
                            items:
                              - name: Accounts Receivable
                                items: []
                                value: null
                                account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                              - name: Customer Deposits
                                items: []
                                value: null
                                account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                              - name: Deferred Discounts
                                items: []
                                value: null
                                account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                              - name: Deposits
                                items: []
                                value: null
                                account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                              - name: Prepaid Expenses
                                items: []
                                value: null
                                account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                            value: '0'
                            account_id: null
                          - name: Property, Plant, and Equipment
                            items:
                              - name: Furniture - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                              - name: Property, Plant, and Equipment
                                items: []
                                value: null
                                account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                              - name: Furniture
                                items: []
                                value: null
                                account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                              - name: Office Equipment
                                items: []
                                value: null
                                account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                              - name: Office Equipment - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: de710f63-acd8-48a2-aab1-6130b8069646
                            value: '0'
                            account_id: null
                        value: '0'
                        account_id: null
                      equity:
                        name: Equity
                        items:
                          - name: Common Stock
                            items: []
                            value: null
                            account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                          - name: Opening Balance
                            items: []
                            value: null
                            account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                          - name: Opening Balance Adjustments
                            items: []
                            value: null
                            account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                          - name: Owner's Equity
                            items: []
                            value: null
                            account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                          - name: Retained Earnings
                            items: []
                            value: null
                            account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                          - name: Dividends
                            items: []
                            value: null
                            account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                        value: '0'
                        account_id: null
                      liabilities:
                        name: Liabilities
                        items:
                          - name: Accounts Payable
                            items: []
                            value: null
                            account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                          - name: Customer Credit
                            items: []
                            value: null
                            account_id: 41174cde-0a50-4504-8469-10299f7b5308
                          - name: Taxes Payable
                            items: []
                            value: null
                            account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                          - name: Income Tax Payable
                            items: []
                            value: null
                            account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                          - name: Property Tax Payable
                            items: []
                            value: null
                            account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                          - name: Accruals
                            items: []
                            value: null
                            account_id: f588b351-5c5f-4062-b18b-6903c8286057
                          - name: Accrued Payroll
                            items: []
                            value: null
                            account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                          - name: Accrued Rent
                            items: []
                            value: null
                            account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                          - name: Credit Cards
                            items: []
                            value: null
                            account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                          - name: Unearned Revenue
                            items: []
                            value: null
                            account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                        value: '0'
                        account_id: null
                      meta:
                        note: Computed by Rutter
                      created_at: '2024-02-13T22:06:15.206Z'
                      updated_at: '2024-02-13T22:06:15.053Z'
                      task_status: SUCCESS
                    - id: 1d9eef16-eda3-4ecb-93a0-effcd9cceb34
                      business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                      business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                      platform_id: 8
                      external_id: 47c1c5b5-101d-5fc3-b4ab-b72d4607791e
                      start_date: '2022-07-01T00:00:00.000Z'
                      end_date: '2022-07-31T00:00:00.000Z'
                      currency: USD
                      total_assets: '0'
                      total_equity: '0'
                      total_liabilities: '0'
                      assets:
                        name: Assets
                        items:
                          - name: Cash & Bank
                            items:
                              - name: Cash
                                items: []
                                value: null
                                account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                              - name: Petty Cash
                                items: []
                                value: null
                                account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                            value: '0'
                            account_id: null
                          - name: Current Asset
                            items:
                              - name: Accounts Receivable
                                items: []
                                value: null
                                account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                              - name: Customer Deposits
                                items: []
                                value: null
                                account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                              - name: Deferred Discounts
                                items: []
                                value: null
                                account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                              - name: Deposits
                                items: []
                                value: null
                                account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                              - name: Prepaid Expenses
                                items: []
                                value: null
                                account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                            value: '0'
                            account_id: null
                          - name: Property, Plant, and Equipment
                            items:
                              - name: Furniture - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                              - name: Property, Plant, and Equipment
                                items: []
                                value: null
                                account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                              - name: Furniture
                                items: []
                                value: null
                                account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                              - name: Office Equipment
                                items: []
                                value: null
                                account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                              - name: Office Equipment - Accumulated Depreciation
                                items: []
                                value: null
                                account_id: de710f63-acd8-48a2-aab1-6130b8069646
                            value: '0'
                            account_id: null
                        value: '0'
                        account_id: null
                      equity:
                        name: Equity
                        items:
                          - name: Common Stock
                            items: []
                            value: null
                            account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                          - name: Opening Balance
                            items: []
                            value: null
                            account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                          - name: Opening Balance Adjustments
                            items: []
                            value: null
                            account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                          - name: Owner's Equity
                            items: []
                            value: null
                            account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                          - name: Retained Earnings
                            items: []
                            value: null
                            account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                          - name: Dividends
                            items: []
                            value: null
                            account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                        value: '0'
                        account_id: null
                      liabilities:
                        name: Liabilities
                        items:
                          - name: Accounts Payable
                            items: []
                            value: null
                            account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                          - name: Customer Credit
                            items: []
                            value: null
                            account_id: 41174cde-0a50-4504-8469-10299f7b5308
                          - name: Taxes Payable
                            items: []
                            value: null
                            account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                          - name: Income Tax Payable
                            items: []
                            value: null
                            account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                          - name: Property Tax Payable
                            items: []
                            value: null
                            account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                          - name: Accruals
                            items: []
                            value: null
                            account_id: f588b351-5c5f-4062-b18b-6903c8286057
                          - name: Accrued Payroll
                            items: []
                            value: null
                            account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                          - name: Accrued Rent
                            items: []
                            value: null
                            account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                          - name: Credit Cards
                            items: []
                            value: null
                            account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                          - name: Unearned Revenue
                            items: []
                            value: null
                            account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                        value: '0'
                        account_id: null
                      meta:
                        note: Computed by Rutter
                      created_at: '2024-02-13T22:06:15.208Z'
                      updated_at: '2024-02-13T22:06:15.048Z'
                      task_status: SUCCESS
                  total: '63'
      deprecated: false
      security:
        - bearer: []
      servers:
        - url: https://api.joinworth.com/integration/api/v1
          variables: {}
components:
  schemas:
    SuccessBalanceSheet:
      title: SuccessBalanceSheet
      type: object
      properties:
        status:
          type: string
        message:
          type: string
        data:
          $ref: '#/components/schemas/Data13'
      examples:
        - status: success
          message: Successful
          data:
            count: 20
            page: 1
            accounting_balancesheet:
              - id: 837a9495-986a-4cae-b5c1-937da7d2c68f
                business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                platform_id: 8
                external_id: f6c14930-8ec2-5570-ace6-aa22d5feb47d
                start_date: '2024-02-01T00:00:00.000Z'
                end_date: '2024-02-29T00:00:00.000Z'
                currency: USD
                total_assets: '0'
                total_equity: '0'
                total_liabilities: '0'
                assets:
                  name: Assets
                  items:
                    - name: Cash & Bank
                      items:
                        - name: Cash
                          items: []
                          value: null
                          account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                        - name: Petty Cash
                          items: []
                          value: null
                          account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                      value: '0'
                      account_id: null
                    - name: Current Asset
                      items:
                        - name: Accounts Receivable
                          items: []
                          value: null
                          account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                        - name: Customer Deposits
                          items: []
                          value: null
                          account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                        - name: Deferred Discounts
                          items: []
                          value: null
                          account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                        - name: Deposits
                          items: []
                          value: null
                          account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                        - name: Prepaid Expenses
                          items: []
                          value: null
                          account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                      value: '0'
                      account_id: null
                    - name: Property, Plant, and Equipment
                      items:
                        - name: Furniture - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                        - name: Property, Plant, and Equipment
                          items: []
                          value: null
                          account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                        - name: Furniture
                          items: []
                          value: null
                          account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                        - name: Office Equipment
                          items: []
                          value: null
                          account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                        - name: Office Equipment - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: de710f63-acd8-48a2-aab1-6130b8069646
                      value: '0'
                      account_id: null
                  value: '0'
                  account_id: null
                equity:
                  name: Equity
                  items:
                    - name: Common Stock
                      items: []
                      value: null
                      account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                    - name: Opening Balance
                      items: []
                      value: null
                      account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                    - name: Opening Balance Adjustments
                      items: []
                      value: null
                      account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                    - name: Owner's Equity
                      items: []
                      value: null
                      account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                    - name: Retained Earnings
                      items: []
                      value: null
                      account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                    - name: Dividends
                      items: []
                      value: null
                      account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                  value: '0'
                  account_id: null
                liabilities:
                  name: Liabilities
                  items:
                    - name: Accounts Payable
                      items: []
                      value: null
                      account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                    - name: Customer Credit
                      items: []
                      value: null
                      account_id: 41174cde-0a50-4504-8469-10299f7b5308
                    - name: Taxes Payable
                      items: []
                      value: null
                      account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                    - name: Income Tax Payable
                      items: []
                      value: null
                      account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                    - name: Property Tax Payable
                      items: []
                      value: null
                      account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                    - name: Accruals
                      items: []
                      value: null
                      account_id: f588b351-5c5f-4062-b18b-6903c8286057
                    - name: Accrued Payroll
                      items: []
                      value: null
                      account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                    - name: Accrued Rent
                      items: []
                      value: null
                      account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                    - name: Credit Cards
                      items: []
                      value: null
                      account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                    - name: Unearned Revenue
                      items: []
                      value: null
                      account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                  value: '0'
                  account_id: null
                meta:
                  note: Computed by Rutter
                created_at: '2024-02-13T22:06:15.154Z'
                updated_at: '2024-02-13T22:06:15.137Z'
                task_status: SUCCESS
              - id: 8a50526a-a008-45bb-be08-b1086e7c1ac7
                business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                platform_id: 8
                external_id: bec3592b-1450-55bc-85b3-5713aeb143c5
                start_date: '2024-01-01T00:00:00.000Z'
                end_date: '2024-01-31T00:00:00.000Z'
                currency: USD
                total_assets: '0'
                total_equity: '0'
                total_liabilities: '0'
                assets:
                  name: Assets
                  items:
                    - name: Cash & Bank
                      items:
                        - name: Cash
                          items: []
                          value: null
                          account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                        - name: Petty Cash
                          items: []
                          value: null
                          account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                      value: '0'
                      account_id: null
                    - name: Current Asset
                      items:
                        - name: Accounts Receivable
                          items: []
                          value: null
                          account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                        - name: Customer Deposits
                          items: []
                          value: null
                          account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                        - name: Deferred Discounts
                          items: []
                          value: null
                          account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                        - name: Deposits
                          items: []
                          value: null
                          account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                        - name: Prepaid Expenses
                          items: []
                          value: null
                          account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                      value: '0'
                      account_id: null
                    - name: Property, Plant, and Equipment
                      items:
                        - name: Furniture - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                        - name: Property, Plant, and Equipment
                          items: []
                          value: null
                          account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                        - name: Furniture
                          items: []
                          value: null
                          account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                        - name: Office Equipment
                          items: []
                          value: null
                          account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                        - name: Office Equipment - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: de710f63-acd8-48a2-aab1-6130b8069646
                      value: '0'
                      account_id: null
                  value: '0'
                  account_id: null
                equity:
                  name: Equity
                  items:
                    - name: Common Stock
                      items: []
                      value: null
                      account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                    - name: Opening Balance
                      items: []
                      value: null
                      account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                    - name: Opening Balance Adjustments
                      items: []
                      value: null
                      account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                    - name: Owner's Equity
                      items: []
                      value: null
                      account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                    - name: Retained Earnings
                      items: []
                      value: null
                      account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                    - name: Dividends
                      items: []
                      value: null
                      account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                  value: '0'
                  account_id: null
                liabilities:
                  name: Liabilities
                  items:
                    - name: Accounts Payable
                      items: []
                      value: null
                      account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                    - name: Customer Credit
                      items: []
                      value: null
                      account_id: 41174cde-0a50-4504-8469-10299f7b5308
                    - name: Taxes Payable
                      items: []
                      value: null
                      account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                    - name: Income Tax Payable
                      items: []
                      value: null
                      account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                    - name: Property Tax Payable
                      items: []
                      value: null
                      account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                    - name: Accruals
                      items: []
                      value: null
                      account_id: f588b351-5c5f-4062-b18b-6903c8286057
                    - name: Accrued Payroll
                      items: []
                      value: null
                      account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                    - name: Accrued Rent
                      items: []
                      value: null
                      account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                    - name: Credit Cards
                      items: []
                      value: null
                      account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                    - name: Unearned Revenue
                      items: []
                      value: null
                      account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                  value: '0'
                  account_id: null
                meta:
                  note: Computed by Rutter
                created_at: '2024-02-13T22:06:15.159Z'
                updated_at: '2024-02-13T22:06:15.133Z'
                task_status: SUCCESS
              - id: 470c45a4-6a99-4cec-a590-6b919e4ad877
                business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                platform_id: 8
                external_id: 7d697f90-3edb-5db9-a5b5-bb25ab510cc8
                start_date: '2023-12-01T00:00:00.000Z'
                end_date: '2023-12-31T00:00:00.000Z'
                currency: USD
                total_assets: '0'
                total_equity: '0'
                total_liabilities: '0'
                assets:
                  name: Assets
                  items:
                    - name: Cash & Bank
                      items:
                        - name: Cash
                          items: []
                          value: null
                          account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                        - name: Petty Cash
                          items: []
                          value: null
                          account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                      value: '0'
                      account_id: null
                    - name: Current Asset
                      items:
                        - name: Accounts Receivable
                          items: []
                          value: null
                          account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                        - name: Customer Deposits
                          items: []
                          value: null
                          account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                        - name: Deferred Discounts
                          items: []
                          value: null
                          account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                        - name: Deposits
                          items: []
                          value: null
                          account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                        - name: Prepaid Expenses
                          items: []
                          value: null
                          account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                      value: '0'
                      account_id: null
                    - name: Property, Plant, and Equipment
                      items:
                        - name: Furniture - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                        - name: Property, Plant, and Equipment
                          items: []
                          value: null
                          account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                        - name: Furniture
                          items: []
                          value: null
                          account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                        - name: Office Equipment
                          items: []
                          value: null
                          account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                        - name: Office Equipment - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: de710f63-acd8-48a2-aab1-6130b8069646
                      value: '0'
                      account_id: null
                  value: '0'
                  account_id: null
                equity:
                  name: Equity
                  items:
                    - name: Common Stock
                      items: []
                      value: null
                      account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                    - name: Opening Balance
                      items: []
                      value: null
                      account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                    - name: Opening Balance Adjustments
                      items: []
                      value: null
                      account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                    - name: Owner's Equity
                      items: []
                      value: null
                      account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                    - name: Retained Earnings
                      items: []
                      value: null
                      account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                    - name: Dividends
                      items: []
                      value: null
                      account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                  value: '0'
                  account_id: null
                liabilities:
                  name: Liabilities
                  items:
                    - name: Accounts Payable
                      items: []
                      value: null
                      account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                    - name: Customer Credit
                      items: []
                      value: null
                      account_id: 41174cde-0a50-4504-8469-10299f7b5308
                    - name: Taxes Payable
                      items: []
                      value: null
                      account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                    - name: Income Tax Payable
                      items: []
                      value: null
                      account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                    - name: Property Tax Payable
                      items: []
                      value: null
                      account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                    - name: Accruals
                      items: []
                      value: null
                      account_id: f588b351-5c5f-4062-b18b-6903c8286057
                    - name: Accrued Payroll
                      items: []
                      value: null
                      account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                    - name: Accrued Rent
                      items: []
                      value: null
                      account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                    - name: Credit Cards
                      items: []
                      value: null
                      account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                    - name: Unearned Revenue
                      items: []
                      value: null
                      account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                  value: '0'
                  account_id: null
                meta:
                  note: Computed by Rutter
                created_at: '2024-02-13T22:06:15.161Z'
                updated_at: '2024-02-13T22:06:15.129Z'
                task_status: SUCCESS
              - id: 83958e6f-4e56-47fa-9b8b-62267c77a9b5
                business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                platform_id: 8
                external_id: 231f6533-bb17-58f0-85f3-ceeb072bfed9
                start_date: '2023-11-01T00:00:00.000Z'
                end_date: '2023-11-30T00:00:00.000Z'
                currency: USD
                total_assets: '0'
                total_equity: '0'
                total_liabilities: '0'
                assets:
                  name: Assets
                  items:
                    - name: Cash & Bank
                      items:
                        - name: Cash
                          items: []
                          value: null
                          account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                        - name: Petty Cash
                          items: []
                          value: null
                          account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                      value: '0'
                      account_id: null
                    - name: Current Asset
                      items:
                        - name: Accounts Receivable
                          items: []
                          value: null
                          account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                        - name: Customer Deposits
                          items: []
                          value: null
                          account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                        - name: Deferred Discounts
                          items: []
                          value: null
                          account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                        - name: Deposits
                          items: []
                          value: null
                          account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                        - name: Prepaid Expenses
                          items: []
                          value: null
                          account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                      value: '0'
                      account_id: null
                    - name: Property, Plant, and Equipment
                      items:
                        - name: Furniture - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                        - name: Property, Plant, and Equipment
                          items: []
                          value: null
                          account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                        - name: Furniture
                          items: []
                          value: null
                          account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                        - name: Office Equipment
                          items: []
                          value: null
                          account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                        - name: Office Equipment - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: de710f63-acd8-48a2-aab1-6130b8069646
                      value: '0'
                      account_id: null
                  value: '0'
                  account_id: null
                equity:
                  name: Equity
                  items:
                    - name: Common Stock
                      items: []
                      value: null
                      account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                    - name: Opening Balance
                      items: []
                      value: null
                      account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                    - name: Opening Balance Adjustments
                      items: []
                      value: null
                      account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                    - name: Owner's Equity
                      items: []
                      value: null
                      account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                    - name: Retained Earnings
                      items: []
                      value: null
                      account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                    - name: Dividends
                      items: []
                      value: null
                      account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                  value: '0'
                  account_id: null
                liabilities:
                  name: Liabilities
                  items:
                    - name: Accounts Payable
                      items: []
                      value: null
                      account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                    - name: Customer Credit
                      items: []
                      value: null
                      account_id: 41174cde-0a50-4504-8469-10299f7b5308
                    - name: Taxes Payable
                      items: []
                      value: null
                      account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                    - name: Income Tax Payable
                      items: []
                      value: null
                      account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                    - name: Property Tax Payable
                      items: []
                      value: null
                      account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                    - name: Accruals
                      items: []
                      value: null
                      account_id: f588b351-5c5f-4062-b18b-6903c8286057
                    - name: Accrued Payroll
                      items: []
                      value: null
                      account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                    - name: Accrued Rent
                      items: []
                      value: null
                      account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                    - name: Credit Cards
                      items: []
                      value: null
                      account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                    - name: Unearned Revenue
                      items: []
                      value: null
                      account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                  value: '0'
                  account_id: null
                meta:
                  note: Computed by Rutter
                created_at: '2024-02-13T22:06:15.164Z'
                updated_at: '2024-02-13T22:06:15.127Z'
                task_status: SUCCESS
              - id: c3f64d61-da65-4c86-8ede-27570293e7ee
                business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                platform_id: 8
                external_id: 9e6880ad-dfb9-5520-9f7e-63abe67417e8
                start_date: '2023-10-01T00:00:00.000Z'
                end_date: '2023-10-31T00:00:00.000Z'
                currency: USD
                total_assets: '0'
                total_equity: '0'
                total_liabilities: '0'
                assets:
                  name: Assets
                  items:
                    - name: Cash & Bank
                      items:
                        - name: Cash
                          items: []
                          value: null
                          account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                        - name: Petty Cash
                          items: []
                          value: null
                          account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                      value: '0'
                      account_id: null
                    - name: Current Asset
                      items:
                        - name: Accounts Receivable
                          items: []
                          value: null
                          account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                        - name: Customer Deposits
                          items: []
                          value: null
                          account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                        - name: Deferred Discounts
                          items: []
                          value: null
                          account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                        - name: Deposits
                          items: []
                          value: null
                          account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                        - name: Prepaid Expenses
                          items: []
                          value: null
                          account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                      value: '0'
                      account_id: null
                    - name: Property, Plant, and Equipment
                      items:
                        - name: Furniture - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                        - name: Property, Plant, and Equipment
                          items: []
                          value: null
                          account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                        - name: Furniture
                          items: []
                          value: null
                          account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                        - name: Office Equipment
                          items: []
                          value: null
                          account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                        - name: Office Equipment - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: de710f63-acd8-48a2-aab1-6130b8069646
                      value: '0'
                      account_id: null
                  value: '0'
                  account_id: null
                equity:
                  name: Equity
                  items:
                    - name: Common Stock
                      items: []
                      value: null
                      account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                    - name: Opening Balance
                      items: []
                      value: null
                      account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                    - name: Opening Balance Adjustments
                      items: []
                      value: null
                      account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                    - name: Owner's Equity
                      items: []
                      value: null
                      account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                    - name: Retained Earnings
                      items: []
                      value: null
                      account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                    - name: Dividends
                      items: []
                      value: null
                      account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                  value: '0'
                  account_id: null
                liabilities:
                  name: Liabilities
                  items:
                    - name: Accounts Payable
                      items: []
                      value: null
                      account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                    - name: Customer Credit
                      items: []
                      value: null
                      account_id: 41174cde-0a50-4504-8469-10299f7b5308
                    - name: Taxes Payable
                      items: []
                      value: null
                      account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                    - name: Income Tax Payable
                      items: []
                      value: null
                      account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                    - name: Property Tax Payable
                      items: []
                      value: null
                      account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                    - name: Accruals
                      items: []
                      value: null
                      account_id: f588b351-5c5f-4062-b18b-6903c8286057
                    - name: Accrued Payroll
                      items: []
                      value: null
                      account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                    - name: Accrued Rent
                      items: []
                      value: null
                      account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                    - name: Credit Cards
                      items: []
                      value: null
                      account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                    - name: Unearned Revenue
                      items: []
                      value: null
                      account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                  value: '0'
                  account_id: null
                meta:
                  note: Computed by Rutter
                created_at: '2024-02-13T22:06:15.166Z'
                updated_at: '2024-02-13T22:06:15.120Z'
                task_status: SUCCESS
              - id: 08f37ff7-adef-4e37-a397-f4a5e7aca2a5
                business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                platform_id: 8
                external_id: a2b548af-9a1b-5235-bbe6-9ea65c5bc20b
                start_date: '2023-09-01T00:00:00.000Z'
                end_date: '2023-09-30T00:00:00.000Z'
                currency: USD
                total_assets: '0'
                total_equity: '0'
                total_liabilities: '0'
                assets:
                  name: Assets
                  items:
                    - name: Cash & Bank
                      items:
                        - name: Cash
                          items: []
                          value: null
                          account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                        - name: Petty Cash
                          items: []
                          value: null
                          account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                      value: '0'
                      account_id: null
                    - name: Current Asset
                      items:
                        - name: Accounts Receivable
                          items: []
                          value: null
                          account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                        - name: Customer Deposits
                          items: []
                          value: null
                          account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                        - name: Deferred Discounts
                          items: []
                          value: null
                          account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                        - name: Deposits
                          items: []
                          value: null
                          account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                        - name: Prepaid Expenses
                          items: []
                          value: null
                          account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                      value: '0'
                      account_id: null
                    - name: Property, Plant, and Equipment
                      items:
                        - name: Furniture - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                        - name: Property, Plant, and Equipment
                          items: []
                          value: null
                          account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                        - name: Furniture
                          items: []
                          value: null
                          account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                        - name: Office Equipment
                          items: []
                          value: null
                          account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                        - name: Office Equipment - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: de710f63-acd8-48a2-aab1-6130b8069646
                      value: '0'
                      account_id: null
                  value: '0'
                  account_id: null
                equity:
                  name: Equity
                  items:
                    - name: Common Stock
                      items: []
                      value: null
                      account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                    - name: Opening Balance
                      items: []
                      value: null
                      account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                    - name: Opening Balance Adjustments
                      items: []
                      value: null
                      account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                    - name: Owner's Equity
                      items: []
                      value: null
                      account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                    - name: Retained Earnings
                      items: []
                      value: null
                      account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                    - name: Dividends
                      items: []
                      value: null
                      account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                  value: '0'
                  account_id: null
                liabilities:
                  name: Liabilities
                  items:
                    - name: Accounts Payable
                      items: []
                      value: null
                      account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                    - name: Customer Credit
                      items: []
                      value: null
                      account_id: 41174cde-0a50-4504-8469-10299f7b5308
                    - name: Taxes Payable
                      items: []
                      value: null
                      account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                    - name: Income Tax Payable
                      items: []
                      value: null
                      account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                    - name: Property Tax Payable
                      items: []
                      value: null
                      account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                    - name: Accruals
                      items: []
                      value: null
                      account_id: f588b351-5c5f-4062-b18b-6903c8286057
                    - name: Accrued Payroll
                      items: []
                      value: null
                      account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                    - name: Accrued Rent
                      items: []
                      value: null
                      account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                    - name: Credit Cards
                      items: []
                      value: null
                      account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                    - name: Unearned Revenue
                      items: []
                      value: null
                      account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                  value: '0'
                  account_id: null
                meta:
                  note: Computed by Rutter
                created_at: '2024-02-13T22:06:15.168Z'
                updated_at: '2024-02-13T22:06:15.115Z'
                task_status: SUCCESS
              - id: 8a343105-994b-4730-b754-33e940a4506c
                business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                platform_id: 8
                external_id: 344c4b2f-9ec1-5591-aa91-11ac2f87a221
                start_date: '2023-08-01T00:00:00.000Z'
                end_date: '2023-08-31T00:00:00.000Z'
                currency: USD
                total_assets: '0'
                total_equity: '0'
                total_liabilities: '0'
                assets:
                  name: Assets
                  items:
                    - name: Cash & Bank
                      items:
                        - name: Cash
                          items: []
                          value: null
                          account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                        - name: Petty Cash
                          items: []
                          value: null
                          account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                      value: '0'
                      account_id: null
                    - name: Current Asset
                      items:
                        - name: Accounts Receivable
                          items: []
                          value: null
                          account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                        - name: Customer Deposits
                          items: []
                          value: null
                          account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                        - name: Deferred Discounts
                          items: []
                          value: null
                          account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                        - name: Deposits
                          items: []
                          value: null
                          account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                        - name: Prepaid Expenses
                          items: []
                          value: null
                          account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                      value: '0'
                      account_id: null
                    - name: Property, Plant, and Equipment
                      items:
                        - name: Furniture - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                        - name: Property, Plant, and Equipment
                          items: []
                          value: null
                          account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                        - name: Furniture
                          items: []
                          value: null
                          account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                        - name: Office Equipment
                          items: []
                          value: null
                          account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                        - name: Office Equipment - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: de710f63-acd8-48a2-aab1-6130b8069646
                      value: '0'
                      account_id: null
                  value: '0'
                  account_id: null
                equity:
                  name: Equity
                  items:
                    - name: Common Stock
                      items: []
                      value: null
                      account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                    - name: Opening Balance
                      items: []
                      value: null
                      account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                    - name: Opening Balance Adjustments
                      items: []
                      value: null
                      account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                    - name: Owner's Equity
                      items: []
                      value: null
                      account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                    - name: Retained Earnings
                      items: []
                      value: null
                      account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                    - name: Dividends
                      items: []
                      value: null
                      account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                  value: '0'
                  account_id: null
                liabilities:
                  name: Liabilities
                  items:
                    - name: Accounts Payable
                      items: []
                      value: null
                      account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                    - name: Customer Credit
                      items: []
                      value: null
                      account_id: 41174cde-0a50-4504-8469-10299f7b5308
                    - name: Taxes Payable
                      items: []
                      value: null
                      account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                    - name: Income Tax Payable
                      items: []
                      value: null
                      account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                    - name: Property Tax Payable
                      items: []
                      value: null
                      account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                    - name: Accruals
                      items: []
                      value: null
                      account_id: f588b351-5c5f-4062-b18b-6903c8286057
                    - name: Accrued Payroll
                      items: []
                      value: null
                      account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                    - name: Accrued Rent
                      items: []
                      value: null
                      account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                    - name: Credit Cards
                      items: []
                      value: null
                      account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                    - name: Unearned Revenue
                      items: []
                      value: null
                      account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                  value: '0'
                  account_id: null
                meta:
                  note: Computed by Rutter
                created_at: '2024-02-13T22:06:15.170Z'
                updated_at: '2024-02-13T22:06:15.110Z'
                task_status: SUCCESS
              - id: 20cf3f3f-857a-418b-918e-d97b84e8699c
                business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                platform_id: 8
                external_id: 254d96c0-6447-50f2-a56b-49577c48978a
                start_date: '2023-07-01T00:00:00.000Z'
                end_date: '2023-07-31T00:00:00.000Z'
                currency: USD
                total_assets: '0'
                total_equity: '0'
                total_liabilities: '0'
                assets:
                  name: Assets
                  items:
                    - name: Cash & Bank
                      items:
                        - name: Cash
                          items: []
                          value: null
                          account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                        - name: Petty Cash
                          items: []
                          value: null
                          account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                      value: '0'
                      account_id: null
                    - name: Current Asset
                      items:
                        - name: Accounts Receivable
                          items: []
                          value: null
                          account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                        - name: Customer Deposits
                          items: []
                          value: null
                          account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                        - name: Deferred Discounts
                          items: []
                          value: null
                          account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                        - name: Deposits
                          items: []
                          value: null
                          account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                        - name: Prepaid Expenses
                          items: []
                          value: null
                          account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                      value: '0'
                      account_id: null
                    - name: Property, Plant, and Equipment
                      items:
                        - name: Furniture - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                        - name: Property, Plant, and Equipment
                          items: []
                          value: null
                          account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                        - name: Furniture
                          items: []
                          value: null
                          account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                        - name: Office Equipment
                          items: []
                          value: null
                          account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                        - name: Office Equipment - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: de710f63-acd8-48a2-aab1-6130b8069646
                      value: '0'
                      account_id: null
                  value: '0'
                  account_id: null
                equity:
                  name: Equity
                  items:
                    - name: Common Stock
                      items: []
                      value: null
                      account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                    - name: Opening Balance
                      items: []
                      value: null
                      account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                    - name: Opening Balance Adjustments
                      items: []
                      value: null
                      account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                    - name: Owner's Equity
                      items: []
                      value: null
                      account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                    - name: Retained Earnings
                      items: []
                      value: null
                      account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                    - name: Dividends
                      items: []
                      value: null
                      account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                  value: '0'
                  account_id: null
                liabilities:
                  name: Liabilities
                  items:
                    - name: Accounts Payable
                      items: []
                      value: null
                      account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                    - name: Customer Credit
                      items: []
                      value: null
                      account_id: 41174cde-0a50-4504-8469-10299f7b5308
                    - name: Taxes Payable
                      items: []
                      value: null
                      account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                    - name: Income Tax Payable
                      items: []
                      value: null
                      account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                    - name: Property Tax Payable
                      items: []
                      value: null
                      account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                    - name: Accruals
                      items: []
                      value: null
                      account_id: f588b351-5c5f-4062-b18b-6903c8286057
                    - name: Accrued Payroll
                      items: []
                      value: null
                      account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                    - name: Accrued Rent
                      items: []
                      value: null
                      account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                    - name: Credit Cards
                      items: []
                      value: null
                      account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                    - name: Unearned Revenue
                      items: []
                      value: null
                      account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                  value: '0'
                  account_id: null
                meta:
                  note: Computed by Rutter
                created_at: '2024-02-13T22:06:15.172Z'
                updated_at: '2024-02-13T22:06:15.106Z'
                task_status: SUCCESS
              - id: f4c1acd2-6cfb-4a11-8ff1-58079159f3e1
                business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                platform_id: 8
                external_id: b37c6a61-4b03-59af-806c-0c59b9574f6d
                start_date: '2023-06-01T00:00:00.000Z'
                end_date: '2023-06-30T00:00:00.000Z'
                currency: USD
                total_assets: '0'
                total_equity: '0'
                total_liabilities: '0'
                assets:
                  name: Assets
                  items:
                    - name: Cash & Bank
                      items:
                        - name: Cash
                          items: []
                          value: null
                          account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                        - name: Petty Cash
                          items: []
                          value: null
                          account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                      value: '0'
                      account_id: null
                    - name: Current Asset
                      items:
                        - name: Accounts Receivable
                          items: []
                          value: null
                          account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                        - name: Customer Deposits
                          items: []
                          value: null
                          account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                        - name: Deferred Discounts
                          items: []
                          value: null
                          account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                        - name: Deposits
                          items: []
                          value: null
                          account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                        - name: Prepaid Expenses
                          items: []
                          value: null
                          account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                      value: '0'
                      account_id: null
                    - name: Property, Plant, and Equipment
                      items:
                        - name: Furniture - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                        - name: Property, Plant, and Equipment
                          items: []
                          value: null
                          account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                        - name: Furniture
                          items: []
                          value: null
                          account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                        - name: Office Equipment
                          items: []
                          value: null
                          account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                        - name: Office Equipment - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: de710f63-acd8-48a2-aab1-6130b8069646
                      value: '0'
                      account_id: null
                  value: '0'
                  account_id: null
                equity:
                  name: Equity
                  items:
                    - name: Common Stock
                      items: []
                      value: null
                      account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                    - name: Opening Balance
                      items: []
                      value: null
                      account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                    - name: Opening Balance Adjustments
                      items: []
                      value: null
                      account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                    - name: Owner's Equity
                      items: []
                      value: null
                      account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                    - name: Retained Earnings
                      items: []
                      value: null
                      account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                    - name: Dividends
                      items: []
                      value: null
                      account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                  value: '0'
                  account_id: null
                liabilities:
                  name: Liabilities
                  items:
                    - name: Accounts Payable
                      items: []
                      value: null
                      account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                    - name: Customer Credit
                      items: []
                      value: null
                      account_id: 41174cde-0a50-4504-8469-10299f7b5308
                    - name: Taxes Payable
                      items: []
                      value: null
                      account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                    - name: Income Tax Payable
                      items: []
                      value: null
                      account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                    - name: Property Tax Payable
                      items: []
                      value: null
                      account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                    - name: Accruals
                      items: []
                      value: null
                      account_id: f588b351-5c5f-4062-b18b-6903c8286057
                    - name: Accrued Payroll
                      items: []
                      value: null
                      account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                    - name: Accrued Rent
                      items: []
                      value: null
                      account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                    - name: Credit Cards
                      items: []
                      value: null
                      account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                    - name: Unearned Revenue
                      items: []
                      value: null
                      account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                  value: '0'
                  account_id: null
                meta:
                  note: Computed by Rutter
                created_at: '2024-02-13T22:06:15.174Z'
                updated_at: '2024-02-13T22:06:15.101Z'
                task_status: SUCCESS
              - id: 9e608eb4-59c2-4ae5-bdff-01658e88e208
                business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                platform_id: 8
                external_id: c1d0c8f3-e8bc-510d-9dcf-3afe83f234c1
                start_date: '2023-05-01T00:00:00.000Z'
                end_date: '2023-05-31T00:00:00.000Z'
                currency: USD
                total_assets: '0'
                total_equity: '0'
                total_liabilities: '0'
                assets:
                  name: Assets
                  items:
                    - name: Cash & Bank
                      items:
                        - name: Cash
                          items: []
                          value: null
                          account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                        - name: Petty Cash
                          items: []
                          value: null
                          account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                      value: '0'
                      account_id: null
                    - name: Current Asset
                      items:
                        - name: Accounts Receivable
                          items: []
                          value: null
                          account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                        - name: Customer Deposits
                          items: []
                          value: null
                          account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                        - name: Deferred Discounts
                          items: []
                          value: null
                          account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                        - name: Deposits
                          items: []
                          value: null
                          account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                        - name: Prepaid Expenses
                          items: []
                          value: null
                          account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                      value: '0'
                      account_id: null
                    - name: Property, Plant, and Equipment
                      items:
                        - name: Furniture - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                        - name: Property, Plant, and Equipment
                          items: []
                          value: null
                          account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                        - name: Furniture
                          items: []
                          value: null
                          account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                        - name: Office Equipment
                          items: []
                          value: null
                          account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                        - name: Office Equipment - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: de710f63-acd8-48a2-aab1-6130b8069646
                      value: '0'
                      account_id: null
                  value: '0'
                  account_id: null
                equity:
                  name: Equity
                  items:
                    - name: Common Stock
                      items: []
                      value: null
                      account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                    - name: Opening Balance
                      items: []
                      value: null
                      account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                    - name: Opening Balance Adjustments
                      items: []
                      value: null
                      account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                    - name: Owner's Equity
                      items: []
                      value: null
                      account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                    - name: Retained Earnings
                      items: []
                      value: null
                      account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                    - name: Dividends
                      items: []
                      value: null
                      account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                  value: '0'
                  account_id: null
                liabilities:
                  name: Liabilities
                  items:
                    - name: Accounts Payable
                      items: []
                      value: null
                      account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                    - name: Customer Credit
                      items: []
                      value: null
                      account_id: 41174cde-0a50-4504-8469-10299f7b5308
                    - name: Taxes Payable
                      items: []
                      value: null
                      account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                    - name: Income Tax Payable
                      items: []
                      value: null
                      account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                    - name: Property Tax Payable
                      items: []
                      value: null
                      account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                    - name: Accruals
                      items: []
                      value: null
                      account_id: f588b351-5c5f-4062-b18b-6903c8286057
                    - name: Accrued Payroll
                      items: []
                      value: null
                      account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                    - name: Accrued Rent
                      items: []
                      value: null
                      account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                    - name: Credit Cards
                      items: []
                      value: null
                      account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                    - name: Unearned Revenue
                      items: []
                      value: null
                      account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                  value: '0'
                  account_id: null
                meta:
                  note: Computed by Rutter
                created_at: '2024-02-13T22:06:15.176Z'
                updated_at: '2024-02-13T22:06:15.097Z'
                task_status: SUCCESS
              - id: 97b7e48a-7dbe-4984-bf3a-54c9bfe91817
                business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                platform_id: 8
                external_id: e236c83b-38a3-52a8-8793-8bbc1507ce58
                start_date: '2023-04-01T00:00:00.000Z'
                end_date: '2023-04-30T00:00:00.000Z'
                currency: USD
                total_assets: '0'
                total_equity: '0'
                total_liabilities: '0'
                assets:
                  name: Assets
                  items:
                    - name: Cash & Bank
                      items:
                        - name: Cash
                          items: []
                          value: null
                          account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                        - name: Petty Cash
                          items: []
                          value: null
                          account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                      value: '0'
                      account_id: null
                    - name: Current Asset
                      items:
                        - name: Accounts Receivable
                          items: []
                          value: null
                          account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                        - name: Customer Deposits
                          items: []
                          value: null
                          account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                        - name: Deferred Discounts
                          items: []
                          value: null
                          account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                        - name: Deposits
                          items: []
                          value: null
                          account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                        - name: Prepaid Expenses
                          items: []
                          value: null
                          account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                      value: '0'
                      account_id: null
                    - name: Property, Plant, and Equipment
                      items:
                        - name: Furniture - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                        - name: Property, Plant, and Equipment
                          items: []
                          value: null
                          account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                        - name: Furniture
                          items: []
                          value: null
                          account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                        - name: Office Equipment
                          items: []
                          value: null
                          account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                        - name: Office Equipment - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: de710f63-acd8-48a2-aab1-6130b8069646
                      value: '0'
                      account_id: null
                  value: '0'
                  account_id: null
                equity:
                  name: Equity
                  items:
                    - name: Common Stock
                      items: []
                      value: null
                      account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                    - name: Opening Balance
                      items: []
                      value: null
                      account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                    - name: Opening Balance Adjustments
                      items: []
                      value: null
                      account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                    - name: Owner's Equity
                      items: []
                      value: null
                      account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                    - name: Retained Earnings
                      items: []
                      value: null
                      account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                    - name: Dividends
                      items: []
                      value: null
                      account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                  value: '0'
                  account_id: null
                liabilities:
                  name: Liabilities
                  items:
                    - name: Accounts Payable
                      items: []
                      value: null
                      account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                    - name: Customer Credit
                      items: []
                      value: null
                      account_id: 41174cde-0a50-4504-8469-10299f7b5308
                    - name: Taxes Payable
                      items: []
                      value: null
                      account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                    - name: Income Tax Payable
                      items: []
                      value: null
                      account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                    - name: Property Tax Payable
                      items: []
                      value: null
                      account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                    - name: Accruals
                      items: []
                      value: null
                      account_id: f588b351-5c5f-4062-b18b-6903c8286057
                    - name: Accrued Payroll
                      items: []
                      value: null
                      account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                    - name: Accrued Rent
                      items: []
                      value: null
                      account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                    - name: Credit Cards
                      items: []
                      value: null
                      account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                    - name: Unearned Revenue
                      items: []
                      value: null
                      account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                  value: '0'
                  account_id: null
                meta:
                  note: Computed by Rutter
                created_at: '2024-02-13T22:06:15.178Z'
                updated_at: '2024-02-13T22:06:15.092Z'
                task_status: SUCCESS
              - id: 7e215746-64b5-47aa-a1e1-8ddcdfb4ed69
                business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                platform_id: 8
                external_id: 50a8564b-7d16-5216-85b3-05e2813bf44c
                start_date: '2023-03-01T00:00:00.000Z'
                end_date: '2023-03-31T00:00:00.000Z'
                currency: USD
                total_assets: '0'
                total_equity: '0'
                total_liabilities: '0'
                assets:
                  name: Assets
                  items:
                    - name: Cash & Bank
                      items:
                        - name: Cash
                          items: []
                          value: null
                          account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                        - name: Petty Cash
                          items: []
                          value: null
                          account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                      value: '0'
                      account_id: null
                    - name: Current Asset
                      items:
                        - name: Accounts Receivable
                          items: []
                          value: null
                          account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                        - name: Customer Deposits
                          items: []
                          value: null
                          account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                        - name: Deferred Discounts
                          items: []
                          value: null
                          account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                        - name: Deposits
                          items: []
                          value: null
                          account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                        - name: Prepaid Expenses
                          items: []
                          value: null
                          account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                      value: '0'
                      account_id: null
                    - name: Property, Plant, and Equipment
                      items:
                        - name: Furniture - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                        - name: Property, Plant, and Equipment
                          items: []
                          value: null
                          account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                        - name: Furniture
                          items: []
                          value: null
                          account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                        - name: Office Equipment
                          items: []
                          value: null
                          account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                        - name: Office Equipment - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: de710f63-acd8-48a2-aab1-6130b8069646
                      value: '0'
                      account_id: null
                  value: '0'
                  account_id: null
                equity:
                  name: Equity
                  items:
                    - name: Common Stock
                      items: []
                      value: null
                      account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                    - name: Opening Balance
                      items: []
                      value: null
                      account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                    - name: Opening Balance Adjustments
                      items: []
                      value: null
                      account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                    - name: Owner's Equity
                      items: []
                      value: null
                      account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                    - name: Retained Earnings
                      items: []
                      value: null
                      account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                    - name: Dividends
                      items: []
                      value: null
                      account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                  value: '0'
                  account_id: null
                liabilities:
                  name: Liabilities
                  items:
                    - name: Accounts Payable
                      items: []
                      value: null
                      account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                    - name: Customer Credit
                      items: []
                      value: null
                      account_id: 41174cde-0a50-4504-8469-10299f7b5308
                    - name: Taxes Payable
                      items: []
                      value: null
                      account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                    - name: Income Tax Payable
                      items: []
                      value: null
                      account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                    - name: Property Tax Payable
                      items: []
                      value: null
                      account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                    - name: Accruals
                      items: []
                      value: null
                      account_id: f588b351-5c5f-4062-b18b-6903c8286057
                    - name: Accrued Payroll
                      items: []
                      value: null
                      account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                    - name: Accrued Rent
                      items: []
                      value: null
                      account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                    - name: Credit Cards
                      items: []
                      value: null
                      account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                    - name: Unearned Revenue
                      items: []
                      value: null
                      account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                  value: '0'
                  account_id: null
                meta:
                  note: Computed by Rutter
                created_at: '2024-02-13T22:06:15.181Z'
                updated_at: '2024-02-13T22:06:15.088Z'
                task_status: SUCCESS
              - id: 88097521-aff7-49ca-bfe4-45ab6c4bbfb6
                business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                platform_id: 8
                external_id: ccccc50d-d4d6-598c-84e0-ed8d6ed1229f
                start_date: '2023-02-01T00:00:00.000Z'
                end_date: '2023-02-28T00:00:00.000Z'
                currency: USD
                total_assets: '0'
                total_equity: '0'
                total_liabilities: '0'
                assets:
                  name: Assets
                  items:
                    - name: Cash & Bank
                      items:
                        - name: Cash
                          items: []
                          value: null
                          account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                        - name: Petty Cash
                          items: []
                          value: null
                          account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                      value: '0'
                      account_id: null
                    - name: Current Asset
                      items:
                        - name: Accounts Receivable
                          items: []
                          value: null
                          account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                        - name: Customer Deposits
                          items: []
                          value: null
                          account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                        - name: Deferred Discounts
                          items: []
                          value: null
                          account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                        - name: Deposits
                          items: []
                          value: null
                          account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                        - name: Prepaid Expenses
                          items: []
                          value: null
                          account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                      value: '0'
                      account_id: null
                    - name: Property, Plant, and Equipment
                      items:
                        - name: Furniture - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                        - name: Property, Plant, and Equipment
                          items: []
                          value: null
                          account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                        - name: Furniture
                          items: []
                          value: null
                          account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                        - name: Office Equipment
                          items: []
                          value: null
                          account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                        - name: Office Equipment - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: de710f63-acd8-48a2-aab1-6130b8069646
                      value: '0'
                      account_id: null
                  value: '0'
                  account_id: null
                equity:
                  name: Equity
                  items:
                    - name: Common Stock
                      items: []
                      value: null
                      account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                    - name: Opening Balance
                      items: []
                      value: null
                      account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                    - name: Opening Balance Adjustments
                      items: []
                      value: null
                      account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                    - name: Owner's Equity
                      items: []
                      value: null
                      account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                    - name: Retained Earnings
                      items: []
                      value: null
                      account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                    - name: Dividends
                      items: []
                      value: null
                      account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                  value: '0'
                  account_id: null
                liabilities:
                  name: Liabilities
                  items:
                    - name: Accounts Payable
                      items: []
                      value: null
                      account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                    - name: Customer Credit
                      items: []
                      value: null
                      account_id: 41174cde-0a50-4504-8469-10299f7b5308
                    - name: Taxes Payable
                      items: []
                      value: null
                      account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                    - name: Income Tax Payable
                      items: []
                      value: null
                      account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                    - name: Property Tax Payable
                      items: []
                      value: null
                      account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                    - name: Accruals
                      items: []
                      value: null
                      account_id: f588b351-5c5f-4062-b18b-6903c8286057
                    - name: Accrued Payroll
                      items: []
                      value: null
                      account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                    - name: Accrued Rent
                      items: []
                      value: null
                      account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                    - name: Credit Cards
                      items: []
                      value: null
                      account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                    - name: Unearned Revenue
                      items: []
                      value: null
                      account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                  value: '0'
                  account_id: null
                meta:
                  note: Computed by Rutter
                created_at: '2024-02-13T22:06:15.183Z'
                updated_at: '2024-02-13T22:06:15.084Z'
                task_status: SUCCESS
              - id: 876ddf7e-a0e8-49fe-b4fc-39a9c1551ede
                business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                platform_id: 8
                external_id: edfc4e0f-5b8a-55ff-ab71-608b74dfe159
                start_date: '2023-01-01T00:00:00.000Z'
                end_date: '2023-01-31T00:00:00.000Z'
                currency: USD
                total_assets: '0'
                total_equity: '0'
                total_liabilities: '0'
                assets:
                  name: Assets
                  items:
                    - name: Cash & Bank
                      items:
                        - name: Cash
                          items: []
                          value: null
                          account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                        - name: Petty Cash
                          items: []
                          value: null
                          account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                      value: '0'
                      account_id: null
                    - name: Current Asset
                      items:
                        - name: Accounts Receivable
                          items: []
                          value: null
                          account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                        - name: Customer Deposits
                          items: []
                          value: null
                          account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                        - name: Deferred Discounts
                          items: []
                          value: null
                          account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                        - name: Deposits
                          items: []
                          value: null
                          account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                        - name: Prepaid Expenses
                          items: []
                          value: null
                          account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                      value: '0'
                      account_id: null
                    - name: Property, Plant, and Equipment
                      items:
                        - name: Furniture - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                        - name: Property, Plant, and Equipment
                          items: []
                          value: null
                          account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                        - name: Furniture
                          items: []
                          value: null
                          account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                        - name: Office Equipment
                          items: []
                          value: null
                          account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                        - name: Office Equipment - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: de710f63-acd8-48a2-aab1-6130b8069646
                      value: '0'
                      account_id: null
                  value: '0'
                  account_id: null
                equity:
                  name: Equity
                  items:
                    - name: Common Stock
                      items: []
                      value: null
                      account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                    - name: Opening Balance
                      items: []
                      value: null
                      account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                    - name: Opening Balance Adjustments
                      items: []
                      value: null
                      account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                    - name: Owner's Equity
                      items: []
                      value: null
                      account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                    - name: Retained Earnings
                      items: []
                      value: null
                      account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                    - name: Dividends
                      items: []
                      value: null
                      account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                  value: '0'
                  account_id: null
                liabilities:
                  name: Liabilities
                  items:
                    - name: Accounts Payable
                      items: []
                      value: null
                      account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                    - name: Customer Credit
                      items: []
                      value: null
                      account_id: 41174cde-0a50-4504-8469-10299f7b5308
                    - name: Taxes Payable
                      items: []
                      value: null
                      account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                    - name: Income Tax Payable
                      items: []
                      value: null
                      account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                    - name: Property Tax Payable
                      items: []
                      value: null
                      account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                    - name: Accruals
                      items: []
                      value: null
                      account_id: f588b351-5c5f-4062-b18b-6903c8286057
                    - name: Accrued Payroll
                      items: []
                      value: null
                      account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                    - name: Accrued Rent
                      items: []
                      value: null
                      account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                    - name: Credit Cards
                      items: []
                      value: null
                      account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                    - name: Unearned Revenue
                      items: []
                      value: null
                      account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                  value: '0'
                  account_id: null
                meta:
                  note: Computed by Rutter
                created_at: '2024-02-13T22:06:15.195Z'
                updated_at: '2024-02-13T22:06:15.079Z'
                task_status: SUCCESS
              - id: b744219b-7a29-42c6-b043-e773ae5e6a64
                business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                platform_id: 8
                external_id: eb5b803a-15f8-5712-bd0d-b5e931488999
                start_date: '2022-12-01T00:00:00.000Z'
                end_date: '2022-12-31T00:00:00.000Z'
                currency: USD
                total_assets: '0'
                total_equity: '0'
                total_liabilities: '0'
                assets:
                  name: Assets
                  items:
                    - name: Cash & Bank
                      items:
                        - name: Cash
                          items: []
                          value: null
                          account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                        - name: Petty Cash
                          items: []
                          value: null
                          account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                      value: '0'
                      account_id: null
                    - name: Current Asset
                      items:
                        - name: Accounts Receivable
                          items: []
                          value: null
                          account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                        - name: Customer Deposits
                          items: []
                          value: null
                          account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                        - name: Deferred Discounts
                          items: []
                          value: null
                          account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                        - name: Deposits
                          items: []
                          value: null
                          account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                        - name: Prepaid Expenses
                          items: []
                          value: null
                          account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                      value: '0'
                      account_id: null
                    - name: Property, Plant, and Equipment
                      items:
                        - name: Furniture - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                        - name: Property, Plant, and Equipment
                          items: []
                          value: null
                          account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                        - name: Furniture
                          items: []
                          value: null
                          account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                        - name: Office Equipment
                          items: []
                          value: null
                          account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                        - name: Office Equipment - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: de710f63-acd8-48a2-aab1-6130b8069646
                      value: '0'
                      account_id: null
                  value: '0'
                  account_id: null
                equity:
                  name: Equity
                  items:
                    - name: Common Stock
                      items: []
                      value: null
                      account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                    - name: Opening Balance
                      items: []
                      value: null
                      account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                    - name: Opening Balance Adjustments
                      items: []
                      value: null
                      account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                    - name: Owner's Equity
                      items: []
                      value: null
                      account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                    - name: Retained Earnings
                      items: []
                      value: null
                      account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                    - name: Dividends
                      items: []
                      value: null
                      account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                  value: '0'
                  account_id: null
                liabilities:
                  name: Liabilities
                  items:
                    - name: Accounts Payable
                      items: []
                      value: null
                      account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                    - name: Customer Credit
                      items: []
                      value: null
                      account_id: 41174cde-0a50-4504-8469-10299f7b5308
                    - name: Taxes Payable
                      items: []
                      value: null
                      account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                    - name: Income Tax Payable
                      items: []
                      value: null
                      account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                    - name: Property Tax Payable
                      items: []
                      value: null
                      account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                    - name: Accruals
                      items: []
                      value: null
                      account_id: f588b351-5c5f-4062-b18b-6903c8286057
                    - name: Accrued Payroll
                      items: []
                      value: null
                      account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                    - name: Accrued Rent
                      items: []
                      value: null
                      account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                    - name: Credit Cards
                      items: []
                      value: null
                      account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                    - name: Unearned Revenue
                      items: []
                      value: null
                      account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                  value: '0'
                  account_id: null
                meta:
                  note: Computed by Rutter
                created_at: '2024-02-13T22:06:15.197Z'
                updated_at: '2024-02-13T22:06:15.075Z'
                task_status: SUCCESS
              - id: 9ccf4961-0416-403e-bee3-626a02063e66
                business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                platform_id: 8
                external_id: 947dd708-0ee4-54fb-9a87-abe2fb30e64f
                start_date: '2022-11-01T00:00:00.000Z'
                end_date: '2022-11-30T00:00:00.000Z'
                currency: USD
                total_assets: '0'
                total_equity: '0'
                total_liabilities: '0'
                assets:
                  name: Assets
                  items:
                    - name: Cash & Bank
                      items:
                        - name: Cash
                          items: []
                          value: null
                          account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                        - name: Petty Cash
                          items: []
                          value: null
                          account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                      value: '0'
                      account_id: null
                    - name: Current Asset
                      items:
                        - name: Accounts Receivable
                          items: []
                          value: null
                          account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                        - name: Customer Deposits
                          items: []
                          value: null
                          account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                        - name: Deferred Discounts
                          items: []
                          value: null
                          account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                        - name: Deposits
                          items: []
                          value: null
                          account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                        - name: Prepaid Expenses
                          items: []
                          value: null
                          account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                      value: '0'
                      account_id: null
                    - name: Property, Plant, and Equipment
                      items:
                        - name: Furniture - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                        - name: Property, Plant, and Equipment
                          items: []
                          value: null
                          account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                        - name: Furniture
                          items: []
                          value: null
                          account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                        - name: Office Equipment
                          items: []
                          value: null
                          account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                        - name: Office Equipment - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: de710f63-acd8-48a2-aab1-6130b8069646
                      value: '0'
                      account_id: null
                  value: '0'
                  account_id: null
                equity:
                  name: Equity
                  items:
                    - name: Common Stock
                      items: []
                      value: null
                      account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                    - name: Opening Balance
                      items: []
                      value: null
                      account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                    - name: Opening Balance Adjustments
                      items: []
                      value: null
                      account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                    - name: Owner's Equity
                      items: []
                      value: null
                      account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                    - name: Retained Earnings
                      items: []
                      value: null
                      account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                    - name: Dividends
                      items: []
                      value: null
                      account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                  value: '0'
                  account_id: null
                liabilities:
                  name: Liabilities
                  items:
                    - name: Accounts Payable
                      items: []
                      value: null
                      account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                    - name: Customer Credit
                      items: []
                      value: null
                      account_id: 41174cde-0a50-4504-8469-10299f7b5308
                    - name: Taxes Payable
                      items: []
                      value: null
                      account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                    - name: Income Tax Payable
                      items: []
                      value: null
                      account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                    - name: Property Tax Payable
                      items: []
                      value: null
                      account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                    - name: Accruals
                      items: []
                      value: null
                      account_id: f588b351-5c5f-4062-b18b-6903c8286057
                    - name: Accrued Payroll
                      items: []
                      value: null
                      account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                    - name: Accrued Rent
                      items: []
                      value: null
                      account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                    - name: Credit Cards
                      items: []
                      value: null
                      account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                    - name: Unearned Revenue
                      items: []
                      value: null
                      account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                  value: '0'
                  account_id: null
                meta:
                  note: Computed by Rutter
                created_at: '2024-02-13T22:06:15.199Z'
                updated_at: '2024-02-13T22:06:15.070Z'
                task_status: SUCCESS
              - id: f5832348-b350-40eb-b84d-86f2fa5480b4
                business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                platform_id: 8
                external_id: 05eadcf6-5a8e-553f-854e-7c2f93e0fd02
                start_date: '2022-10-01T00:00:00.000Z'
                end_date: '2022-10-31T00:00:00.000Z'
                currency: USD
                total_assets: '0'
                total_equity: '0'
                total_liabilities: '0'
                assets:
                  name: Assets
                  items:
                    - name: Cash & Bank
                      items:
                        - name: Cash
                          items: []
                          value: null
                          account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                        - name: Petty Cash
                          items: []
                          value: null
                          account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                      value: '0'
                      account_id: null
                    - name: Current Asset
                      items:
                        - name: Accounts Receivable
                          items: []
                          value: null
                          account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                        - name: Customer Deposits
                          items: []
                          value: null
                          account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                        - name: Deferred Discounts
                          items: []
                          value: null
                          account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                        - name: Deposits
                          items: []
                          value: null
                          account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                        - name: Prepaid Expenses
                          items: []
                          value: null
                          account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                      value: '0'
                      account_id: null
                    - name: Property, Plant, and Equipment
                      items:
                        - name: Furniture - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                        - name: Property, Plant, and Equipment
                          items: []
                          value: null
                          account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                        - name: Furniture
                          items: []
                          value: null
                          account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                        - name: Office Equipment
                          items: []
                          value: null
                          account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                        - name: Office Equipment - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: de710f63-acd8-48a2-aab1-6130b8069646
                      value: '0'
                      account_id: null
                  value: '0'
                  account_id: null
                equity:
                  name: Equity
                  items:
                    - name: Common Stock
                      items: []
                      value: null
                      account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                    - name: Opening Balance
                      items: []
                      value: null
                      account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                    - name: Opening Balance Adjustments
                      items: []
                      value: null
                      account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                    - name: Owner's Equity
                      items: []
                      value: null
                      account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                    - name: Retained Earnings
                      items: []
                      value: null
                      account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                    - name: Dividends
                      items: []
                      value: null
                      account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                  value: '0'
                  account_id: null
                liabilities:
                  name: Liabilities
                  items:
                    - name: Accounts Payable
                      items: []
                      value: null
                      account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                    - name: Customer Credit
                      items: []
                      value: null
                      account_id: 41174cde-0a50-4504-8469-10299f7b5308
                    - name: Taxes Payable
                      items: []
                      value: null
                      account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                    - name: Income Tax Payable
                      items: []
                      value: null
                      account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                    - name: Property Tax Payable
                      items: []
                      value: null
                      account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                    - name: Accruals
                      items: []
                      value: null
                      account_id: f588b351-5c5f-4062-b18b-6903c8286057
                    - name: Accrued Payroll
                      items: []
                      value: null
                      account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                    - name: Accrued Rent
                      items: []
                      value: null
                      account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                    - name: Credit Cards
                      items: []
                      value: null
                      account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                    - name: Unearned Revenue
                      items: []
                      value: null
                      account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                  value: '0'
                  account_id: null
                meta:
                  note: Computed by Rutter
                created_at: '2024-02-13T22:06:15.202Z'
                updated_at: '2024-02-13T22:06:15.063Z'
                task_status: SUCCESS
              - id: 4161652b-6e0d-413c-91cd-1598e7a19f82
                business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                platform_id: 8
                external_id: 0a5bab96-ba8f-55c9-be9d-ab9021dd9af6
                start_date: '2022-09-01T00:00:00.000Z'
                end_date: '2022-09-30T00:00:00.000Z'
                currency: USD
                total_assets: '0'
                total_equity: '0'
                total_liabilities: '0'
                assets:
                  name: Assets
                  items:
                    - name: Cash & Bank
                      items:
                        - name: Cash
                          items: []
                          value: null
                          account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                        - name: Petty Cash
                          items: []
                          value: null
                          account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                      value: '0'
                      account_id: null
                    - name: Current Asset
                      items:
                        - name: Accounts Receivable
                          items: []
                          value: null
                          account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                        - name: Customer Deposits
                          items: []
                          value: null
                          account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                        - name: Deferred Discounts
                          items: []
                          value: null
                          account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                        - name: Deposits
                          items: []
                          value: null
                          account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                        - name: Prepaid Expenses
                          items: []
                          value: null
                          account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                      value: '0'
                      account_id: null
                    - name: Property, Plant, and Equipment
                      items:
                        - name: Furniture - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                        - name: Property, Plant, and Equipment
                          items: []
                          value: null
                          account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                        - name: Furniture
                          items: []
                          value: null
                          account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                        - name: Office Equipment
                          items: []
                          value: null
                          account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                        - name: Office Equipment - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: de710f63-acd8-48a2-aab1-6130b8069646
                      value: '0'
                      account_id: null
                  value: '0'
                  account_id: null
                equity:
                  name: Equity
                  items:
                    - name: Common Stock
                      items: []
                      value: null
                      account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                    - name: Opening Balance
                      items: []
                      value: null
                      account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                    - name: Opening Balance Adjustments
                      items: []
                      value: null
                      account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                    - name: Owner's Equity
                      items: []
                      value: null
                      account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                    - name: Retained Earnings
                      items: []
                      value: null
                      account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                    - name: Dividends
                      items: []
                      value: null
                      account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                  value: '0'
                  account_id: null
                liabilities:
                  name: Liabilities
                  items:
                    - name: Accounts Payable
                      items: []
                      value: null
                      account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                    - name: Customer Credit
                      items: []
                      value: null
                      account_id: 41174cde-0a50-4504-8469-10299f7b5308
                    - name: Taxes Payable
                      items: []
                      value: null
                      account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                    - name: Income Tax Payable
                      items: []
                      value: null
                      account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                    - name: Property Tax Payable
                      items: []
                      value: null
                      account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                    - name: Accruals
                      items: []
                      value: null
                      account_id: f588b351-5c5f-4062-b18b-6903c8286057
                    - name: Accrued Payroll
                      items: []
                      value: null
                      account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                    - name: Accrued Rent
                      items: []
                      value: null
                      account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                    - name: Credit Cards
                      items: []
                      value: null
                      account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                    - name: Unearned Revenue
                      items: []
                      value: null
                      account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                  value: '0'
                  account_id: null
                meta:
                  note: Computed by Rutter
                created_at: '2024-02-13T22:06:15.204Z'
                updated_at: '2024-02-13T22:06:15.057Z'
                task_status: SUCCESS
              - id: ab36a33d-5e5e-4b88-8fab-9490350d3f63
                business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                platform_id: 8
                external_id: 173355db-05a1-53ca-9533-f39956ee00a9
                start_date: '2022-08-01T00:00:00.000Z'
                end_date: '2022-08-31T00:00:00.000Z'
                currency: USD
                total_assets: '0'
                total_equity: '0'
                total_liabilities: '0'
                assets:
                  name: Assets
                  items:
                    - name: Cash & Bank
                      items:
                        - name: Cash
                          items: []
                          value: null
                          account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                        - name: Petty Cash
                          items: []
                          value: null
                          account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                      value: '0'
                      account_id: null
                    - name: Current Asset
                      items:
                        - name: Accounts Receivable
                          items: []
                          value: null
                          account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                        - name: Customer Deposits
                          items: []
                          value: null
                          account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                        - name: Deferred Discounts
                          items: []
                          value: null
                          account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                        - name: Deposits
                          items: []
                          value: null
                          account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                        - name: Prepaid Expenses
                          items: []
                          value: null
                          account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                      value: '0'
                      account_id: null
                    - name: Property, Plant, and Equipment
                      items:
                        - name: Furniture - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                        - name: Property, Plant, and Equipment
                          items: []
                          value: null
                          account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                        - name: Furniture
                          items: []
                          value: null
                          account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                        - name: Office Equipment
                          items: []
                          value: null
                          account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                        - name: Office Equipment - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: de710f63-acd8-48a2-aab1-6130b8069646
                      value: '0'
                      account_id: null
                  value: '0'
                  account_id: null
                equity:
                  name: Equity
                  items:
                    - name: Common Stock
                      items: []
                      value: null
                      account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                    - name: Opening Balance
                      items: []
                      value: null
                      account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                    - name: Opening Balance Adjustments
                      items: []
                      value: null
                      account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                    - name: Owner's Equity
                      items: []
                      value: null
                      account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                    - name: Retained Earnings
                      items: []
                      value: null
                      account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                    - name: Dividends
                      items: []
                      value: null
                      account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                  value: '0'
                  account_id: null
                liabilities:
                  name: Liabilities
                  items:
                    - name: Accounts Payable
                      items: []
                      value: null
                      account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                    - name: Customer Credit
                      items: []
                      value: null
                      account_id: 41174cde-0a50-4504-8469-10299f7b5308
                    - name: Taxes Payable
                      items: []
                      value: null
                      account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                    - name: Income Tax Payable
                      items: []
                      value: null
                      account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                    - name: Property Tax Payable
                      items: []
                      value: null
                      account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                    - name: Accruals
                      items: []
                      value: null
                      account_id: f588b351-5c5f-4062-b18b-6903c8286057
                    - name: Accrued Payroll
                      items: []
                      value: null
                      account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                    - name: Accrued Rent
                      items: []
                      value: null
                      account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                    - name: Credit Cards
                      items: []
                      value: null
                      account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                    - name: Unearned Revenue
                      items: []
                      value: null
                      account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                  value: '0'
                  account_id: null
                meta:
                  note: Computed by Rutter
                created_at: '2024-02-13T22:06:15.206Z'
                updated_at: '2024-02-13T22:06:15.053Z'
                task_status: SUCCESS
              - id: 1d9eef16-eda3-4ecb-93a0-effcd9cceb34
                business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
                business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                platform_id: 8
                external_id: 47c1c5b5-101d-5fc3-b4ab-b72d4607791e
                start_date: '2022-07-01T00:00:00.000Z'
                end_date: '2022-07-31T00:00:00.000Z'
                currency: USD
                total_assets: '0'
                total_equity: '0'
                total_liabilities: '0'
                assets:
                  name: Assets
                  items:
                    - name: Cash & Bank
                      items:
                        - name: Cash
                          items: []
                          value: null
                          account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                        - name: Petty Cash
                          items: []
                          value: null
                          account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                      value: '0'
                      account_id: null
                    - name: Current Asset
                      items:
                        - name: Accounts Receivable
                          items: []
                          value: null
                          account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                        - name: Customer Deposits
                          items: []
                          value: null
                          account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                        - name: Deferred Discounts
                          items: []
                          value: null
                          account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                        - name: Deposits
                          items: []
                          value: null
                          account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                        - name: Prepaid Expenses
                          items: []
                          value: null
                          account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                      value: '0'
                      account_id: null
                    - name: Property, Plant, and Equipment
                      items:
                        - name: Furniture - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                        - name: Property, Plant, and Equipment
                          items: []
                          value: null
                          account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                        - name: Furniture
                          items: []
                          value: null
                          account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                        - name: Office Equipment
                          items: []
                          value: null
                          account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                        - name: Office Equipment - Accumulated Depreciation
                          items: []
                          value: null
                          account_id: de710f63-acd8-48a2-aab1-6130b8069646
                      value: '0'
                      account_id: null
                  value: '0'
                  account_id: null
                equity:
                  name: Equity
                  items:
                    - name: Common Stock
                      items: []
                      value: null
                      account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                    - name: Opening Balance
                      items: []
                      value: null
                      account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                    - name: Opening Balance Adjustments
                      items: []
                      value: null
                      account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                    - name: Owner's Equity
                      items: []
                      value: null
                      account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                    - name: Retained Earnings
                      items: []
                      value: null
                      account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                    - name: Dividends
                      items: []
                      value: null
                      account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                  value: '0'
                  account_id: null
                liabilities:
                  name: Liabilities
                  items:
                    - name: Accounts Payable
                      items: []
                      value: null
                      account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                    - name: Customer Credit
                      items: []
                      value: null
                      account_id: 41174cde-0a50-4504-8469-10299f7b5308
                    - name: Taxes Payable
                      items: []
                      value: null
                      account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                    - name: Income Tax Payable
                      items: []
                      value: null
                      account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                    - name: Property Tax Payable
                      items: []
                      value: null
                      account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                    - name: Accruals
                      items: []
                      value: null
                      account_id: f588b351-5c5f-4062-b18b-6903c8286057
                    - name: Accrued Payroll
                      items: []
                      value: null
                      account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                    - name: Accrued Rent
                      items: []
                      value: null
                      account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                    - name: Credit Cards
                      items: []
                      value: null
                      account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                    - name: Unearned Revenue
                      items: []
                      value: null
                      account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                  value: '0'
                  account_id: null
                meta:
                  note: Computed by Rutter
                created_at: '2024-02-13T22:06:15.208Z'
                updated_at: '2024-02-13T22:06:15.048Z'
                task_status: SUCCESS
            total: '63'
    Data13:
      title: Data13
      type: object
      properties:
        count:
          type: integer
          contentEncoding: int32
        page:
          type: integer
          contentEncoding: int32
        accounting_balancesheet:
          type: array
          items:
            $ref: '#/components/schemas/AccountingBalancesheet'
          description: ''
        total:
          type: string
      examples:
        - count: 20
          page: 1
          accounting_balancesheet:
            - id: 837a9495-986a-4cae-b5c1-937da7d2c68f
              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
              platform_id: 8
              external_id: f6c14930-8ec2-5570-ace6-aa22d5feb47d
              start_date: '2024-02-01T00:00:00.000Z'
              end_date: '2024-02-29T00:00:00.000Z'
              currency: USD
              total_assets: '0'
              total_equity: '0'
              total_liabilities: '0'
              assets:
                name: Assets
                items:
                  - name: Cash & Bank
                    items:
                      - name: Cash
                        items: []
                        value: null
                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                      - name: Petty Cash
                        items: []
                        value: null
                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                    value: '0'
                    account_id: null
                  - name: Current Asset
                    items:
                      - name: Accounts Receivable
                        items: []
                        value: null
                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                      - name: Customer Deposits
                        items: []
                        value: null
                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                      - name: Deferred Discounts
                        items: []
                        value: null
                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                      - name: Deposits
                        items: []
                        value: null
                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                      - name: Prepaid Expenses
                        items: []
                        value: null
                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                    value: '0'
                    account_id: null
                  - name: Property, Plant, and Equipment
                    items:
                      - name: Furniture - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                      - name: Property, Plant, and Equipment
                        items: []
                        value: null
                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                      - name: Furniture
                        items: []
                        value: null
                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                      - name: Office Equipment
                        items: []
                        value: null
                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                      - name: Office Equipment - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                    value: '0'
                    account_id: null
                value: '0'
                account_id: null
              equity:
                name: Equity
                items:
                  - name: Common Stock
                    items: []
                    value: null
                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                  - name: Opening Balance
                    items: []
                    value: null
                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                  - name: Opening Balance Adjustments
                    items: []
                    value: null
                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                  - name: Owner's Equity
                    items: []
                    value: null
                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                  - name: Retained Earnings
                    items: []
                    value: null
                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                  - name: Dividends
                    items: []
                    value: null
                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                value: '0'
                account_id: null
              liabilities:
                name: Liabilities
                items:
                  - name: Accounts Payable
                    items: []
                    value: null
                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                  - name: Customer Credit
                    items: []
                    value: null
                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                  - name: Taxes Payable
                    items: []
                    value: null
                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                  - name: Income Tax Payable
                    items: []
                    value: null
                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                  - name: Property Tax Payable
                    items: []
                    value: null
                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                  - name: Accruals
                    items: []
                    value: null
                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                  - name: Accrued Payroll
                    items: []
                    value: null
                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                  - name: Accrued Rent
                    items: []
                    value: null
                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                  - name: Credit Cards
                    items: []
                    value: null
                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                  - name: Unearned Revenue
                    items: []
                    value: null
                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                value: '0'
                account_id: null
              meta:
                note: Computed by Rutter
              created_at: '2024-02-13T22:06:15.154Z'
              updated_at: '2024-02-13T22:06:15.137Z'
              task_status: SUCCESS
            - id: 8a50526a-a008-45bb-be08-b1086e7c1ac7
              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
              platform_id: 8
              external_id: bec3592b-1450-55bc-85b3-5713aeb143c5
              start_date: '2024-01-01T00:00:00.000Z'
              end_date: '2024-01-31T00:00:00.000Z'
              currency: USD
              total_assets: '0'
              total_equity: '0'
              total_liabilities: '0'
              assets:
                name: Assets
                items:
                  - name: Cash & Bank
                    items:
                      - name: Cash
                        items: []
                        value: null
                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                      - name: Petty Cash
                        items: []
                        value: null
                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                    value: '0'
                    account_id: null
                  - name: Current Asset
                    items:
                      - name: Accounts Receivable
                        items: []
                        value: null
                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                      - name: Customer Deposits
                        items: []
                        value: null
                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                      - name: Deferred Discounts
                        items: []
                        value: null
                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                      - name: Deposits
                        items: []
                        value: null
                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                      - name: Prepaid Expenses
                        items: []
                        value: null
                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                    value: '0'
                    account_id: null
                  - name: Property, Plant, and Equipment
                    items:
                      - name: Furniture - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                      - name: Property, Plant, and Equipment
                        items: []
                        value: null
                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                      - name: Furniture
                        items: []
                        value: null
                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                      - name: Office Equipment
                        items: []
                        value: null
                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                      - name: Office Equipment - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                    value: '0'
                    account_id: null
                value: '0'
                account_id: null
              equity:
                name: Equity
                items:
                  - name: Common Stock
                    items: []
                    value: null
                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                  - name: Opening Balance
                    items: []
                    value: null
                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                  - name: Opening Balance Adjustments
                    items: []
                    value: null
                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                  - name: Owner's Equity
                    items: []
                    value: null
                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                  - name: Retained Earnings
                    items: []
                    value: null
                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                  - name: Dividends
                    items: []
                    value: null
                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                value: '0'
                account_id: null
              liabilities:
                name: Liabilities
                items:
                  - name: Accounts Payable
                    items: []
                    value: null
                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                  - name: Customer Credit
                    items: []
                    value: null
                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                  - name: Taxes Payable
                    items: []
                    value: null
                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                  - name: Income Tax Payable
                    items: []
                    value: null
                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                  - name: Property Tax Payable
                    items: []
                    value: null
                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                  - name: Accruals
                    items: []
                    value: null
                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                  - name: Accrued Payroll
                    items: []
                    value: null
                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                  - name: Accrued Rent
                    items: []
                    value: null
                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                  - name: Credit Cards
                    items: []
                    value: null
                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                  - name: Unearned Revenue
                    items: []
                    value: null
                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                value: '0'
                account_id: null
              meta:
                note: Computed by Rutter
              created_at: '2024-02-13T22:06:15.159Z'
              updated_at: '2024-02-13T22:06:15.133Z'
              task_status: SUCCESS
            - id: 470c45a4-6a99-4cec-a590-6b919e4ad877
              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
              platform_id: 8
              external_id: 7d697f90-3edb-5db9-a5b5-bb25ab510cc8
              start_date: '2023-12-01T00:00:00.000Z'
              end_date: '2023-12-31T00:00:00.000Z'
              currency: USD
              total_assets: '0'
              total_equity: '0'
              total_liabilities: '0'
              assets:
                name: Assets
                items:
                  - name: Cash & Bank
                    items:
                      - name: Cash
                        items: []
                        value: null
                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                      - name: Petty Cash
                        items: []
                        value: null
                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                    value: '0'
                    account_id: null
                  - name: Current Asset
                    items:
                      - name: Accounts Receivable
                        items: []
                        value: null
                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                      - name: Customer Deposits
                        items: []
                        value: null
                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                      - name: Deferred Discounts
                        items: []
                        value: null
                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                      - name: Deposits
                        items: []
                        value: null
                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                      - name: Prepaid Expenses
                        items: []
                        value: null
                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                    value: '0'
                    account_id: null
                  - name: Property, Plant, and Equipment
                    items:
                      - name: Furniture - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                      - name: Property, Plant, and Equipment
                        items: []
                        value: null
                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                      - name: Furniture
                        items: []
                        value: null
                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                      - name: Office Equipment
                        items: []
                        value: null
                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                      - name: Office Equipment - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                    value: '0'
                    account_id: null
                value: '0'
                account_id: null
              equity:
                name: Equity
                items:
                  - name: Common Stock
                    items: []
                    value: null
                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                  - name: Opening Balance
                    items: []
                    value: null
                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                  - name: Opening Balance Adjustments
                    items: []
                    value: null
                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                  - name: Owner's Equity
                    items: []
                    value: null
                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                  - name: Retained Earnings
                    items: []
                    value: null
                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                  - name: Dividends
                    items: []
                    value: null
                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                value: '0'
                account_id: null
              liabilities:
                name: Liabilities
                items:
                  - name: Accounts Payable
                    items: []
                    value: null
                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                  - name: Customer Credit
                    items: []
                    value: null
                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                  - name: Taxes Payable
                    items: []
                    value: null
                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                  - name: Income Tax Payable
                    items: []
                    value: null
                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                  - name: Property Tax Payable
                    items: []
                    value: null
                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                  - name: Accruals
                    items: []
                    value: null
                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                  - name: Accrued Payroll
                    items: []
                    value: null
                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                  - name: Accrued Rent
                    items: []
                    value: null
                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                  - name: Credit Cards
                    items: []
                    value: null
                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                  - name: Unearned Revenue
                    items: []
                    value: null
                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                value: '0'
                account_id: null
              meta:
                note: Computed by Rutter
              created_at: '2024-02-13T22:06:15.161Z'
              updated_at: '2024-02-13T22:06:15.129Z'
              task_status: SUCCESS
            - id: 83958e6f-4e56-47fa-9b8b-62267c77a9b5
              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
              platform_id: 8
              external_id: 231f6533-bb17-58f0-85f3-ceeb072bfed9
              start_date: '2023-11-01T00:00:00.000Z'
              end_date: '2023-11-30T00:00:00.000Z'
              currency: USD
              total_assets: '0'
              total_equity: '0'
              total_liabilities: '0'
              assets:
                name: Assets
                items:
                  - name: Cash & Bank
                    items:
                      - name: Cash
                        items: []
                        value: null
                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                      - name: Petty Cash
                        items: []
                        value: null
                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                    value: '0'
                    account_id: null
                  - name: Current Asset
                    items:
                      - name: Accounts Receivable
                        items: []
                        value: null
                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                      - name: Customer Deposits
                        items: []
                        value: null
                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                      - name: Deferred Discounts
                        items: []
                        value: null
                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                      - name: Deposits
                        items: []
                        value: null
                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                      - name: Prepaid Expenses
                        items: []
                        value: null
                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                    value: '0'
                    account_id: null
                  - name: Property, Plant, and Equipment
                    items:
                      - name: Furniture - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                      - name: Property, Plant, and Equipment
                        items: []
                        value: null
                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                      - name: Furniture
                        items: []
                        value: null
                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                      - name: Office Equipment
                        items: []
                        value: null
                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                      - name: Office Equipment - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                    value: '0'
                    account_id: null
                value: '0'
                account_id: null
              equity:
                name: Equity
                items:
                  - name: Common Stock
                    items: []
                    value: null
                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                  - name: Opening Balance
                    items: []
                    value: null
                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                  - name: Opening Balance Adjustments
                    items: []
                    value: null
                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                  - name: Owner's Equity
                    items: []
                    value: null
                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                  - name: Retained Earnings
                    items: []
                    value: null
                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                  - name: Dividends
                    items: []
                    value: null
                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                value: '0'
                account_id: null
              liabilities:
                name: Liabilities
                items:
                  - name: Accounts Payable
                    items: []
                    value: null
                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                  - name: Customer Credit
                    items: []
                    value: null
                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                  - name: Taxes Payable
                    items: []
                    value: null
                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                  - name: Income Tax Payable
                    items: []
                    value: null
                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                  - name: Property Tax Payable
                    items: []
                    value: null
                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                  - name: Accruals
                    items: []
                    value: null
                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                  - name: Accrued Payroll
                    items: []
                    value: null
                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                  - name: Accrued Rent
                    items: []
                    value: null
                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                  - name: Credit Cards
                    items: []
                    value: null
                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                  - name: Unearned Revenue
                    items: []
                    value: null
                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                value: '0'
                account_id: null
              meta:
                note: Computed by Rutter
              created_at: '2024-02-13T22:06:15.164Z'
              updated_at: '2024-02-13T22:06:15.127Z'
              task_status: SUCCESS
            - id: c3f64d61-da65-4c86-8ede-27570293e7ee
              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
              platform_id: 8
              external_id: 9e6880ad-dfb9-5520-9f7e-63abe67417e8
              start_date: '2023-10-01T00:00:00.000Z'
              end_date: '2023-10-31T00:00:00.000Z'
              currency: USD
              total_assets: '0'
              total_equity: '0'
              total_liabilities: '0'
              assets:
                name: Assets
                items:
                  - name: Cash & Bank
                    items:
                      - name: Cash
                        items: []
                        value: null
                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                      - name: Petty Cash
                        items: []
                        value: null
                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                    value: '0'
                    account_id: null
                  - name: Current Asset
                    items:
                      - name: Accounts Receivable
                        items: []
                        value: null
                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                      - name: Customer Deposits
                        items: []
                        value: null
                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                      - name: Deferred Discounts
                        items: []
                        value: null
                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                      - name: Deposits
                        items: []
                        value: null
                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                      - name: Prepaid Expenses
                        items: []
                        value: null
                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                    value: '0'
                    account_id: null
                  - name: Property, Plant, and Equipment
                    items:
                      - name: Furniture - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                      - name: Property, Plant, and Equipment
                        items: []
                        value: null
                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                      - name: Furniture
                        items: []
                        value: null
                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                      - name: Office Equipment
                        items: []
                        value: null
                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                      - name: Office Equipment - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                    value: '0'
                    account_id: null
                value: '0'
                account_id: null
              equity:
                name: Equity
                items:
                  - name: Common Stock
                    items: []
                    value: null
                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                  - name: Opening Balance
                    items: []
                    value: null
                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                  - name: Opening Balance Adjustments
                    items: []
                    value: null
                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                  - name: Owner's Equity
                    items: []
                    value: null
                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                  - name: Retained Earnings
                    items: []
                    value: null
                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                  - name: Dividends
                    items: []
                    value: null
                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                value: '0'
                account_id: null
              liabilities:
                name: Liabilities
                items:
                  - name: Accounts Payable
                    items: []
                    value: null
                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                  - name: Customer Credit
                    items: []
                    value: null
                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                  - name: Taxes Payable
                    items: []
                    value: null
                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                  - name: Income Tax Payable
                    items: []
                    value: null
                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                  - name: Property Tax Payable
                    items: []
                    value: null
                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                  - name: Accruals
                    items: []
                    value: null
                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                  - name: Accrued Payroll
                    items: []
                    value: null
                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                  - name: Accrued Rent
                    items: []
                    value: null
                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                  - name: Credit Cards
                    items: []
                    value: null
                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                  - name: Unearned Revenue
                    items: []
                    value: null
                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                value: '0'
                account_id: null
              meta:
                note: Computed by Rutter
              created_at: '2024-02-13T22:06:15.166Z'
              updated_at: '2024-02-13T22:06:15.120Z'
              task_status: SUCCESS
            - id: 08f37ff7-adef-4e37-a397-f4a5e7aca2a5
              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
              platform_id: 8
              external_id: a2b548af-9a1b-5235-bbe6-9ea65c5bc20b
              start_date: '2023-09-01T00:00:00.000Z'
              end_date: '2023-09-30T00:00:00.000Z'
              currency: USD
              total_assets: '0'
              total_equity: '0'
              total_liabilities: '0'
              assets:
                name: Assets
                items:
                  - name: Cash & Bank
                    items:
                      - name: Cash
                        items: []
                        value: null
                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                      - name: Petty Cash
                        items: []
                        value: null
                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                    value: '0'
                    account_id: null
                  - name: Current Asset
                    items:
                      - name: Accounts Receivable
                        items: []
                        value: null
                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                      - name: Customer Deposits
                        items: []
                        value: null
                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                      - name: Deferred Discounts
                        items: []
                        value: null
                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                      - name: Deposits
                        items: []
                        value: null
                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                      - name: Prepaid Expenses
                        items: []
                        value: null
                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                    value: '0'
                    account_id: null
                  - name: Property, Plant, and Equipment
                    items:
                      - name: Furniture - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                      - name: Property, Plant, and Equipment
                        items: []
                        value: null
                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                      - name: Furniture
                        items: []
                        value: null
                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                      - name: Office Equipment
                        items: []
                        value: null
                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                      - name: Office Equipment - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                    value: '0'
                    account_id: null
                value: '0'
                account_id: null
              equity:
                name: Equity
                items:
                  - name: Common Stock
                    items: []
                    value: null
                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                  - name: Opening Balance
                    items: []
                    value: null
                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                  - name: Opening Balance Adjustments
                    items: []
                    value: null
                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                  - name: Owner's Equity
                    items: []
                    value: null
                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                  - name: Retained Earnings
                    items: []
                    value: null
                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                  - name: Dividends
                    items: []
                    value: null
                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                value: '0'
                account_id: null
              liabilities:
                name: Liabilities
                items:
                  - name: Accounts Payable
                    items: []
                    value: null
                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                  - name: Customer Credit
                    items: []
                    value: null
                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                  - name: Taxes Payable
                    items: []
                    value: null
                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                  - name: Income Tax Payable
                    items: []
                    value: null
                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                  - name: Property Tax Payable
                    items: []
                    value: null
                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                  - name: Accruals
                    items: []
                    value: null
                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                  - name: Accrued Payroll
                    items: []
                    value: null
                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                  - name: Accrued Rent
                    items: []
                    value: null
                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                  - name: Credit Cards
                    items: []
                    value: null
                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                  - name: Unearned Revenue
                    items: []
                    value: null
                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                value: '0'
                account_id: null
              meta:
                note: Computed by Rutter
              created_at: '2024-02-13T22:06:15.168Z'
              updated_at: '2024-02-13T22:06:15.115Z'
              task_status: SUCCESS
            - id: 8a343105-994b-4730-b754-33e940a4506c
              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
              platform_id: 8
              external_id: 344c4b2f-9ec1-5591-aa91-11ac2f87a221
              start_date: '2023-08-01T00:00:00.000Z'
              end_date: '2023-08-31T00:00:00.000Z'
              currency: USD
              total_assets: '0'
              total_equity: '0'
              total_liabilities: '0'
              assets:
                name: Assets
                items:
                  - name: Cash & Bank
                    items:
                      - name: Cash
                        items: []
                        value: null
                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                      - name: Petty Cash
                        items: []
                        value: null
                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                    value: '0'
                    account_id: null
                  - name: Current Asset
                    items:
                      - name: Accounts Receivable
                        items: []
                        value: null
                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                      - name: Customer Deposits
                        items: []
                        value: null
                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                      - name: Deferred Discounts
                        items: []
                        value: null
                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                      - name: Deposits
                        items: []
                        value: null
                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                      - name: Prepaid Expenses
                        items: []
                        value: null
                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                    value: '0'
                    account_id: null
                  - name: Property, Plant, and Equipment
                    items:
                      - name: Furniture - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                      - name: Property, Plant, and Equipment
                        items: []
                        value: null
                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                      - name: Furniture
                        items: []
                        value: null
                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                      - name: Office Equipment
                        items: []
                        value: null
                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                      - name: Office Equipment - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                    value: '0'
                    account_id: null
                value: '0'
                account_id: null
              equity:
                name: Equity
                items:
                  - name: Common Stock
                    items: []
                    value: null
                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                  - name: Opening Balance
                    items: []
                    value: null
                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                  - name: Opening Balance Adjustments
                    items: []
                    value: null
                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                  - name: Owner's Equity
                    items: []
                    value: null
                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                  - name: Retained Earnings
                    items: []
                    value: null
                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                  - name: Dividends
                    items: []
                    value: null
                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                value: '0'
                account_id: null
              liabilities:
                name: Liabilities
                items:
                  - name: Accounts Payable
                    items: []
                    value: null
                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                  - name: Customer Credit
                    items: []
                    value: null
                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                  - name: Taxes Payable
                    items: []
                    value: null
                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                  - name: Income Tax Payable
                    items: []
                    value: null
                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                  - name: Property Tax Payable
                    items: []
                    value: null
                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                  - name: Accruals
                    items: []
                    value: null
                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                  - name: Accrued Payroll
                    items: []
                    value: null
                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                  - name: Accrued Rent
                    items: []
                    value: null
                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                  - name: Credit Cards
                    items: []
                    value: null
                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                  - name: Unearned Revenue
                    items: []
                    value: null
                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                value: '0'
                account_id: null
              meta:
                note: Computed by Rutter
              created_at: '2024-02-13T22:06:15.170Z'
              updated_at: '2024-02-13T22:06:15.110Z'
              task_status: SUCCESS
            - id: 20cf3f3f-857a-418b-918e-d97b84e8699c
              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
              platform_id: 8
              external_id: 254d96c0-6447-50f2-a56b-49577c48978a
              start_date: '2023-07-01T00:00:00.000Z'
              end_date: '2023-07-31T00:00:00.000Z'
              currency: USD
              total_assets: '0'
              total_equity: '0'
              total_liabilities: '0'
              assets:
                name: Assets
                items:
                  - name: Cash & Bank
                    items:
                      - name: Cash
                        items: []
                        value: null
                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                      - name: Petty Cash
                        items: []
                        value: null
                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                    value: '0'
                    account_id: null
                  - name: Current Asset
                    items:
                      - name: Accounts Receivable
                        items: []
                        value: null
                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                      - name: Customer Deposits
                        items: []
                        value: null
                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                      - name: Deferred Discounts
                        items: []
                        value: null
                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                      - name: Deposits
                        items: []
                        value: null
                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                      - name: Prepaid Expenses
                        items: []
                        value: null
                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                    value: '0'
                    account_id: null
                  - name: Property, Plant, and Equipment
                    items:
                      - name: Furniture - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                      - name: Property, Plant, and Equipment
                        items: []
                        value: null
                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                      - name: Furniture
                        items: []
                        value: null
                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                      - name: Office Equipment
                        items: []
                        value: null
                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                      - name: Office Equipment - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                    value: '0'
                    account_id: null
                value: '0'
                account_id: null
              equity:
                name: Equity
                items:
                  - name: Common Stock
                    items: []
                    value: null
                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                  - name: Opening Balance
                    items: []
                    value: null
                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                  - name: Opening Balance Adjustments
                    items: []
                    value: null
                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                  - name: Owner's Equity
                    items: []
                    value: null
                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                  - name: Retained Earnings
                    items: []
                    value: null
                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                  - name: Dividends
                    items: []
                    value: null
                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                value: '0'
                account_id: null
              liabilities:
                name: Liabilities
                items:
                  - name: Accounts Payable
                    items: []
                    value: null
                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                  - name: Customer Credit
                    items: []
                    value: null
                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                  - name: Taxes Payable
                    items: []
                    value: null
                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                  - name: Income Tax Payable
                    items: []
                    value: null
                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                  - name: Property Tax Payable
                    items: []
                    value: null
                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                  - name: Accruals
                    items: []
                    value: null
                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                  - name: Accrued Payroll
                    items: []
                    value: null
                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                  - name: Accrued Rent
                    items: []
                    value: null
                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                  - name: Credit Cards
                    items: []
                    value: null
                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                  - name: Unearned Revenue
                    items: []
                    value: null
                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                value: '0'
                account_id: null
              meta:
                note: Computed by Rutter
              created_at: '2024-02-13T22:06:15.172Z'
              updated_at: '2024-02-13T22:06:15.106Z'
              task_status: SUCCESS
            - id: f4c1acd2-6cfb-4a11-8ff1-58079159f3e1
              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
              platform_id: 8
              external_id: b37c6a61-4b03-59af-806c-0c59b9574f6d
              start_date: '2023-06-01T00:00:00.000Z'
              end_date: '2023-06-30T00:00:00.000Z'
              currency: USD
              total_assets: '0'
              total_equity: '0'
              total_liabilities: '0'
              assets:
                name: Assets
                items:
                  - name: Cash & Bank
                    items:
                      - name: Cash
                        items: []
                        value: null
                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                      - name: Petty Cash
                        items: []
                        value: null
                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                    value: '0'
                    account_id: null
                  - name: Current Asset
                    items:
                      - name: Accounts Receivable
                        items: []
                        value: null
                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                      - name: Customer Deposits
                        items: []
                        value: null
                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                      - name: Deferred Discounts
                        items: []
                        value: null
                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                      - name: Deposits
                        items: []
                        value: null
                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                      - name: Prepaid Expenses
                        items: []
                        value: null
                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                    value: '0'
                    account_id: null
                  - name: Property, Plant, and Equipment
                    items:
                      - name: Furniture - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                      - name: Property, Plant, and Equipment
                        items: []
                        value: null
                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                      - name: Furniture
                        items: []
                        value: null
                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                      - name: Office Equipment
                        items: []
                        value: null
                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                      - name: Office Equipment - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                    value: '0'
                    account_id: null
                value: '0'
                account_id: null
              equity:
                name: Equity
                items:
                  - name: Common Stock
                    items: []
                    value: null
                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                  - name: Opening Balance
                    items: []
                    value: null
                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                  - name: Opening Balance Adjustments
                    items: []
                    value: null
                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                  - name: Owner's Equity
                    items: []
                    value: null
                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                  - name: Retained Earnings
                    items: []
                    value: null
                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                  - name: Dividends
                    items: []
                    value: null
                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                value: '0'
                account_id: null
              liabilities:
                name: Liabilities
                items:
                  - name: Accounts Payable
                    items: []
                    value: null
                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                  - name: Customer Credit
                    items: []
                    value: null
                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                  - name: Taxes Payable
                    items: []
                    value: null
                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                  - name: Income Tax Payable
                    items: []
                    value: null
                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                  - name: Property Tax Payable
                    items: []
                    value: null
                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                  - name: Accruals
                    items: []
                    value: null
                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                  - name: Accrued Payroll
                    items: []
                    value: null
                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                  - name: Accrued Rent
                    items: []
                    value: null
                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                  - name: Credit Cards
                    items: []
                    value: null
                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                  - name: Unearned Revenue
                    items: []
                    value: null
                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                value: '0'
                account_id: null
              meta:
                note: Computed by Rutter
              created_at: '2024-02-13T22:06:15.174Z'
              updated_at: '2024-02-13T22:06:15.101Z'
              task_status: SUCCESS
            - id: 9e608eb4-59c2-4ae5-bdff-01658e88e208
              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
              platform_id: 8
              external_id: c1d0c8f3-e8bc-510d-9dcf-3afe83f234c1
              start_date: '2023-05-01T00:00:00.000Z'
              end_date: '2023-05-31T00:00:00.000Z'
              currency: USD
              total_assets: '0'
              total_equity: '0'
              total_liabilities: '0'
              assets:
                name: Assets
                items:
                  - name: Cash & Bank
                    items:
                      - name: Cash
                        items: []
                        value: null
                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                      - name: Petty Cash
                        items: []
                        value: null
                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                    value: '0'
                    account_id: null
                  - name: Current Asset
                    items:
                      - name: Accounts Receivable
                        items: []
                        value: null
                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                      - name: Customer Deposits
                        items: []
                        value: null
                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                      - name: Deferred Discounts
                        items: []
                        value: null
                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                      - name: Deposits
                        items: []
                        value: null
                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                      - name: Prepaid Expenses
                        items: []
                        value: null
                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                    value: '0'
                    account_id: null
                  - name: Property, Plant, and Equipment
                    items:
                      - name: Furniture - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                      - name: Property, Plant, and Equipment
                        items: []
                        value: null
                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                      - name: Furniture
                        items: []
                        value: null
                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                      - name: Office Equipment
                        items: []
                        value: null
                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                      - name: Office Equipment - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                    value: '0'
                    account_id: null
                value: '0'
                account_id: null
              equity:
                name: Equity
                items:
                  - name: Common Stock
                    items: []
                    value: null
                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                  - name: Opening Balance
                    items: []
                    value: null
                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                  - name: Opening Balance Adjustments
                    items: []
                    value: null
                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                  - name: Owner's Equity
                    items: []
                    value: null
                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                  - name: Retained Earnings
                    items: []
                    value: null
                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                  - name: Dividends
                    items: []
                    value: null
                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                value: '0'
                account_id: null
              liabilities:
                name: Liabilities
                items:
                  - name: Accounts Payable
                    items: []
                    value: null
                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                  - name: Customer Credit
                    items: []
                    value: null
                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                  - name: Taxes Payable
                    items: []
                    value: null
                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                  - name: Income Tax Payable
                    items: []
                    value: null
                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                  - name: Property Tax Payable
                    items: []
                    value: null
                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                  - name: Accruals
                    items: []
                    value: null
                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                  - name: Accrued Payroll
                    items: []
                    value: null
                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                  - name: Accrued Rent
                    items: []
                    value: null
                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                  - name: Credit Cards
                    items: []
                    value: null
                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                  - name: Unearned Revenue
                    items: []
                    value: null
                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                value: '0'
                account_id: null
              meta:
                note: Computed by Rutter
              created_at: '2024-02-13T22:06:15.176Z'
              updated_at: '2024-02-13T22:06:15.097Z'
              task_status: SUCCESS
            - id: 97b7e48a-7dbe-4984-bf3a-54c9bfe91817
              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
              platform_id: 8
              external_id: e236c83b-38a3-52a8-8793-8bbc1507ce58
              start_date: '2023-04-01T00:00:00.000Z'
              end_date: '2023-04-30T00:00:00.000Z'
              currency: USD
              total_assets: '0'
              total_equity: '0'
              total_liabilities: '0'
              assets:
                name: Assets
                items:
                  - name: Cash & Bank
                    items:
                      - name: Cash
                        items: []
                        value: null
                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                      - name: Petty Cash
                        items: []
                        value: null
                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                    value: '0'
                    account_id: null
                  - name: Current Asset
                    items:
                      - name: Accounts Receivable
                        items: []
                        value: null
                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                      - name: Customer Deposits
                        items: []
                        value: null
                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                      - name: Deferred Discounts
                        items: []
                        value: null
                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                      - name: Deposits
                        items: []
                        value: null
                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                      - name: Prepaid Expenses
                        items: []
                        value: null
                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                    value: '0'
                    account_id: null
                  - name: Property, Plant, and Equipment
                    items:
                      - name: Furniture - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                      - name: Property, Plant, and Equipment
                        items: []
                        value: null
                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                      - name: Furniture
                        items: []
                        value: null
                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                      - name: Office Equipment
                        items: []
                        value: null
                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                      - name: Office Equipment - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                    value: '0'
                    account_id: null
                value: '0'
                account_id: null
              equity:
                name: Equity
                items:
                  - name: Common Stock
                    items: []
                    value: null
                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                  - name: Opening Balance
                    items: []
                    value: null
                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                  - name: Opening Balance Adjustments
                    items: []
                    value: null
                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                  - name: Owner's Equity
                    items: []
                    value: null
                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                  - name: Retained Earnings
                    items: []
                    value: null
                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                  - name: Dividends
                    items: []
                    value: null
                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                value: '0'
                account_id: null
              liabilities:
                name: Liabilities
                items:
                  - name: Accounts Payable
                    items: []
                    value: null
                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                  - name: Customer Credit
                    items: []
                    value: null
                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                  - name: Taxes Payable
                    items: []
                    value: null
                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                  - name: Income Tax Payable
                    items: []
                    value: null
                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                  - name: Property Tax Payable
                    items: []
                    value: null
                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                  - name: Accruals
                    items: []
                    value: null
                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                  - name: Accrued Payroll
                    items: []
                    value: null
                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                  - name: Accrued Rent
                    items: []
                    value: null
                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                  - name: Credit Cards
                    items: []
                    value: null
                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                  - name: Unearned Revenue
                    items: []
                    value: null
                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                value: '0'
                account_id: null
              meta:
                note: Computed by Rutter
              created_at: '2024-02-13T22:06:15.178Z'
              updated_at: '2024-02-13T22:06:15.092Z'
              task_status: SUCCESS
            - id: 7e215746-64b5-47aa-a1e1-8ddcdfb4ed69
              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
              platform_id: 8
              external_id: 50a8564b-7d16-5216-85b3-05e2813bf44c
              start_date: '2023-03-01T00:00:00.000Z'
              end_date: '2023-03-31T00:00:00.000Z'
              currency: USD
              total_assets: '0'
              total_equity: '0'
              total_liabilities: '0'
              assets:
                name: Assets
                items:
                  - name: Cash & Bank
                    items:
                      - name: Cash
                        items: []
                        value: null
                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                      - name: Petty Cash
                        items: []
                        value: null
                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                    value: '0'
                    account_id: null
                  - name: Current Asset
                    items:
                      - name: Accounts Receivable
                        items: []
                        value: null
                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                      - name: Customer Deposits
                        items: []
                        value: null
                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                      - name: Deferred Discounts
                        items: []
                        value: null
                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                      - name: Deposits
                        items: []
                        value: null
                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                      - name: Prepaid Expenses
                        items: []
                        value: null
                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                    value: '0'
                    account_id: null
                  - name: Property, Plant, and Equipment
                    items:
                      - name: Furniture - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                      - name: Property, Plant, and Equipment
                        items: []
                        value: null
                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                      - name: Furniture
                        items: []
                        value: null
                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                      - name: Office Equipment
                        items: []
                        value: null
                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                      - name: Office Equipment - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                    value: '0'
                    account_id: null
                value: '0'
                account_id: null
              equity:
                name: Equity
                items:
                  - name: Common Stock
                    items: []
                    value: null
                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                  - name: Opening Balance
                    items: []
                    value: null
                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                  - name: Opening Balance Adjustments
                    items: []
                    value: null
                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                  - name: Owner's Equity
                    items: []
                    value: null
                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                  - name: Retained Earnings
                    items: []
                    value: null
                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                  - name: Dividends
                    items: []
                    value: null
                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                value: '0'
                account_id: null
              liabilities:
                name: Liabilities
                items:
                  - name: Accounts Payable
                    items: []
                    value: null
                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                  - name: Customer Credit
                    items: []
                    value: null
                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                  - name: Taxes Payable
                    items: []
                    value: null
                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                  - name: Income Tax Payable
                    items: []
                    value: null
                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                  - name: Property Tax Payable
                    items: []
                    value: null
                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                  - name: Accruals
                    items: []
                    value: null
                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                  - name: Accrued Payroll
                    items: []
                    value: null
                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                  - name: Accrued Rent
                    items: []
                    value: null
                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                  - name: Credit Cards
                    items: []
                    value: null
                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                  - name: Unearned Revenue
                    items: []
                    value: null
                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                value: '0'
                account_id: null
              meta:
                note: Computed by Rutter
              created_at: '2024-02-13T22:06:15.181Z'
              updated_at: '2024-02-13T22:06:15.088Z'
              task_status: SUCCESS
            - id: 88097521-aff7-49ca-bfe4-45ab6c4bbfb6
              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
              platform_id: 8
              external_id: ccccc50d-d4d6-598c-84e0-ed8d6ed1229f
              start_date: '2023-02-01T00:00:00.000Z'
              end_date: '2023-02-28T00:00:00.000Z'
              currency: USD
              total_assets: '0'
              total_equity: '0'
              total_liabilities: '0'
              assets:
                name: Assets
                items:
                  - name: Cash & Bank
                    items:
                      - name: Cash
                        items: []
                        value: null
                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                      - name: Petty Cash
                        items: []
                        value: null
                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                    value: '0'
                    account_id: null
                  - name: Current Asset
                    items:
                      - name: Accounts Receivable
                        items: []
                        value: null
                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                      - name: Customer Deposits
                        items: []
                        value: null
                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                      - name: Deferred Discounts
                        items: []
                        value: null
                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                      - name: Deposits
                        items: []
                        value: null
                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                      - name: Prepaid Expenses
                        items: []
                        value: null
                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                    value: '0'
                    account_id: null
                  - name: Property, Plant, and Equipment
                    items:
                      - name: Furniture - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                      - name: Property, Plant, and Equipment
                        items: []
                        value: null
                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                      - name: Furniture
                        items: []
                        value: null
                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                      - name: Office Equipment
                        items: []
                        value: null
                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                      - name: Office Equipment - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                    value: '0'
                    account_id: null
                value: '0'
                account_id: null
              equity:
                name: Equity
                items:
                  - name: Common Stock
                    items: []
                    value: null
                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                  - name: Opening Balance
                    items: []
                    value: null
                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                  - name: Opening Balance Adjustments
                    items: []
                    value: null
                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                  - name: Owner's Equity
                    items: []
                    value: null
                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                  - name: Retained Earnings
                    items: []
                    value: null
                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                  - name: Dividends
                    items: []
                    value: null
                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                value: '0'
                account_id: null
              liabilities:
                name: Liabilities
                items:
                  - name: Accounts Payable
                    items: []
                    value: null
                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                  - name: Customer Credit
                    items: []
                    value: null
                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                  - name: Taxes Payable
                    items: []
                    value: null
                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                  - name: Income Tax Payable
                    items: []
                    value: null
                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                  - name: Property Tax Payable
                    items: []
                    value: null
                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                  - name: Accruals
                    items: []
                    value: null
                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                  - name: Accrued Payroll
                    items: []
                    value: null
                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                  - name: Accrued Rent
                    items: []
                    value: null
                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                  - name: Credit Cards
                    items: []
                    value: null
                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                  - name: Unearned Revenue
                    items: []
                    value: null
                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                value: '0'
                account_id: null
              meta:
                note: Computed by Rutter
              created_at: '2024-02-13T22:06:15.183Z'
              updated_at: '2024-02-13T22:06:15.084Z'
              task_status: SUCCESS
            - id: 876ddf7e-a0e8-49fe-b4fc-39a9c1551ede
              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
              platform_id: 8
              external_id: edfc4e0f-5b8a-55ff-ab71-608b74dfe159
              start_date: '2023-01-01T00:00:00.000Z'
              end_date: '2023-01-31T00:00:00.000Z'
              currency: USD
              total_assets: '0'
              total_equity: '0'
              total_liabilities: '0'
              assets:
                name: Assets
                items:
                  - name: Cash & Bank
                    items:
                      - name: Cash
                        items: []
                        value: null
                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                      - name: Petty Cash
                        items: []
                        value: null
                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                    value: '0'
                    account_id: null
                  - name: Current Asset
                    items:
                      - name: Accounts Receivable
                        items: []
                        value: null
                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                      - name: Customer Deposits
                        items: []
                        value: null
                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                      - name: Deferred Discounts
                        items: []
                        value: null
                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                      - name: Deposits
                        items: []
                        value: null
                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                      - name: Prepaid Expenses
                        items: []
                        value: null
                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                    value: '0'
                    account_id: null
                  - name: Property, Plant, and Equipment
                    items:
                      - name: Furniture - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                      - name: Property, Plant, and Equipment
                        items: []
                        value: null
                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                      - name: Furniture
                        items: []
                        value: null
                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                      - name: Office Equipment
                        items: []
                        value: null
                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                      - name: Office Equipment - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                    value: '0'
                    account_id: null
                value: '0'
                account_id: null
              equity:
                name: Equity
                items:
                  - name: Common Stock
                    items: []
                    value: null
                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                  - name: Opening Balance
                    items: []
                    value: null
                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                  - name: Opening Balance Adjustments
                    items: []
                    value: null
                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                  - name: Owner's Equity
                    items: []
                    value: null
                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                  - name: Retained Earnings
                    items: []
                    value: null
                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                  - name: Dividends
                    items: []
                    value: null
                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                value: '0'
                account_id: null
              liabilities:
                name: Liabilities
                items:
                  - name: Accounts Payable
                    items: []
                    value: null
                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                  - name: Customer Credit
                    items: []
                    value: null
                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                  - name: Taxes Payable
                    items: []
                    value: null
                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                  - name: Income Tax Payable
                    items: []
                    value: null
                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                  - name: Property Tax Payable
                    items: []
                    value: null
                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                  - name: Accruals
                    items: []
                    value: null
                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                  - name: Accrued Payroll
                    items: []
                    value: null
                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                  - name: Accrued Rent
                    items: []
                    value: null
                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                  - name: Credit Cards
                    items: []
                    value: null
                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                  - name: Unearned Revenue
                    items: []
                    value: null
                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                value: '0'
                account_id: null
              meta:
                note: Computed by Rutter
              created_at: '2024-02-13T22:06:15.195Z'
              updated_at: '2024-02-13T22:06:15.079Z'
              task_status: SUCCESS
            - id: b744219b-7a29-42c6-b043-e773ae5e6a64
              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
              platform_id: 8
              external_id: eb5b803a-15f8-5712-bd0d-b5e931488999
              start_date: '2022-12-01T00:00:00.000Z'
              end_date: '2022-12-31T00:00:00.000Z'
              currency: USD
              total_assets: '0'
              total_equity: '0'
              total_liabilities: '0'
              assets:
                name: Assets
                items:
                  - name: Cash & Bank
                    items:
                      - name: Cash
                        items: []
                        value: null
                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                      - name: Petty Cash
                        items: []
                        value: null
                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                    value: '0'
                    account_id: null
                  - name: Current Asset
                    items:
                      - name: Accounts Receivable
                        items: []
                        value: null
                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                      - name: Customer Deposits
                        items: []
                        value: null
                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                      - name: Deferred Discounts
                        items: []
                        value: null
                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                      - name: Deposits
                        items: []
                        value: null
                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                      - name: Prepaid Expenses
                        items: []
                        value: null
                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                    value: '0'
                    account_id: null
                  - name: Property, Plant, and Equipment
                    items:
                      - name: Furniture - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                      - name: Property, Plant, and Equipment
                        items: []
                        value: null
                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                      - name: Furniture
                        items: []
                        value: null
                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                      - name: Office Equipment
                        items: []
                        value: null
                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                      - name: Office Equipment - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                    value: '0'
                    account_id: null
                value: '0'
                account_id: null
              equity:
                name: Equity
                items:
                  - name: Common Stock
                    items: []
                    value: null
                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                  - name: Opening Balance
                    items: []
                    value: null
                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                  - name: Opening Balance Adjustments
                    items: []
                    value: null
                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                  - name: Owner's Equity
                    items: []
                    value: null
                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                  - name: Retained Earnings
                    items: []
                    value: null
                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                  - name: Dividends
                    items: []
                    value: null
                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                value: '0'
                account_id: null
              liabilities:
                name: Liabilities
                items:
                  - name: Accounts Payable
                    items: []
                    value: null
                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                  - name: Customer Credit
                    items: []
                    value: null
                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                  - name: Taxes Payable
                    items: []
                    value: null
                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                  - name: Income Tax Payable
                    items: []
                    value: null
                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                  - name: Property Tax Payable
                    items: []
                    value: null
                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                  - name: Accruals
                    items: []
                    value: null
                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                  - name: Accrued Payroll
                    items: []
                    value: null
                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                  - name: Accrued Rent
                    items: []
                    value: null
                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                  - name: Credit Cards
                    items: []
                    value: null
                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                  - name: Unearned Revenue
                    items: []
                    value: null
                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                value: '0'
                account_id: null
              meta:
                note: Computed by Rutter
              created_at: '2024-02-13T22:06:15.197Z'
              updated_at: '2024-02-13T22:06:15.075Z'
              task_status: SUCCESS
            - id: 9ccf4961-0416-403e-bee3-626a02063e66
              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
              platform_id: 8
              external_id: 947dd708-0ee4-54fb-9a87-abe2fb30e64f
              start_date: '2022-11-01T00:00:00.000Z'
              end_date: '2022-11-30T00:00:00.000Z'
              currency: USD
              total_assets: '0'
              total_equity: '0'
              total_liabilities: '0'
              assets:
                name: Assets
                items:
                  - name: Cash & Bank
                    items:
                      - name: Cash
                        items: []
                        value: null
                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                      - name: Petty Cash
                        items: []
                        value: null
                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                    value: '0'
                    account_id: null
                  - name: Current Asset
                    items:
                      - name: Accounts Receivable
                        items: []
                        value: null
                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                      - name: Customer Deposits
                        items: []
                        value: null
                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                      - name: Deferred Discounts
                        items: []
                        value: null
                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                      - name: Deposits
                        items: []
                        value: null
                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                      - name: Prepaid Expenses
                        items: []
                        value: null
                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                    value: '0'
                    account_id: null
                  - name: Property, Plant, and Equipment
                    items:
                      - name: Furniture - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                      - name: Property, Plant, and Equipment
                        items: []
                        value: null
                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                      - name: Furniture
                        items: []
                        value: null
                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                      - name: Office Equipment
                        items: []
                        value: null
                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                      - name: Office Equipment - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                    value: '0'
                    account_id: null
                value: '0'
                account_id: null
              equity:
                name: Equity
                items:
                  - name: Common Stock
                    items: []
                    value: null
                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                  - name: Opening Balance
                    items: []
                    value: null
                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                  - name: Opening Balance Adjustments
                    items: []
                    value: null
                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                  - name: Owner's Equity
                    items: []
                    value: null
                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                  - name: Retained Earnings
                    items: []
                    value: null
                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                  - name: Dividends
                    items: []
                    value: null
                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                value: '0'
                account_id: null
              liabilities:
                name: Liabilities
                items:
                  - name: Accounts Payable
                    items: []
                    value: null
                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                  - name: Customer Credit
                    items: []
                    value: null
                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                  - name: Taxes Payable
                    items: []
                    value: null
                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                  - name: Income Tax Payable
                    items: []
                    value: null
                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                  - name: Property Tax Payable
                    items: []
                    value: null
                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                  - name: Accruals
                    items: []
                    value: null
                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                  - name: Accrued Payroll
                    items: []
                    value: null
                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                  - name: Accrued Rent
                    items: []
                    value: null
                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                  - name: Credit Cards
                    items: []
                    value: null
                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                  - name: Unearned Revenue
                    items: []
                    value: null
                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                value: '0'
                account_id: null
              meta:
                note: Computed by Rutter
              created_at: '2024-02-13T22:06:15.199Z'
              updated_at: '2024-02-13T22:06:15.070Z'
              task_status: SUCCESS
            - id: f5832348-b350-40eb-b84d-86f2fa5480b4
              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
              platform_id: 8
              external_id: 05eadcf6-5a8e-553f-854e-7c2f93e0fd02
              start_date: '2022-10-01T00:00:00.000Z'
              end_date: '2022-10-31T00:00:00.000Z'
              currency: USD
              total_assets: '0'
              total_equity: '0'
              total_liabilities: '0'
              assets:
                name: Assets
                items:
                  - name: Cash & Bank
                    items:
                      - name: Cash
                        items: []
                        value: null
                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                      - name: Petty Cash
                        items: []
                        value: null
                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                    value: '0'
                    account_id: null
                  - name: Current Asset
                    items:
                      - name: Accounts Receivable
                        items: []
                        value: null
                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                      - name: Customer Deposits
                        items: []
                        value: null
                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                      - name: Deferred Discounts
                        items: []
                        value: null
                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                      - name: Deposits
                        items: []
                        value: null
                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                      - name: Prepaid Expenses
                        items: []
                        value: null
                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                    value: '0'
                    account_id: null
                  - name: Property, Plant, and Equipment
                    items:
                      - name: Furniture - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                      - name: Property, Plant, and Equipment
                        items: []
                        value: null
                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                      - name: Furniture
                        items: []
                        value: null
                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                      - name: Office Equipment
                        items: []
                        value: null
                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                      - name: Office Equipment - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                    value: '0'
                    account_id: null
                value: '0'
                account_id: null
              equity:
                name: Equity
                items:
                  - name: Common Stock
                    items: []
                    value: null
                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                  - name: Opening Balance
                    items: []
                    value: null
                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                  - name: Opening Balance Adjustments
                    items: []
                    value: null
                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                  - name: Owner's Equity
                    items: []
                    value: null
                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                  - name: Retained Earnings
                    items: []
                    value: null
                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                  - name: Dividends
                    items: []
                    value: null
                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                value: '0'
                account_id: null
              liabilities:
                name: Liabilities
                items:
                  - name: Accounts Payable
                    items: []
                    value: null
                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                  - name: Customer Credit
                    items: []
                    value: null
                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                  - name: Taxes Payable
                    items: []
                    value: null
                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                  - name: Income Tax Payable
                    items: []
                    value: null
                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                  - name: Property Tax Payable
                    items: []
                    value: null
                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                  - name: Accruals
                    items: []
                    value: null
                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                  - name: Accrued Payroll
                    items: []
                    value: null
                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                  - name: Accrued Rent
                    items: []
                    value: null
                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                  - name: Credit Cards
                    items: []
                    value: null
                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                  - name: Unearned Revenue
                    items: []
                    value: null
                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                value: '0'
                account_id: null
              meta:
                note: Computed by Rutter
              created_at: '2024-02-13T22:06:15.202Z'
              updated_at: '2024-02-13T22:06:15.063Z'
              task_status: SUCCESS
            - id: 4161652b-6e0d-413c-91cd-1598e7a19f82
              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
              platform_id: 8
              external_id: 0a5bab96-ba8f-55c9-be9d-ab9021dd9af6
              start_date: '2022-09-01T00:00:00.000Z'
              end_date: '2022-09-30T00:00:00.000Z'
              currency: USD
              total_assets: '0'
              total_equity: '0'
              total_liabilities: '0'
              assets:
                name: Assets
                items:
                  - name: Cash & Bank
                    items:
                      - name: Cash
                        items: []
                        value: null
                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                      - name: Petty Cash
                        items: []
                        value: null
                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                    value: '0'
                    account_id: null
                  - name: Current Asset
                    items:
                      - name: Accounts Receivable
                        items: []
                        value: null
                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                      - name: Customer Deposits
                        items: []
                        value: null
                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                      - name: Deferred Discounts
                        items: []
                        value: null
                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                      - name: Deposits
                        items: []
                        value: null
                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                      - name: Prepaid Expenses
                        items: []
                        value: null
                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                    value: '0'
                    account_id: null
                  - name: Property, Plant, and Equipment
                    items:
                      - name: Furniture - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                      - name: Property, Plant, and Equipment
                        items: []
                        value: null
                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                      - name: Furniture
                        items: []
                        value: null
                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                      - name: Office Equipment
                        items: []
                        value: null
                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                      - name: Office Equipment - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                    value: '0'
                    account_id: null
                value: '0'
                account_id: null
              equity:
                name: Equity
                items:
                  - name: Common Stock
                    items: []
                    value: null
                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                  - name: Opening Balance
                    items: []
                    value: null
                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                  - name: Opening Balance Adjustments
                    items: []
                    value: null
                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                  - name: Owner's Equity
                    items: []
                    value: null
                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                  - name: Retained Earnings
                    items: []
                    value: null
                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                  - name: Dividends
                    items: []
                    value: null
                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                value: '0'
                account_id: null
              liabilities:
                name: Liabilities
                items:
                  - name: Accounts Payable
                    items: []
                    value: null
                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                  - name: Customer Credit
                    items: []
                    value: null
                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                  - name: Taxes Payable
                    items: []
                    value: null
                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                  - name: Income Tax Payable
                    items: []
                    value: null
                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                  - name: Property Tax Payable
                    items: []
                    value: null
                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                  - name: Accruals
                    items: []
                    value: null
                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                  - name: Accrued Payroll
                    items: []
                    value: null
                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                  - name: Accrued Rent
                    items: []
                    value: null
                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                  - name: Credit Cards
                    items: []
                    value: null
                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                  - name: Unearned Revenue
                    items: []
                    value: null
                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                value: '0'
                account_id: null
              meta:
                note: Computed by Rutter
              created_at: '2024-02-13T22:06:15.204Z'
              updated_at: '2024-02-13T22:06:15.057Z'
              task_status: SUCCESS
            - id: ab36a33d-5e5e-4b88-8fab-9490350d3f63
              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
              platform_id: 8
              external_id: 173355db-05a1-53ca-9533-f39956ee00a9
              start_date: '2022-08-01T00:00:00.000Z'
              end_date: '2022-08-31T00:00:00.000Z'
              currency: USD
              total_assets: '0'
              total_equity: '0'
              total_liabilities: '0'
              assets:
                name: Assets
                items:
                  - name: Cash & Bank
                    items:
                      - name: Cash
                        items: []
                        value: null
                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                      - name: Petty Cash
                        items: []
                        value: null
                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                    value: '0'
                    account_id: null
                  - name: Current Asset
                    items:
                      - name: Accounts Receivable
                        items: []
                        value: null
                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                      - name: Customer Deposits
                        items: []
                        value: null
                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                      - name: Deferred Discounts
                        items: []
                        value: null
                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                      - name: Deposits
                        items: []
                        value: null
                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                      - name: Prepaid Expenses
                        items: []
                        value: null
                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                    value: '0'
                    account_id: null
                  - name: Property, Plant, and Equipment
                    items:
                      - name: Furniture - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                      - name: Property, Plant, and Equipment
                        items: []
                        value: null
                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                      - name: Furniture
                        items: []
                        value: null
                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                      - name: Office Equipment
                        items: []
                        value: null
                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                      - name: Office Equipment - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                    value: '0'
                    account_id: null
                value: '0'
                account_id: null
              equity:
                name: Equity
                items:
                  - name: Common Stock
                    items: []
                    value: null
                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                  - name: Opening Balance
                    items: []
                    value: null
                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                  - name: Opening Balance Adjustments
                    items: []
                    value: null
                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                  - name: Owner's Equity
                    items: []
                    value: null
                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                  - name: Retained Earnings
                    items: []
                    value: null
                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                  - name: Dividends
                    items: []
                    value: null
                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                value: '0'
                account_id: null
              liabilities:
                name: Liabilities
                items:
                  - name: Accounts Payable
                    items: []
                    value: null
                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                  - name: Customer Credit
                    items: []
                    value: null
                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                  - name: Taxes Payable
                    items: []
                    value: null
                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                  - name: Income Tax Payable
                    items: []
                    value: null
                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                  - name: Property Tax Payable
                    items: []
                    value: null
                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                  - name: Accruals
                    items: []
                    value: null
                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                  - name: Accrued Payroll
                    items: []
                    value: null
                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                  - name: Accrued Rent
                    items: []
                    value: null
                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                  - name: Credit Cards
                    items: []
                    value: null
                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                  - name: Unearned Revenue
                    items: []
                    value: null
                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                value: '0'
                account_id: null
              meta:
                note: Computed by Rutter
              created_at: '2024-02-13T22:06:15.206Z'
              updated_at: '2024-02-13T22:06:15.053Z'
              task_status: SUCCESS
            - id: 1d9eef16-eda3-4ecb-93a0-effcd9cceb34
              business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
              business_id: f17295d4-5237-4079-8b18-8786eddf49f3
              platform_id: 8
              external_id: 47c1c5b5-101d-5fc3-b4ab-b72d4607791e
              start_date: '2022-07-01T00:00:00.000Z'
              end_date: '2022-07-31T00:00:00.000Z'
              currency: USD
              total_assets: '0'
              total_equity: '0'
              total_liabilities: '0'
              assets:
                name: Assets
                items:
                  - name: Cash & Bank
                    items:
                      - name: Cash
                        items: []
                        value: null
                        account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                      - name: Petty Cash
                        items: []
                        value: null
                        account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                    value: '0'
                    account_id: null
                  - name: Current Asset
                    items:
                      - name: Accounts Receivable
                        items: []
                        value: null
                        account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                      - name: Customer Deposits
                        items: []
                        value: null
                        account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                      - name: Deferred Discounts
                        items: []
                        value: null
                        account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                      - name: Deposits
                        items: []
                        value: null
                        account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                      - name: Prepaid Expenses
                        items: []
                        value: null
                        account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                    value: '0'
                    account_id: null
                  - name: Property, Plant, and Equipment
                    items:
                      - name: Furniture - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                      - name: Property, Plant, and Equipment
                        items: []
                        value: null
                        account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                      - name: Furniture
                        items: []
                        value: null
                        account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                      - name: Office Equipment
                        items: []
                        value: null
                        account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                      - name: Office Equipment - Accumulated Depreciation
                        items: []
                        value: null
                        account_id: de710f63-acd8-48a2-aab1-6130b8069646
                    value: '0'
                    account_id: null
                value: '0'
                account_id: null
              equity:
                name: Equity
                items:
                  - name: Common Stock
                    items: []
                    value: null
                    account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
                  - name: Opening Balance
                    items: []
                    value: null
                    account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
                  - name: Opening Balance Adjustments
                    items: []
                    value: null
                    account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
                  - name: Owner's Equity
                    items: []
                    value: null
                    account_id: 9799227b-3245-4c6c-a75c-668189ec617b
                  - name: Retained Earnings
                    items: []
                    value: null
                    account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
                  - name: Dividends
                    items: []
                    value: null
                    account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
                value: '0'
                account_id: null
              liabilities:
                name: Liabilities
                items:
                  - name: Accounts Payable
                    items: []
                    value: null
                    account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
                  - name: Customer Credit
                    items: []
                    value: null
                    account_id: 41174cde-0a50-4504-8469-10299f7b5308
                  - name: Taxes Payable
                    items: []
                    value: null
                    account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
                  - name: Income Tax Payable
                    items: []
                    value: null
                    account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
                  - name: Property Tax Payable
                    items: []
                    value: null
                    account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
                  - name: Accruals
                    items: []
                    value: null
                    account_id: f588b351-5c5f-4062-b18b-6903c8286057
                  - name: Accrued Payroll
                    items: []
                    value: null
                    account_id: efaa167f-a9f2-4c24-8de0-70b127732605
                  - name: Accrued Rent
                    items: []
                    value: null
                    account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
                  - name: Credit Cards
                    items: []
                    value: null
                    account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
                  - name: Unearned Revenue
                    items: []
                    value: null
                    account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
                value: '0'
                account_id: null
              meta:
                note: Computed by Rutter
              created_at: '2024-02-13T22:06:15.208Z'
              updated_at: '2024-02-13T22:06:15.048Z'
              task_status: SUCCESS
          total: '63'
    AccountingBalancesheet:
      title: AccountingBalancesheet
      type: object
      properties:
        id:
          type: string
        business_integration_task_id:
          type: string
        business_id:
          type: string
        platform_id:
          type: integer
          contentEncoding: int32
        external_id:
          type: string
        start_date:
          type: string
        end_date:
          type: string
        currency:
          type: string
        total_assets:
          type: string
        total_equity:
          type: string
        total_liabilities:
          type: string
        assets:
          $ref: '#/components/schemas/Assets1'
        equity:
          $ref: '#/components/schemas/Equity1'
        liabilities:
          $ref: '#/components/schemas/Liabilities1'
        meta:
          $ref: '#/components/schemas/Meta'
        created_at:
          type: string
        updated_at:
          type: string
        task_status:
          type: string
      examples:
        - id: 837a9495-986a-4cae-b5c1-937da7d2c68f
          business_integration_task_id: 5a6c1277-732d-460b-97a6-ac70d53d5ffc
          business_id: f17295d4-5237-4079-8b18-8786eddf49f3
          platform_id: 8
          external_id: f6c14930-8ec2-5570-ace6-aa22d5feb47d
          start_date: '2024-02-01T00:00:00.000Z'
          end_date: '2024-02-29T00:00:00.000Z'
          currency: USD
          total_assets: '0'
          total_equity: '0'
          total_liabilities: '0'
          assets:
            name: Assets
            items:
              - name: Cash & Bank
                items:
                  - name: Cash
                    items: []
                    value: null
                    account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                  - name: Petty Cash
                    items: []
                    value: null
                    account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
                value: '0'
                account_id: null
              - name: Current Asset
                items:
                  - name: Accounts Receivable
                    items: []
                    value: null
                    account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                  - name: Customer Deposits
                    items: []
                    value: null
                    account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                  - name: Deferred Discounts
                    items: []
                    value: null
                    account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                  - name: Deposits
                    items: []
                    value: null
                    account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                  - name: Prepaid Expenses
                    items: []
                    value: null
                    account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
                value: '0'
                account_id: null
              - name: Property, Plant, and Equipment
                items:
                  - name: Furniture - Accumulated Depreciation
                    items: []
                    value: null
                    account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                  - name: Property, Plant, and Equipment
                    items: []
                    value: null
                    account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                  - name: Furniture
                    items: []
                    value: null
                    account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                  - name: Office Equipment
                    items: []
                    value: null
                    account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                  - name: Office Equipment - Accumulated Depreciation
                    items: []
                    value: null
                    account_id: de710f63-acd8-48a2-aab1-6130b8069646
                value: '0'
                account_id: null
            value: '0'
            account_id: null
          equity:
            name: Equity
            items:
              - name: Common Stock
                items: []
                value: null
                account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
              - name: Opening Balance
                items: []
                value: null
                account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
              - name: Opening Balance Adjustments
                items: []
                value: null
                account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
              - name: Owner's Equity
                items: []
                value: null
                account_id: 9799227b-3245-4c6c-a75c-668189ec617b
              - name: Retained Earnings
                items: []
                value: null
                account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
              - name: Dividends
                items: []
                value: null
                account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
            value: '0'
            account_id: null
          liabilities:
            name: Liabilities
            items:
              - name: Accounts Payable
                items: []
                value: null
                account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
              - name: Customer Credit
                items: []
                value: null
                account_id: 41174cde-0a50-4504-8469-10299f7b5308
              - name: Taxes Payable
                items: []
                value: null
                account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
              - name: Income Tax Payable
                items: []
                value: null
                account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
              - name: Property Tax Payable
                items: []
                value: null
                account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
              - name: Accruals
                items: []
                value: null
                account_id: f588b351-5c5f-4062-b18b-6903c8286057
              - name: Accrued Payroll
                items: []
                value: null
                account_id: efaa167f-a9f2-4c24-8de0-70b127732605
              - name: Accrued Rent
                items: []
                value: null
                account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
              - name: Credit Cards
                items: []
                value: null
                account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
              - name: Unearned Revenue
                items: []
                value: null
                account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
            value: '0'
            account_id: null
          meta:
            note: Computed by Rutter
          created_at: '2024-02-13T22:06:15.154Z'
          updated_at: '2024-02-13T22:06:15.137Z'
          task_status: SUCCESS
    Assets1:
      title: Assets1
      type: object
      properties:
        name:
          type: string
        items:
          type: array
          items:
            $ref: '#/components/schemas/Item'
          description: ''
        value:
          type: string
        account_id:
          type:
            - string
            - 'null'
      examples:
        - name: Assets
          items:
            - name: Cash & Bank
              items:
                - name: Cash
                  items: []
                  value: null
                  account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
                - name: Petty Cash
                  items: []
                  value: null
                  account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
              value: '0'
              account_id: null
            - name: Current Asset
              items:
                - name: Accounts Receivable
                  items: []
                  value: null
                  account_id: bca8f436-06df-4a3f-940b-fedb40dd9872
                - name: Customer Deposits
                  items: []
                  value: null
                  account_id: 1b3e3e2a-b3d2-42d5-88c7-eb97c99788f3
                - name: Deferred Discounts
                  items: []
                  value: null
                  account_id: 8ba524f4-d57f-422c-9727-b3a88338a859
                - name: Deposits
                  items: []
                  value: null
                  account_id: 653e0ce2-8a22-4806-a35f-8c74210d56f6
                - name: Prepaid Expenses
                  items: []
                  value: null
                  account_id: fd2117c0-4bbd-467b-97a8-acff98ba3071
              value: '0'
              account_id: null
            - name: Property, Plant, and Equipment
              items:
                - name: Furniture - Accumulated Depreciation
                  items: []
                  value: null
                  account_id: 0e014140-15e3-4faa-ad24-bae3d282084f
                - name: Property, Plant, and Equipment
                  items: []
                  value: null
                  account_id: 095cbef8-a61b-422c-a54c-ef64e4b035f0
                - name: Furniture
                  items: []
                  value: null
                  account_id: c7b09d91-2ac5-4a77-a9ab-913519afdd75
                - name: Office Equipment
                  items: []
                  value: null
                  account_id: 2a795323-9fc5-463c-a10f-62b2d1a60456
                - name: Office Equipment - Accumulated Depreciation
                  items: []
                  value: null
                  account_id: de710f63-acd8-48a2-aab1-6130b8069646
              value: '0'
              account_id: null
          value: '0'
          account_id: null
    Equity1:
      title: Equity1
      type: object
      properties:
        name:
          type: string
        items:
          type: array
          items:
            $ref: '#/components/schemas/Item1'
          description: ''
        value:
          type: string
        account_id:
          type:
            - string
            - 'null'
      examples:
        - name: Equity
          items:
            - name: Common Stock
              items: []
              value: null
              account_id: 7803d37d-45fd-4c2f-b735-8cb2406c83fd
            - name: Opening Balance
              items: []
              value: null
              account_id: 303b817f-9268-4bd5-9ede-c04c0192df4b
            - name: Opening Balance Adjustments
              items: []
              value: null
              account_id: 0b130840-cbd7-46a0-a0f4-04d521f4ae8b
            - name: Owner's Equity
              items: []
              value: null
              account_id: 9799227b-3245-4c6c-a75c-668189ec617b
            - name: Retained Earnings
              items: []
              value: null
              account_id: c85756fe-7d7a-4bfe-a89c-3cf381924e32
            - name: Dividends
              items: []
              value: null
              account_id: 482f4a51-dfef-4ad2-b40f-ced953256d4f
          value: '0'
          account_id: null
    Liabilities1:
      title: Liabilities1
      type: object
      properties:
        name:
          type: string
        items:
          type: array
          items:
            $ref: '#/components/schemas/Item1'
          description: ''
        value:
          type: string
        account_id:
          type:
            - string
            - 'null'
      examples:
        - name: Liabilities
          items:
            - name: Accounts Payable
              items: []
              value: null
              account_id: 0c9c0471-5dba-4327-9333-c0be82485f8a
            - name: Customer Credit
              items: []
              value: null
              account_id: 41174cde-0a50-4504-8469-10299f7b5308
            - name: Taxes Payable
              items: []
              value: null
              account_id: 703688ca-cdd9-49a3-8782-f863969fafcf
            - name: Income Tax Payable
              items: []
              value: null
              account_id: a29a5451-a816-480a-bf23-80a0c7bb48fe
            - name: Property Tax Payable
              items: []
              value: null
              account_id: 6b4896ed-a1b3-43d4-a914-24475e7ae633
            - name: Accruals
              items: []
              value: null
              account_id: f588b351-5c5f-4062-b18b-6903c8286057
            - name: Accrued Payroll
              items: []
              value: null
              account_id: efaa167f-a9f2-4c24-8de0-70b127732605
            - name: Accrued Rent
              items: []
              value: null
              account_id: 703400ec-2acb-4f80-b132-c1f0631e7c23
            - name: Credit Cards
              items: []
              value: null
              account_id: 878c374a-64df-46a5-858a-24b118dd3c8c
            - name: Unearned Revenue
              items: []
              value: null
              account_id: 748d64ee-3324-4723-9a0d-27fd21ccb43a
          value: '0'
          account_id: null
    Meta:
      title: Meta
      type: object
      properties:
        note:
          type: string
      examples:
        - note: Computed by Rutter
    Item:
      title: Item
      type: object
      properties:
        name:
          type: string
        items:
          type: array
          items:
            $ref: '#/components/schemas/Item1'
          description: ''
        value:
          type: string
        account_id:
          type:
            - string
            - 'null'
      examples:
        - name: Cash & Bank
          items:
            - name: Cash
              items: []
              value: null
              account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
            - name: Petty Cash
              items: []
              value: null
              account_id: 1190f061-f454-4071-baba-16c4b1bf92ed
          value: '0'
          account_id: null
    Item1:
      title: Item1
      type: object
      properties:
        name:
          type: string
        items:
          type: array
          items:
            type: string
          description: ''
        value:
          type:
            - string
            - 'null'
        account_id:
          type: string
      examples:
        - name: Cash
          items: []
          value: null
          account_id: f30fda8f-d43d-4e84-ab9b-dda6ff604573
  securitySchemes:
    bearer:
      type: http
      scheme: bearer

````

Built with [Mintlify](https://mintlify.com).