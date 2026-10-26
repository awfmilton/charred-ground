# Test-only TLS fixtures

These PEM files (`test-only-ca.pem`, `test-only-server-key.pem`, and `test-only-server-cert.pem`) are throwaway, test-only credentials used exclusively by `tests/game.cjs` to start an ephemeral `127.0.0.1` `tls.Server` and verify post-handshake certificate pinning (`verifyConnectionTls` / `wrapMysqlPool`) on a real TLS socket. They are never used for any real host or production environment.

To regenerate:

```sh
openssl req -x509 -newkey rsa:2048 -nodes -keyout tmp-ca-key.pem -out test-only-ca.pem -days 36500 -subj "/CN=Charred Ground TEST-ONLY CA" -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign"
openssl req -newkey rsa:2048 -nodes -keyout test-only-server-key.pem -out tmp-server.csr -subj "/CN=test-only-mysql.invalid"
printf "basicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:localhost,IP:127.0.0.1\n" > tmp-ext.cnf
openssl x509 -req -in tmp-server.csr -CA test-only-ca.pem -CAkey tmp-ca-key.pem -CAcreateserial -out test-only-server-cert.pem -days 36500 -sha256 -extfile tmp-ext.cnf
rm -f tmp-ca-key.pem tmp-server.csr tmp-ext.cnf test-only-ca.srl
```
