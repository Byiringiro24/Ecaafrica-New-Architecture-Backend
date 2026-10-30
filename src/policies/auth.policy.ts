export const AUTH_POLICY = {
  public: [
    "login",
    "platform_login",
    "refresh",
    "forgot_password",
    "reset_password"
  ],
  authenticated: ["logout", "me"]
} as const;
