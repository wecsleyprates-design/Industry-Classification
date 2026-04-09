<!-- Source: https://docs.worthai.com/onboarding-sdk/overview.md -->
# Overview

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Overview

The Worth AI Onboarding SDK enables customers to embed portions of the Worth Applicant Web App into their own websites. This provides a seamless, branded experience while leveraging Worth's application processing functionality.

## Why Use the Onboarding SDK?

The SDK enables:

* **Faster integration**: Reduce custom development work and integrate Worth's onboarding functionality quickly
* **Branded experience**: Maintain your brand identity while utilizing Worth's core functionality
* **Flexible embedding**: Embed specific portions of the Applicant Web App via iframe
* **Type-safe communication**: Built-in TypeScript support with type-safe message passing

## Installation

Install the SDK via npm:

```bash  theme={null}
npm install @worthai/onboarding-sdk
```

***

## Quick Start

> **Note**: The following example is illustrative code for vanilla TypeScript. Adapt to your framework's patterns when using React or other JavaScript frameworks.

```typescript  theme={null}
import { createOnboardingApp } from '@worthai/onboarding-sdk';

// Create an onboarding app instance and communicate with it
const onboardingApp = createOnboardingApp({
  // Make sure to have password login disabled on Worth Admin
  // before using inviteToken
  origin: '{{WORTH_ONBOARDING_APP_DOMAIN}}',
  inviteToken: '{{YOUR_INVITE_TOKEN}}',
  mode: 'embedded',
});

// Listen for onboarding messages
const subscription = onboardingApp.subscribe((event) => {
  if (event.data.type === 'ROUTE_URL') {
    console.log('Current route:', event.data.payload.url);
  }
});

// ⚠️ Important: Remember to unsubscribe when
// component unmounts or cleanup is needed.
// subscription.unsubscribe();

// Append the onboarding app iframe
document
  .getElementById('onboarding-container')
  .appendChild(onboardingApp.iframe);

// Adding event listeners to Prev and Next buttons

const prevButton = document.getElementById('onboarding-prev');
const nextButton = document.getElementById('onboarding-next');

// Next stage navigation command
prevButton && prevButton.addEventListener('click', () => onboardingApp.prev());

// Prev stage navigation command
nextButton && nextButton.addEventListener('click', () => onboardingApp.next());

// In your HTML:
// <div id="onboarding-container"></div>
// <button id="onboarding-prev">Back</button>
// <button id="onboarding-next">Next</button>
```

## Scope and Limitations

### What's In Scope

* ✅ Applicant Web App pages embedding
* ✅ JavaScript/TypeScript web SDK
* ✅ Modern browser support (last 2 versions of Chrome, Firefox, Safari, Edge)
* ✅ Client-side rendering
* ✅ Iframe-based embedding with secure communication

### What's Out of Scope

* ❌ Non-Applicant Web App pages or other Worth products
* ❌ SSO authentication between parent site and Worth Applicant webapp
* ❌ Mobile native SDKs (iOS/Android)
* ❌ Server-side rendering support
* ❌ Offline functionality
* ❌ Legacy browser support

***

## Browser Support

The SDK supports modern browsers only:

* Chrome (last 2 versions)
* Firefox (last 2 versions)
* Safari (last 2 versions)
* Edge (last 2 versions)

***

## Next Steps

* See [API Reference](/onboarding-sdk/api-reference) for complete API documentation

***

## Support

For questions or issues, please contact your Worth Customer Success team or reach out to [support@joinworth.com](mailto:support@joinworth.com).


Built with [Mintlify](https://mintlify.com).