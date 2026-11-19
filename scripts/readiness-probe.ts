// Coalesce bursts of asset requests. A page load must not spend the API's
// loopback rate-limit budget once per script/image. File/config gates remain
// outside this cache and are checked for every incoming request.
export function readinessProbe(
  probe: () => Promise<boolean>,
  ttlMs = 1000,
  now = Date.now,
) {
  let expires = 0;
  let result = false;
  let pending: Promise<boolean> | undefined;
  return async () => {
    if (pending) return pending;
    if (now() < expires) return result;
    pending = Promise.resolve()
      .then(probe)
      .catch(() => false)
      .then((value) => {
        result = value;
        expires = now() + ttlMs;
        pending = undefined;
        return result;
      });
    return pending;
  };
}
