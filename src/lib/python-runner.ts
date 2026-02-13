export type PythonRunResult = {
  success: boolean;
  error: string | null;
  action: string | null;
  description: string | null;
  decisions: { reasons: Array<{ action: string; description: string; [k: string]: unknown }> };
  feed_in_power_limitation?: number | null;
  optimal_charging?: number | null;
  cheap_power_available?: boolean;
};

// Pyodide singleton — reused across requests for fast warm runs
let pyodidePromise: Promise<unknown> | null = null;

async function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      // Dynamic import so Next.js doesn't try to bundle it at build time
      const { loadPyodide } = await import("pyodide");
      // Point Pyodide to its actual package directory so it can find
      // pyodide-lock.json and the .wasm files at runtime
      const { join } = await import("path");
      const indexUrl = join(process.cwd(), "node_modules", "pyodide") + "/";
      const pyodide = await loadPyodide({ indexURL: indexUrl });
      return pyodide;
    })();
  }
  return pyodidePromise;
}

/**
 * Python harness code that runs inside Pyodide.
 * Sets up the Powston runtime environment, executes the template,
 * and returns structured results as JSON.
 */
const HARNESS_CODE = `
import json
from datetime import datetime

class DecisionLogger:
    def __init__(self):
        self.reasons = []
        self._last_action = None

    def reason(self, action, description, **kwargs):
        entry = {"action": action, "description": description}
        entry.update(kwargs)
        self.reasons.append(entry)
        self._last_action = action
        return action

    def to_dict(self):
        return {"reasons": self.reasons}


def run_template(template_code, input_data):
    now = datetime.now()
    it = input_data.get("interval_time")
    if isinstance(it, str):
        now = datetime.fromisoformat(it)
    elif isinstance(it, dict):
        now = now.replace(
            hour=it.get("hour", now.hour),
            minute=it.get("minute", now.minute),
            second=0, microsecond=0
        )

    decisions = DecisionLogger()

    ns = {
        "interval_time": now,
        "battery_soc": 50.0,
        "buy_price": 20.0,
        "sell_price": 10.0,
        "solar_power": 0,
        "buy_forecast": [],
        "sell_forecast": [],
        "hourly_gti_forecast": [],
        "history_sell_prices": [],
        "runtime_params": {},
        "action": "auto",
        "feed_in_power_limitation": None,
        "optimal_charging": 5000,
        "optimal_discharging": 5000,
        "import_soc": None,
        "always_export_rrp": None,
        "mqtt_topic_push_mining_1": "Off",
        "cheap_power_available": False,
        "decisions": decisions,
    }

    for key, value in input_data.items():
        if key in ("interval_time", "decisions"):
            continue
        ns[key] = value

    if "soc" in input_data and "battery_soc" not in input_data:
        ns["battery_soc"] = input_data["soc"]

    try:
        exec(compile(template_code, "<template>", "exec"), ns)
    except Exception as e:
        import traceback
        return json.dumps({
            "success": False,
            "error": traceback.format_exc(),
            "action": None,
            "description": None,
            "decisions": {"reasons": []},
        }, default=str)

    last_reason = decisions.reasons[-1] if decisions.reasons else None
    action = ns.get("action", "auto")
    description = last_reason["description"] if last_reason else None

    return json.dumps({
        "success": True,
        "error": None,
        "action": action,
        "description": description,
        "decisions": decisions.to_dict(),
        "feed_in_power_limitation": ns.get("feed_in_power_limitation"),
        "optimal_charging": ns.get("optimal_charging"),
        "cheap_power_available": ns.get("cheap_power_available", False),
    }, default=str)
`;

export async function runPythonTemplate(
  compiledCode: string,
  inputJson: Record<string, unknown>
): Promise<PythonRunResult> {
  try {
    const pyodide = (await getPyodide()) as {
      runPython: (code: string) => unknown;
      globals: { set: (k: string, v: unknown) => void; delete: (k: string) => void };
    };

    // Inject the template code and input as Python globals
    pyodide.globals.set("__template_code__", compiledCode);
    pyodide.globals.set("__input_json__", JSON.stringify(inputJson));

    // Run harness + execute template
    const resultJson = pyodide.runPython(`
${HARNESS_CODE}
import json as _json
_input = _json.loads(__input_json__)
run_template(__template_code__, _input)
`) as string;

    // Cleanup globals
    pyodide.globals.delete("__template_code__");
    pyodide.globals.delete("__input_json__");

    return JSON.parse(resultJson) as PythonRunResult;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      action: null,
      description: null,
      decisions: { reasons: [] },
    };
  }
}
