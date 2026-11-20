export const LOGIN_USERNAME = "admin";
export const LOGIN_PASSWORD = "change-me";

export function hasValidCredentials(username, password) {
  return username === LOGIN_USERNAME && password === LOGIN_PASSWORD;
}
