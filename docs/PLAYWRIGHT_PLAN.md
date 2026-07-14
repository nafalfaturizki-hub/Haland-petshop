# Playwright Plan

## Goal

Create a structured end-to-end test plan for the most important ERP workflows.

## Priority Scenarios

1. Authentication
   - login success
   - invalid PIN handling
   - redirect for authenticated staff and customer users

2. Role and permission coverage
   - owner can access staff modules
   - customer cannot access staff pages
   - doctor can access medical records but not POS

3. Product and inventory
   - create product
   - update stock
   - archive product

4. POS and billing
   - add item to cart
   - complete payment
   - generate invoice
   - view receipt/history

5. Clinic workflows
   - create appointment
   - assign doctor
   - create medical record

6. Pet hotel
   - create booking
   - check-in and check-out flow

7. Reporting and owner dashboard
   - view summary metrics
   - export/report flows where supported

8. Regression scenarios
   - navigation after login
   - session expiry
   - failed action feedback

## Implementation Guidance

The repository already contains Playwright configuration and some E2E test files, so the next step is to expand them around the core ERP flows and keep them deterministic by using seeded test accounts.
