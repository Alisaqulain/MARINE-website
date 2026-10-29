export type ConnectionCheck = {
  name: string;
  ok: boolean;
  env: string;
  message: string;
};

async function pingOpenAi(): Promise<ConnectionCheck> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return {
      name: "OpenAI wording",
      ok: false,
      env: "OPENAI_API_KEY",
      message: "Not connected. Add OPENAI_API_KEY to .env.local, then restart the server. Chat still answers from the catalogue without it.",
    };
  }
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      return {
        name: "OpenAI wording",
        ok: false,
        env: "OPENAI_API_KEY",
        message: `Not connected. OpenAI returned HTTP ${res.status}. The key is saved and is not shown.`,
      };
    }
    return {
      name: "OpenAI wording",
      ok: true,
      env: "OPENAI_API_KEY",
      message: "Connected. OpenAI accepted the key. No customer message was sent.",
    };
  } catch {
    return {
      name: "OpenAI wording",
      ok: false,
      env: "OPENAI_API_KEY",
      message: "Not connected. The key is saved, but OpenAI could not be reached.",
    };
  }
}

function pingVoice(): ConnectionCheck {
  const provider = process.env.VOICE_PROVIDER?.trim();
  const secret = process.env.VOICE_WEBHOOK_SECRET?.trim();
  if (!provider || !secret) {
    return {
      name: "Voice calls",
      ok: false,
      env: "VOICE_PROVIDER and VOICE_WEBHOOK_SECRET",
      message: "Not connected. Add both VOICE_PROVIDER and VOICE_WEBHOOK_SECRET. No test call is placed.",
    };
  }
  return {
    name: "Voice calls",
    ok: true,
    env: "VOICE_PROVIDER and VOICE_WEBHOOK_SECRET",
    message: "Credentials are saved. Point the provider at POST /api/ai/voice/webhook. This page does not place a call.",
  };
}

function pingSearch(): ConnectionCheck {
  const provider = process.env.SEARCH_DATA_PROVIDER?.trim();
  if (!provider) {
    return {
      name: "Search volumes and competitor rankings",
      ok: false,
      env: "SEARCH_DATA_PROVIDER",
      message: "Not connected. No search-data account is configured, so volumes and rankings are not available.",
    };
  }
  return {
    name: "Search volumes and competitor rankings",
    ok: false,
    env: "SEARCH_DATA_PROVIDER",
    message: "A provider name is saved, but this site does not call a search API yet. Rankings are still unavailable.",
  };
}

function pingMerchant(): ConnectionCheck {
  const id = process.env.MERCHANT_CENTER_ID?.trim();
  if (!id) {
    return {
      name: "Merchant Center upload",
      ok: false,
      env: "MERCHANT_CENTER_ID",
      message: "Not connected. The local product feed is at /feeds/google.xml. Nothing is uploaded to Google.",
    };
  }
  return {
    name: "Merchant Center upload",
    ok: false,
    env: "MERCHANT_CENTER_ID",
    message: "A Merchant Center id is saved, but upload is not implemented. The feed stays local at /feeds/google.xml.",
  };
}

export async function pingPhase2(): Promise<ConnectionCheck[]> {
  const openAi = await pingOpenAi();
  return [openAi, pingVoice(), pingSearch(), pingMerchant()];
}
