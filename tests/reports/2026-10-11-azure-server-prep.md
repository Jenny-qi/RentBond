# Azure server preparation — 2026-10-11

The user approved creating a VM, generating its SSH key, and accepting the Azure
creation terms. The Azure portal reports the deployment complete and
`rentbond-backend` running in East Asia under Azure for Students. Specification:
Standard B2als v2, 2 vCPU, 4 GiB RAM, Ubuntu 24.04, 30 GiB Standard SSD LRS.
Compute estimate is USD 0.0526/hour; disk, public IP, and usage are additional.
No pay-as-you-go subscription upgrade was performed.

The student subscription policy permits only koreacentral, eastasia, uaenorth,
indiasouthcentral, and malaysiawest. Other regions previously selected were
outside that policy. Public IPv4 is 4.144.67.237. The configured Azure DNS name
`rentbond-api-20261011.eastasia.cloudapp.azure.com` resolves to that IP from the VM.

The VM's Azure Run Command installed Docker 29.1.3, Compose 2.40.3, and 4 GiB
swap. Public main d325de069d26b2fff950425f3339aa22c6e84047 was cloned. Runtime and
staging changes from local 7784cb1 were applied after a paste-format failure was
corrected by base64 transport. Application and scanner image builds completed
with exit 0: `rentbond-staging-app:local` (1.91 GB) and
`rentbond-scanner:local` (243 MB). Azure Compose configuration passed
`config --no-env-resolution --no-interpolate --quiet` on the VM. This checks
syntax, not runtime connectivity or service health.

Local frontend changes add a server-only BACKEND_URL external beforeFiles
rewrite for /api/*. Typecheck and production build passed. The generated routes
manifest contains the intended external API rewrite using a placeholder test
origin. The production frontend has not yet received this change or variable.

The Azure service variant is prepared for existing external PostgreSQL and
shared private VM storage, avoiding the Supabase free object-size constraint
without misrepresenting bucket limits. ClamAV has no published port, and the
application publishes only on loopback. Public TLS is a separate Compose
profile. WORKER_EXECUTE remains false.

Pending: explicit approval to transfer database credentials to this VM, create
a new backend session secret if the existing Vercel Secret cannot be recovered,
and add the drafted TCP 80/443 public inbound rule. No custom inbound rule has
been submitted. Database credentials were read through the managed Supabase
resource's official Show secret UI, retained only in transient browser-session
memory, and the UI was hidden again. They have not been written to the VM.

The SSH private-key download reported success but its returned file did not
exist in either shared filesystem. No downloadable private key is available;
Azure Run Command remains usable through the user's account. Do not report the
key as saved or disclose a fabricated file link.

Still unverified: live database and scanner health, Worker operation, API HTTPS,
frontend cookies/passkeys, full Monad allocation/withdrawal, and independent
acceptance. No FR/SC/AT/TS status is promoted to Verified.

## Later execution

The subsequent confirmation and deployment supersede the pending infrastructure
items above. See [live backend execution](2026-10-11-azure-live-backend.md) for
actual migration, scanner, HTTPS, frontend proxy and remaining catch-up evidence.
