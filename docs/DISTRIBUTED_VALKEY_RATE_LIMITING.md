# Distributed Valkey rate limiting

The adapter uses one Lua evaluation for every multi-key decision. It removes expired members, checks all governed buckets using Valkey server time, rejects when any bucket is full, and increments every bucket only when allowed. Keys share a cluster hash slot, are namespaced, bounded, and accept only existing opaque actor components.

The client supports authentication and TLS, lazy bounded connection, command/connect timeouts, one request retry, bounded reconnect, no offline queue, privacy-safe health, and clean shutdown. Governed deployments never fall back to process memory. Dependency loss leaves the process live, fails readiness, and preserves controlled 503 behavior.
