# Marina Muse Phase 2: production deployment and rollback plan

Prepared 16 Nov 2026 for Ahmad's review. Revision 2 (16 Nov) addresses Ahmad's review points. **Nothing in this plan has been executed.** Each stage below starts only with Ahmad's written approval for that stage.

## Safety state that stays in place throughout

**Production env switches:**

| Setting | Value | Effect |
|---|---|---|
| `AI_AGENTS_ENABLED` | *(empty)* | All four AI agents stay OFF. |
| `AI_AGENTS_PRODUCTION_APPROVED` | *(empty)* | All four AI agents stay OFF. |
| `WHATSAPP_OUTBOUND_ENABLED` | `false` | No WhatsApp message can be sent. |
| `WHATSAPP_PRODUCTION_SENDING_APPROVED` | *(empty)* | No WhatsApp message can be sent. |
| `VAPI_OUTBOUND_ENABLED` | `false` | No phone calls. |
| `WHATSAPP_COEXISTENCE_ENABLED` | `false` | The signup button is hidden until Stage 3 is approved. |

**What else stays OFF:**
- The Vapi assistant stays OFF. No Vapi phone number is attached and no calls are placed.
- No paid service is activated: no Exotel upgrade, no Vapi number purchase, no paid template sends.

## Stage 1: Pre-deployment (no production changes)

1. **Backup:** Ahmad provides server access. I take a full backup of:
   - the current code folder;
   - the current production `.env`;
   - the MongoDB database (`mongodump`).

   These backups are encrypted, stored on the server in a restricted folder and given to Ahmad securely (see Clarifications).
2. **Record the current state:** I note the deployed commit and process manager status, and I confirm the site currently works. This is the rollback point.
3. **Review:** Ahmad reviews the code diff (branch `phase2-completion`) if wanted.

## Stage 2: Code deployment (separate approval)

1. Upload the Phase 2 code into a **new release folder**. The current folder is kept untouched for rollback.
2. **Add new env values** (production credentials are requested at this point, not earlier):
   - the Gemini and Vapi production keys;
   - Meta app secret;
   - webhook verify token;
   - new webhook secrets;
   - all safety switches set as in the table above.

   Existing values (PayPal, MongoDB, auth, email) are kept as they are.
3. Run `npm ci` and `npm run build`. If the build fails, stop: the live site was never switched.
4. Switch the process manager to the new release and restart.
5. **Smoke test** (read-only, page loads only; see Clarifications):
   - home, product, cart and checkout pages load;
   - admin login works;
   - `/test-ai` shows every safety row OFF (no external API calls).
6. **Observe:** monitor the logs for 30 minutes.

**Database:** no migration. New collections (consents, follow-ups, delivery records) are created empty on first use, and existing orders, products and users are not modified.

## Stage 3: WhatsApp Coexistence signup (separate approval, scheduled with Ahmad)

1. Set `WHATSAPP_COEXISTENCE_ENABLED=true` and restart. Sending stays OFF.
2. Ahmad opens the admin Coexistence page and starts the Meta Embedded Signup. Ahmad selects **"Connect existing WhatsApp Business app"** and confirms on the phone with +91 74570 99540. Ahmad performs this step himself; I do not.
3. Meta returns the WABA ID and phone-number ID. The admin approval step stores them.
4. **Verify (read-only):**
   - the webhook receives app and history echo events;
   - the WhatsApp Business app on the phone still shows all chats and keeps working normally.
5. Messaging stays OFF until a later written approval.

**Number and chats:**
- With Coexistence, the number stays registered in the WhatsApp Business app, and existing chats stay on the phone.
- There is no migration, no re-registration and no number deletion.
- The steps above never choose the "migrate number" or "register new number" option.

## Rollback

| Situation | Action | Result |
|---|---|---|
| Build or deploy problem (Stage 2) | Point the process manager back to the old release folder, restore the old `.env` and restart (~2 min). | Site exactly as before. |
| Data problem | Restore the Stage 1 `mongodump`. Not expected, since no migration is run. | Database as before. |
| Embedded Signup fails or Meta reports Coexistence unavailable for this number (Stage 3) | Stop. Set `WHATSAPP_COEXISTENCE_ENABLED=false` and restart. Do not retry with any migrate or register option. | Phone and app untouched; website keeps working without WhatsApp API. |
| Signup succeeded but needs undoing | 1. Set the coexistence flag to `false` and clear the stored connection in admin. 2. In the WhatsApp Business app, go to Settings → Account → Business Platform and disconnect. | Number and app remain active. |
| Any unexpected outbound activity | Already blocked by the switches. As a kill switch, set `WHATSAPP_OUTBOUND_ENABLED=false` and `AI_AGENTS_DISABLED=chat,voice,growth,whatsapp`, then restart. | Everything stops immediately. |

## Needed from Ahmad before Stage 1

- Server access (see "Server access" below).
- A preferred time window.
- Written approval for Stage 1 only.

**No production credentials are needed for Stage 1.** Gemini, Vapi, the Meta app secret and the PayPal webhook ID are requested only after Stage 2 is approved, immediately before they are entered on the server.

## Clarifications (revision 2)

### Backup security
- The production `.env` backup is encrypted on the server with `age` (or `gpg --symmetric`, AES-256). The passphrase is shared with Ahmad separately from the file, by phone or password manager, never in the same channel.
- The encrypted file is given to Ahmad through a secure channel (password-manager file share or direct download from the server). No plain-text copy is created at any point.
- No copy is kept on the developer's machine. After Ahmad confirms receipt, the only copies are Ahmad's and the encrypted one on the server, in a folder readable only by the deploy user.
- The MongoDB backup (`mongodump --gzip`) is handled the same way, since it contains customer data.

### Checkout smoke test
Only page loads and inspection:
- home, product, cart and checkout pages are opened and checked visually;
- admin login and the admin dashboard are opened.

No order is placed, no PayPal button is clicked, no payment is made, and no email or customer notification is triggered. If a real end-to-end order test is ever wanted, it needs separate approval and a sandbox setup.

### `/test-ai` and database checks
- **External calls:** a normal load of `/test-ai` makes **no external provider call**. It reads only this server's own settings and the local safety-lock file. Live provider checks run only if `/test-ai?live=1` is opened deliberately, and that will **not** be done during Stage 1 or the Stage 2 smoke test without approval.
- **Database:** `/test-ai` performs no database reads or writes.
- **Admin login:** logging in reads the user record. It only writes if the stored role differs (not the case for the existing admin account).
- **Avoided pages:** the separate technical page `/test` *does* call providers and writes and deletes a temporary health-check record, so it will **not** be opened in production without approval.

### Rollback and data safety
- **Rollback is code-only.** It switches the process manager back to the old release folder and the old `.env`. The database is **not** touched.
- **New orders are kept.** Orders, customers and other records written after deployment stay in MongoDB. The old code reads the same collections; the Phase 2 additions only add new optional fields and new collections, which the old code ignores.
- **The `mongodump` backup is for disaster recovery only** (for example, data corruption) and is never restored automatically. Restoring it would overwrite newer orders. If it were ever needed, it would first be restored into a **separate** database, and only the affected records would be repaired, with Ahmad's approval. Records created after the backup are exported first and kept.
- **Before any rollback**, orders created since deployment are counted and listed so Ahmad can see nothing was lost.

### Server access
- **Method:** SSH key access only, no password login. I send Ahmad my public key; Ahmad adds it to a dedicated deploy user. If the host uses a control panel only, a separate panel user with access to this site only is preferred.
- **Permissions needed:**
  - read and write on the site folder and its `.env`;
  - restarting the site process (pm2 or systemd);
  - running `mongodump` (a read-only database user is sufficient for Stage 1).

  No root access is needed for Stage 1, and none for DNS, email or other sites.
- **Restriction:**
  - access is used only inside the approved window and only for the approved stage;
  - commands are logged (shell history plus a written log sent to Ahmad);
  - Ahmad removes the key, or I remove it on request, after each stage.
  - Ahmad can revoke it at any time.
