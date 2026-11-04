let registrationInProgress = false;

const listeners = new Set<() => void>();

export function setRegistrationInProgress(value: boolean) {
  registrationInProgress = value;

  listeners.forEach((listener) => listener());
}

export function isRegistrationInProgress() {
  return registrationInProgress;
}

export function subscribeToRegistrationState(
  listener: () => void
) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}