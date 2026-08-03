# Consolidated Academic Reporting Specification

## Boundary

Prompt 23G produces governed reports only from a locked
`StudentResultSnapshot` and its current issued `StudentReportCardVersion`.
Every output records the result-snapshot version, issued-report version,
formula version, rounding-policy version, scheme references, attendance basis,
lock time, issue time, generation time and a content hash. Raw mark sheets are
not read and examination arithmetic is never recalculated.

## Report families

The supported definitions are longitudinal Student progress; class/section
summary; subject/paper distribution; configured subject-group and combined
result; outcome-state distribution; comparative delta; completion and missing
source; approved class average/highest; Class IX/X revision/preboard package;
and printable leadership summary. Parent and Student users receive only the
longitudinal family. Teachers receive only assigned subject/paper and completion
families. Viewer output is aggregate and suppression-aware.

`PRESENT` with zero, `ABSENT`, `EXEMPT`, `NOT_APPLICABLE` and `NOT_ENTERED`
remain distinct. Ties are displayed as published evidence; no new rank is
calculated. Class average and highest require an explicit approval reference.

## Versioned runs

A canonical definition hash, parameters, authorised scope and ordered source
fingerprint form the idempotency key. An identical request returns the existing
run. A governed correction creates a new run with `supersedesRunId`; the former
summary remains queryable. SQLite triggers refuse update/delete of runs, source
links and audit events. Export authorisation is append-only.

CSV and PDF are generated in memory behind authenticated POST requests. Files
use deterministic non-PII names, are never placed in a public directory and are
returned with private no-store headers. CSV cells beginning with spreadsheet
formula characters are escaped. PDF supports colour and printer-safe
monochrome; charts also carry labels and patterns.

## Non-goals

This phase does not rank Teachers, monitor Parent reads, predict outcomes,
publish public results, claim official-board status, submit to a government or
board portal, transfer data to a provider, change an examination formula or
authorise deployment or real-user onboarding.
