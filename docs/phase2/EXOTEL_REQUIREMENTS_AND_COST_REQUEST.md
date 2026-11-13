# Exotel — technical requirements and cost-confirmation request

**Prepared:** 8 November 2026 · **For:** Marina Muse International, to send to Exotel support or sales from the account owner's registered email.
**Status:** the account stays on **Trial**. Nothing has been upgraded, activated or purchased.

---

## A. Verified account facts (read-only API checks, 8 Nov 2026)

| Item | Value | How verified |
|---|---|---|
| API cluster | Singapore: `api.exotel.com` | v1 API requests authenticate on this host |
| Credentials | Valid (API key, API token, Account SID) | `GET /v1/Accounts/{sid}/Calls.json` returns 200 |
| Plan / status / billing | **Trial** · active · prepaid | `GET /v1/Accounts/{sid}.json` |
| KYC status | **notstarted** | same |
| ExoPhones | 1 (ending **0364**) | `GET /v1/Accounts/{sid}/IncomingPhoneNumbers.json` |
| vSIP / v2 Trunks API | **Not enabled.** `GET /v2/accounts/{sid}/trunks` returns HTTP 400 `"Exotel API Version v2 not supported. Contact Exotel for details."` | Read-only GET |

## B. What we need to build

Inbound calls to the ExoPhone are answered by the Vapi AI voice assistant. Optionally, Vapi places owner-approved callbacks through Exotel. Exotel numbers cannot be connected to Vapi directly; Exotel's documented path is **SIP trunking (vSIP)** through the v2 Trunks API.

```
Caller → ExoPhone (…0364) → Exotel vSIP trunk → sip:<number>@<vapi-credential-id>.sip.vapi.ai → Vapi assistant (Gemini)
Vapi (outbound) → Exotel SIP gateway <account_sid>.pstn.exotel.com → PSTN
```

## C. Technical requirements checklist

| # | Requirement | Who | Notes / source |
|---|---|---|---|
| 1 | Complete KYC | **Client** | Exotel SIP trunking quickstart lists "Exotel account with KYC completed" as a prerequisite |
| 2 | Move the account from Trial to a plan that includes SIP trunking | **Client + Exotel** | Exotel to confirm the plan, after cost approval |
| 3 | Enable vSIP / SIP trunking and the v2 Trunks API (`/v2/accounts/{sid}/…`) | **Exotel** | The account currently returns "v2 not supported" |
| 4 | Create the trunk: `trunk_name`, `nso_code: ANY-ANY`, `domain_name: <sid>.pstn.exotel.com` | Developer (after 3) | Exotel dynamic SIP trunking API |
| 5 | Map the ExoPhone (…0364) to the trunk | Developer (after 4) | `POST …/trunks/{trunk_sid}/phone-numbers` |
| 6 | Outbound authentication: digest credentials, or whitelisting Vapi's signalling IPs `44.229.228.186/32` and `44.238.177.138/32` | Developer (after 4) | Exotel + Vapi docs |
| 7 | Inbound destination URI: `<VAPI_SIP_CREDENTIAL_ID>.sip.vapi.ai` (TLS 443 or TCP 5070 on the Exotel side, as Exotel advises) | Developer | Exotel + Vapi docs |
| 8 | Vapi BYO SIP credential (`provider: byo-sip-trunk`) and BYO phone number for the ExoPhone | Developer | Vapi docs. Vapi assistant "Marina Muse Assistant" already created |
| 9 | Missed-call status callback to `https://marinamuseinternational.com/api/ai/voice/webhook?provider=exotel&token=…` | Developer | Implemented; the token is held server-side |
| 10 | Firewall / media ranges: Exotel RTP UDP 10000–40000 (published); Vapi media UDP 40000–60000 | **Exotel to confirm** for this account |
| 11 | Number porting / extra numbers | Not needed | The existing ExoPhone is used |

**Developer-side work available now** (no Exotel change needed): the Vapi assistant, webhook verification and missed-call callback are done. Everything from item 4 onward waits for items 1–3.

## D. Cost table

| Charge | Published by Exotel? | Confirmed for this account? |
|---|---|---|
| Plan required for vSIP (monthly / annual fee) | No | **Awaiting Exotel** |
| vSIP / SIP trunk activation or setup fee (one-time) | No | **Awaiting Exotel** |
| v2 API access fee | No | **Awaiting Exotel** |
| ExoPhone rental (existing …0364; any additional number) | No | **Awaiting Exotel** |
| Incoming call rate per minute (SIP trunk) | No | **Awaiting Exotel** |
| Outgoing call rate per minute (mobile / landline, India) | No | **Awaiting Exotel** |
| Per-channel / concurrent-call charges | No | **Awaiting Exotel** |
| Minimum monthly commitment, deposit, prepaid top-up, contract term | No | **Awaiting Exotel** |
| KYC / compliance charges | No | **Awaiting Exotel** |
| GST / taxes (inclusive or exclusive) | Not stated | **Awaiting Exotel** |
| *Vapi side (separate bill)* | Yes: $0.05/min hosting plus model, voice and transcriber at provider cost; Vapi SIP transport "Free" (vapi.ai/pricing, read 8 Nov 2026) | — |

The only prices on exotel.com are for its contact-centre products (XPrime / XPro). These are not the API/vSIP service needed here.

## E. Message to send to Exotel (copy, fill in the Account SID, send from the registered email)

> Subject: vSIP / SIP trunking and v2 Trunks API — requirements and pricing for account [ACCOUNT SID]
>
> Hello Exotel team,
>
> Our account [ACCOUNT SID] (Singapore cluster, api.exotel.com) is currently a Trial account. Before we upgrade anything, we need written confirmation of the following:
>
> 1. **KYC:** which documents are required for our account, and whether there is any KYC or compliance charge.
> 2. **Eligibility:** can this account be enabled for vSIP / SIP trunking and the v2 Trunks API (`/v2/accounts/{sid}/trunks`)? Our request currently returns "Exotel API Version v2 not supported". Which plan is required?
> 3. **One-time charges:** activation, setup or onboarding fees for the plan, vSIP and v2 API access.
> 4. **Recurring charges:** plan fee, ExoPhone rental (our existing number ending 0364, and any additional number), per-channel or concurrency charges.
> 5. **Usage charges:** per-minute rates for incoming and outgoing calls over the SIP trunk (mobile and landline, India), and the billing pulse.
> 6. **Commitments:** any minimum monthly commitment, deposit, prepaid top-up or contract term.
> 7. **Taxes:** whether prices include or exclude GST.
> 8. **Technical:** the SIP gateway FQDN/IP addresses, ports and transport (TLS/TCP), media IP ranges for our account, and whether digest authentication, IP whitelisting or both are supported for outbound calls.
> 9. **Third-party endpoint:** confirmation that inbound calls may be routed to a third-party SIP endpoint (Vapi, `*.sip.vapi.ai`) and outbound calls accepted from Vapi's signalling IPs 44.229.228.186 and 44.238.177.138.
>
> We will decide on the upgrade after receiving this information. Please do not activate any paid service yet.
>
> Regards,
> [Name], Marina Muse International

## F. Client vs developer

- **Client:** complete KYC; send the message above; approve costs in writing; then request activation.
- **Exotel:** written answers; vSIP and v2 enablement after the client's approval.
- **Developer (after activation):** create the trunk, map the number, set up outbound authentication, create the Vapi SIP credential and BYO number, and run a test call. A test call is a separate approval, because calls are billable.
