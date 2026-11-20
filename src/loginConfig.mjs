export const LOGIN_USERNAME = "admin";
export const LOGIN_PASSWORD = "admin1234";

export function hasValidCredentials(username, password) {
  return username === LOGIN_USERNAME && password === LOGIN_PASSWORD;
}
