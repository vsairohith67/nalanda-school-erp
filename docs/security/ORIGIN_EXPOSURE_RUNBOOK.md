# Origin Exposure Runbook

## Detection and severity

Detect direct-origin reachability, unexpected A/AAAA/history records, certificate transparency names, leaked response headers, firewall drift, tunnel bypass, proxy-proof failures and edge/origin mismatch events. Critical means the origin is reachable during active attack or private services are exposed; High means confirmed reachable origin without observed exploitation.

## Immediate containment

Preserve DNS, certificate, firewall, tunnel, listener and edge configuration evidence. Restrict the firewall to the tunnel/edge and administration network, stop any public application/database/storage/debug listener, enter under-attack mode, and rotate the proxy proof. If traffic continues or the address is broadly known, rotate the origin address and origin certificate through the provider procedure. Do not rely on DNS removal alone.

## Eradication and recovery

Remove revealing DNS records and stale configuration, check repository/issues/screenshots/logs for origin disclosure, rotate affected secrets, validate SSH key/source restrictions, and confirm database/storage isolation. Test from outside the administration network that only the managed edge is reachable. Verify end-to-end TLS and proxy identity before reopening application traffic.

## Communication and review

Notify the infrastructure/security owner and school leadership according to impact. Preserve chain of custody. Record discovery source, exposure duration, reachability, observed traffic, rotations, external validation and residual historical-discovery risk.
