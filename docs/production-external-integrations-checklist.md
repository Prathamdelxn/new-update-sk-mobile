# Skystruct Production: External Integrations Checklist

Audit scope: `sky-lite` mobile application and `sky-lite-api` backend.

## Launch blockers

1. **Rotate the Cloudinary API secret immediately.** It is currently exposed to the mobile app through `EXPO_PUBLIC_CLOUDINARY_API_SECRET`. Public Expo variables are embedded in the released app and must never contain secrets.
2. **Move Cloudinary signing to the backend.** The mobile app should request a short-lived upload signature from an authenticated API endpoint. Keep the Cloudinary API secret only in backend environment variables.
3. **Restrict backend CORS.** The API currently allows every origin. Configure only the approved web/admin origins; mobile apps do not need wildcard browser CORS.
4. **Implement or remove report email.** The mobile app calls `POST /projects/:id/email-report`, but this API route was not found in `sky-lite-api`.

## Confirmed integrations

| Area | Current implementation | Production action |
| --- | --- | --- |
| Backend API | Next.js API hosted separately from the Expo app | Configure a production API domain, HTTPS, monitoring, error reporting, and reliable deployment. |
| Database | MongoDB through Mongoose | Set a separate production `MONGODB_URI`; enable backups/point-in-time recovery, least-privilege database users, and network restrictions. |
| Email | Nodemailer via SMTP | Configure a production SMTP provider and a verified sender domain. Set SPF, DKIM, and DMARC. |
| Registration OTP | Six-digit OTP sent by email | Add rate limiting, resend cooldown, maximum verification attempts, and remove OTP values from logs. The record is configured to expire after about 10 minutes. |
| Password-reset OTP | Six-digit OTP sent by email | Add the same rate limits and attempt controls. The expiry is 10 minutes. |
| SMS / WhatsApp OTP | Not implemented | No action unless phone OTP is required. If needed, add a backend-only provider such as Twilio, MSG91, AWS SNS, or WhatsApp. |
| File, image, video and PDF uploads | Cloudinary direct uploads from mobile | Use backend-generated short-lived signatures; restrict folders, MIME types, file sizes, upload presets, and transformations. Rotate the exposed secret. |
| Push notifications | Expo push tokens stored in MongoDB; chat sends via Expo Push API | Configure EAS/Expo credentials, FCM v1 for Android, APNs for iOS, and receipt handling to remove invalid tokens. |
| Realtime updates | Socket service accessed by the API and mobile app | Run on a stable HTTPS/WSS host; use a strong `SOCKET_EMIT_SECRET`, authenticated socket connections, allowed origins, and monitoring. Audit the separate socket-server repository before launch. |
| Location / attendance | Expo Location, React Native Maps, Expo geocoding | Configure restricted native Google Maps keys if Google map tiles are used. Confirm permission text, privacy policy disclosures, and GPS data-retention rules. |
| Language | Bundled i18next English and Arabic translations | No external language service is required. Test Arabic translation quality and complete RTL layouts. |
| Currency | Per-project currency, default AED | No foreign-exchange API is used. Add one only if live currency conversion is a product requirement. |
| Payments | Subscription data models only | No payment gateway is connected. Add Stripe/Razorpay/other provider only if subscriptions will be collected online. |
| AI | None found | No OpenAI/LangChain/other AI API needs configuration. |

## Backend production environment variables

Set these only in the backend deployment environment, not in source code or the mobile app:

```text
MONGODB_URI
JWT_SECRET
JWT_REFRESH_SECRET
ENCRYPTION_SECRET
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASS
SMTP_FROM_NAME
SOCKET_SERVER_URL
SOCKET_EMIT_SECRET
```

For Cloudinary, also store the Cloudinary API secret on the backend only. Do not use an `EXPO_PUBLIC_` name for any secret.

## Mobile build configuration

The mobile release needs production values for:

```text
EXPO_PUBLIC_API_BASE_URL
EXPO_PUBLIC_SOCKET_URL
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME
EXPO_PUBLIC_CLOUDINARY_API_KEY
```

The Cloudinary cloud name and API key can be public. The API secret cannot.

## Pre-release verification

- Send registration and password-reset emails from the production sender domain.
- Confirm OTP expiry, resend throttling, and incorrect-code lockout.
- Upload image, video, PDF, and large files; verify rejected types/sizes are blocked.
- Validate Android and iOS push notifications on real devices.
- Check socket reconnect and realtime updates after a network interruption.
- Check maps, location permissions, and attendance-radius behaviour on real devices.
- Test Arabic/RTL screens.
- Verify production API authentication, token refresh, database recovery, and CORS policy.
- Resolve the missing report-email endpoint or remove the corresponding app action.
