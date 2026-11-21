# Mobile OTP channel picker fix — 21 Nov 2026

## UI changes
- Replaced stacked radio rows with two horizontal, icon-led selection cards (SMS and WhatsApp).
- Removed disabled-state locking. Both cards remain selectable; a send attempt reports a precise setup error if that channel's widget is not configured.
- WhatsApp is preselected because the owner's existing `SecureOTPWidgetCNWD` was confirmed to have Default Channel = WhatsApp.
- Selected card is highlighted; mobile layout remains two columns.

## Existing MSG91 mapping
The currently confirmed legacy widget ID (`MSG91_WIDGET_ID`) is treated as WhatsApp-primary for this project, because the owner's MSG91 screenshot shows `SecureOTPWidgetCNWD` has Default Channel = WhatsApp. The existing `MSG91_WIDGET_TOKEN` is reused as its browser token. No new token is generated.

## SMS requirement
The existing widget is WhatsApp-primary. It cannot be honestly advertised as an SMS-primary initial-send widget merely because SMS appears in its retry channels. To send the first OTP by SMS when the user selects SMS, configure an SMS-primary widget and set `MSG91_SMS_WIDGET_ID`. The existing `MSG91_WIDGET_TOKEN` is used as the SMS token fallback, provided MSG91 accepts that token for the SMS widget. If MSG91 rejects it, keep the same token and ask MSG91 support whether it can be authorized for the second widget; do not generate a new token without the owner's approval.

## Deployment
Deploy the updated project to the existing `crakkerxai-tools` Worker/site. No database migration is included. After deployment, check `/api/config`:
- `msg91WhatsappEnabled: true` means the existing WhatsApp-primary widget ID/token/AuthKey/bridge are configured.
- `msg91SmsEnabled: true` requires `MSG91_SMS_WIDGET_ID` plus a token and bridge configuration.

These flags indicate configuration presence, not proof of successful delivery. Test one real OTP per selected channel.
