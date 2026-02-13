const baseUrl = process.env.POWSTON_API_BASE_URL ?? "https://app.powston.com";
const apiKey = process.env.POWSTON_API_KEY;

export type PowstonValidationResponse = {
  ok: boolean;
  details?: Record<string, unknown> | string | null;
  message?: string;
};

export const validateWithPowston = async (compiledScript: string) => {
  if (!apiKey) {
    throw new Error("POWSTON_API_KEY is not set in the environment.");
  }

  const response = await fetch(`${baseUrl}/api/check_code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ code: compiledScript })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Powston validation failed: ${response.status} ${errorBody}`);
  }

  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = await response.text();
  }

  if (typeof parsed === "object" && parsed !== null) {
    const data = parsed as Record<string, unknown>;
    return {
      ok: true,
      message: typeof data.message === "string" ? data.message : undefined,
      details: data
    };
  }

  return {
    ok: true,
    message: typeof parsed === "string" && parsed.length > 0 ? parsed : undefined,
    details: parsed
  };
};
