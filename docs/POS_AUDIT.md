# POS Audit

## Scope

This audit follows the POS transaction path from product selection through cart operations, pricing, payment, invoice generation, stock deduction, receipt creation, and history visibility.

## Current POS Surface

- POS UI exists at app/(staff)/pos/page.tsx.
- POS server logic is implemented in actions/pos.ts.
- Invoice and payment handling are also supported through actions/invoice.ts.

## Transaction Path Review

### Product selection
- Product lookup and cart entry are implemented at the UI layer.
- The system is capable of reading products and adding them to a transaction.

### Pricing and discount handling
- Pricing is driven from product data and invoice details.
- The code would benefit from a centralized pricing policy to avoid scattered logic.

### Payment and invoice creation
- Payment and invoice operations are handled by dedicated actions.
- The main risk is consistency when payment succeeds but a downstream invoice item write fails.

### Stock deduction
- Stock updates should be coordinated as part of invoice or POS completion.
- A transactional wrapper would reduce the chance of stock and invoice inconsistency.

### History and receipt
- Receipt and history flows exist, but the interaction between them and the underlying transaction state should be tightened.

## Main Risks

- Transaction rollback is not clearly formalized across the full flow.
- Payment and stock updates may become inconsistent if a step fails mid-operation.
- Pricing and discount rules are likely to become harder to maintain as the business scope grows.

## Recommendation

Introduce a single POS transaction service that coordinates cart building, pricing, invoice creation, payment capture, and stock deduction under one transactional boundary.
