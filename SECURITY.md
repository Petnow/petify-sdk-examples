# Security

Please report security issues privately to **support@petnow.io** rather than opening a public issue.
Include the affected example, the steps to reproduce, and the impact you observed.

These examples are for learning the SDK integration. Two shortcuts they take are not safe in production:

- **The API key is compiled into the app.** Anyone with the binary can extract it.
- **The app creates its own capture session** by calling the Petify Server API. In production your
  server creates capture sessions and the app only receives their IDs.

If you accidentally commit a key while experimenting, revoke it in the Petify Console and issue a new one;
removing it from git history alone is not enough.
