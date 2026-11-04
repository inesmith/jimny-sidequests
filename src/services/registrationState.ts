let registrationInProgress = false;

export function setRegistrationInProgress(value: boolean) {
  registrationInProgress = value;
}

export function isRegistrationInProgress() {
  return registrationInProgress;
}