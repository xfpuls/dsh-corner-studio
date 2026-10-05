/**
 * dsh-corner-studio — host half.
 *
 * Intentionally a no-op loader entry. Every feature lives in the browser half
 * (`./client`), which dsh-client-modules picks up through the package's
 * `dsh.client` declaration. All preferences persist in localStorage and
 * IndexedDB because the Host settings wire only exposes an allowlisted set of
 * namespaces to browser clients, so a third-party namespace would answer
 * `settings-not-exposed`; visual preferences belong to the browser anyway.
 */

/** Host loader entry for the browser implementation exported from `./client`. */
export function apply() {}
