"""
Powston rule harness — simulates the Powston runtime environment.

Usage:
    python3 powston-harness.py <compiled_template.py> <input.json>

Reads the compiled template and test input JSON, injects the expected
global variables, executes the template, then prints a JSON result
with { action, description, decisions, feed_in_power_limitation, ... }.
"""

import json
import sys
import traceback
from datetime import datetime


class DecisionLogger:
    """Mimics the Powston decisions object."""

    def __init__(self):
        self.reasons = []
        self._last_action = None

    def reason(self, action: str, description: str, **kwargs):
        entry = {
            "action": action,
            "description": description,
            **kwargs,
        }
        self.reasons.append(entry)
        self._last_action = action
        return action

    def to_dict(self):
        return {"reasons": self.reasons}


def build_globals(input_data: dict) -> dict:
    """Build the global namespace that a Powston template expects."""

    now = datetime.now()
    if "interval_time" in input_data:
        # Allow overriding via ISO string or {"hour": N, "minute": N}
        it = input_data["interval_time"]
        if isinstance(it, str):
            now = datetime.fromisoformat(it)
        elif isinstance(it, dict):
            now = now.replace(
                hour=it.get("hour", now.hour),
                minute=it.get("minute", now.minute),
                second=0,
                microsecond=0,
            )

    decisions = DecisionLogger()

    # Defaults for every variable the template might reference
    defaults = {
        # Core
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
        # Outputs
        "action": "auto",
        "feed_in_power_limitation": None,
        "optimal_charging": 5000,
        "optimal_discharging": 5000,
        "import_soc": None,
        "always_export_rrp": None,
        "mqtt_topic_push_mining_1": "Off",
        "cheap_power_available": False,
        # Decision logger
        "decisions": decisions,
    }

    # Merge input on top of defaults
    ns = dict(defaults)
    for key, value in input_data.items():
        if key == "interval_time":
            continue  # already handled
        if key == "decisions":
            continue  # not overridable
        ns[key] = value

    # Convenience: allow "soc" as alias for "battery_soc"
    if "soc" in input_data and "battery_soc" not in input_data:
        ns["battery_soc"] = input_data["soc"]

    return ns


def run_template(template_code: str, input_data: dict) -> dict:
    """Execute a compiled Powston template and return the results."""

    ns = build_globals(input_data)

    try:
        exec(compile(template_code, "<template>", "exec"), ns)
    except Exception:
        return {
            "success": False,
            "error": traceback.format_exc(),
            "action": None,
            "description": None,
            "decisions": {"reasons": []},
        }

    # Extract the decisions logger
    decisions: DecisionLogger = ns.get("decisions", DecisionLogger())

    # The last reason entry IS the final action
    last_reason = decisions.reasons[-1] if decisions.reasons else None
    action = ns.get("action", "auto")
    description = last_reason["description"] if last_reason else None

    return {
        "success": True,
        "error": None,
        "action": action,
        "description": description,
        "decisions": decisions.to_dict(),
        "feed_in_power_limitation": ns.get("feed_in_power_limitation"),
        "optimal_charging": ns.get("optimal_charging"),
        "cheap_power_available": ns.get("cheap_power_available", False),
    }


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Usage: harness.py <template> <input.json>"}))
        sys.exit(1)

    template_path = sys.argv[1]
    input_path = sys.argv[2]

    with open(template_path, "r") as f:
        template_code = f.read()

    with open(input_path, "r") as f:
        input_data = json.load(f)

    result = run_template(template_code, input_data)
    print(json.dumps(result, default=str))


if __name__ == "__main__":
    main()
