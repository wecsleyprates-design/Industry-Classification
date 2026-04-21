<!-- Source: https://docs.worthai.com/webhooks/webhooks.md -->
# About Webhooks

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# About Webhooks

> Use webhooks to get notified about events related to the WorthAI flow such as Business, Applicant, and Worth Score.

## Example

Suppose you have subscribed to the `business.updated` webhook event, you will receive a notification every time a business is updated.

## Webhook vs API

APIs send you the data when you request it. For Webhooks, you do not need to make a request. You receive the data when it is available.

> ### Example
>
> If you need to know whether a Applicant has accepted the invitation using APIs, you need to keep polling every few seconds until applicant has accepted the invitation. However, if you are using Webhooks, you can configure a webhook event business.onboarded to receive notifications when a business has accepted an invitation and onboarded.

> ## Webhooks

<CardGroup cols={2}>
  <Card title="Applicant Webhooks" icon="square-1" href="../webhooks/applicant">
    Webhook events related to Applicant
  </Card>

  <Card title="Business Webhooks" icon="square-2" href="../webhooks/business">
    Webhook events related to Business
  </Card>

  <Card title="Case Webhooks" icon="square-3" href="../webhooks/case">
    Webhook events related to Case
  </Card>

  <Card title="Integration Webhooks" icon="square-4" href="../webhooks/integration">
    Webhook events related to Integrations
  </Card>

  <Card title="Onboarding Webhooks" icon="square-5" href="../webhooks/onboarding">
    Webhook events related to Onboarding
  </Card>

  <Card title="Payment Processor Webhooks" icon="square-6" href="../webhooks/payment-processor">
    Webhook events related to Payment Processor
  </Card>

  <Card title="Risk Webhooks" icon="square-7" href="../webhooks/risk">
    Webhook events related to risk
  </Card>

  <Card title="Worth Score Webhooks" icon="square-8" href="../webhooks/score">
    Webhook events related to Worth Score
  </Card>
</CardGroup>
